import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userWorkspaces } from "@/db/schema";
import { practiceRepository } from "@/repositories/practice.repository";
import { topicProgressRepository } from "@/repositories/progress.repository";
import { getTopicMetadata } from "@/domain/dashboard";
import { applyPracticeSessionToProgress } from "@/domain/practice";

const createPracticeSessionSchema = z
  .object({
    workspaceId: z.string().min(1, "Workspace ID is required"),
    topicId: z.string().min(1, "Topic ID is required"),
    questionCount: z.number().int().min(1).optional(),
    questionsAttempted: z.number().int().min(1).optional(),
    correct: z.number().int().min(0).optional(),
    correctAnswers: z.number().int().min(0).optional(),
    durationMinutes: z.number().int().min(0).max(24 * 60).optional().default(0),
    completedAt: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      const attempted = data.questionsAttempted ?? data.questionCount;
      const correct = data.correctAnswers ?? data.correct;
      if (attempted === undefined || correct === undefined) return false;
      return correct <= attempted;
    },
    {
      message: "Correct answers cannot exceed questions attempted",
      path: ["correct"],
    }
  );

async function resolveOwnedWorkspace(userId: string, workspaceId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: userWorkspaces.id, examAttemptId: userWorkspaces.examAttemptId })
    .from(userWorkspaces)
    .where(and(eq(userWorkspaces.id, workspaceId), eq(userWorkspaces.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const owned = await resolveOwnedWorkspace(session.user.id, workspaceId);
  if (!owned) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const sessions = await practiceRepository.getSessionsForWorkspaceId(getDb(), workspaceId);
  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createPracticeSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid practice session input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { workspaceId, topicId } = parsed.data;
    const attempted = parsed.data.questionsAttempted ?? parsed.data.questionCount ?? 0;
    const correct = parsed.data.correctAnswers ?? parsed.data.correct ?? 0;
    const incorrect = attempted - correct;
    const durationMinutes = parsed.data.durationMinutes ?? 0;
    const completedAt = parsed.data.completedAt ? new Date(parsed.data.completedAt) : new Date();

    const owned = await resolveOwnedWorkspace(session.user.id, workspaceId);
    if (!owned) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Verify topic belongs to workspace exam taxonomy
    if (!getTopicMetadata(topicId, owned.examAttemptId)) {
      return NextResponse.json({ error: "Topic not found for this exam" }, { status: 400 });
    }

    const db = getDb();

    // 1. Persist the practice session
    const createdSession = await practiceRepository.createPracticeSession(db, {
      workspaceId,
      topicId,
      questionCount: attempted,
      correct,
      incorrect,
      unattempted: 0,
      durationMinutes,
      completedAt,
    });

    // 2. Fetch existing topic progress and all sessions for this topic
    const [existingProgress, allTopicSessions] = await Promise.all([
      topicProgressRepository.getTopicProgress(db, workspaceId, topicId),
      practiceRepository.getSessionsForTopicId(db, workspaceId, topicId),
    ]);

    // Ensure createdSession is in list for aggregate calculation
    if (!allTopicSessions.some((s) => s.id === createdSession.id)) {
      allTopicSessions.push(createdSession);
    }

    // 3. Update topic-level aggregate performance in user_topic_progress
    const progressPatch = applyPracticeSessionToProgress({
      workspaceId,
      topicId,
      existingProgress,
      sessions: allTopicSessions,
      completedAt,
    });

    await topicProgressRepository.upsertTopicProgress(db, progressPatch);

    return NextResponse.json(createdSession, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to save practice session" }, { status: 500 });
  }
}
