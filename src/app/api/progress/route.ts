import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userWorkspaces } from "@/db/schema";
import { topicProgressRepository } from "@/repositories/progress.repository";

const topicStatusEnum = z.enum([
  "not_started",
  "learning",
  "learned",
  "practiced",
  "revised",
  "mastered",
]);

const upsertProgressSchema = z.object({
  workspaceId: z.string().min(1),
  topicId: z.string().min(1),
  status: topicStatusEnum,
  startedAt: z.coerce.date().nullable().optional(),
  learnedAt: z.coerce.date().nullable().optional(),
  practicedAt: z.coerce.date().nullable().optional(),
  revisedAt: z.coerce.date().nullable().optional(),
  masteredAt: z.coerce.date().nullable().optional(),
  practiceAttempts: z.number().int().min(0).optional(),
  correctAnswers: z.number().int().min(0).optional(),
  incorrectAnswers: z.number().int().min(0).optional(),
  accuracy: z.number().int().min(0).max(10000).optional(),
  lastStudiedAt: z.coerce.date().nullable().optional(),
  lastRevisedAt: z.coerce.date().nullable().optional(),
  nextRevisionAt: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
});

async function resolveOwnedWorkspace(userId: string, workspaceId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: userWorkspaces.id })
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

  const progress = await topicProgressRepository.getProgressByWorkspaceId(getDb(), workspaceId);
  return NextResponse.json({ progress });
}

export async function PUT(request: Request) {
  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = upsertProgressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid topic progress input" }, { status: 400 });
    }

    const { workspaceId } = parsed.data;
    const owned = await resolveOwnedWorkspace(session.user.id, workspaceId);
    if (!owned) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const saved = await topicProgressRepository.upsertTopicProgress(getDb(), parsed.data);
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json({ error: "Failed to save topic progress" }, { status: 500 });
  }
}
