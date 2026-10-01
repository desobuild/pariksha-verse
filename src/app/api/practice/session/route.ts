import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userWorkspaces } from "@/db/schema";
import { questionRepository } from "@/repositories/question.repository";
import { createQuestionSessionSchema } from "@/domain/practice-engine";
import { getTopicMetadata, getSubjectTaxonomySummary } from "@/domain/dashboard";
import { apiErrorResponse } from "@/lib/observability/api-error";

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
  try {
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

    const db = getDb();
    const sessions = await questionRepository.getRecentQuestionSessions(db, workspaceId);
    return NextResponse.json({ sessions });
  } catch (error) {
    return apiErrorResponse({
      event: "api.practice.session.failure",
      error,
      request,
      message: "Failed to load practice session",
    });
  }
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createQuestionSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid session input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { workspaceId, scope, questionCount, seed } = parsed.data;

    const owned = await resolveOwnedWorkspace(session.user.id, workspaceId);
    if (!owned) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Validate scope belongs to workspace exam attempt taxonomy
    if (scope.type === "topic") {
      const topicMeta = getTopicMetadata(scope.topicId, owned.examAttemptId);
      if (!topicMeta) {
        return NextResponse.json({ error: "Topic not found for this exam" }, { status: 400 });
      }
    } else if (scope.type === "subject") {
      const subjects = getSubjectTaxonomySummary(owned.examAttemptId);
      const exists = subjects.some(
        (s) => s.id === scope.subjectId || s.slug.toLowerCase() === scope.subjectId.toLowerCase()
      );
      if (!exists) {
        return NextResponse.json({ error: "Subject not found for this exam" }, { status: 400 });
      }
    }

    const db = getDb();
    const created = await questionRepository.createSession(db, {
      workspaceId,
      scope,
      questionCount,
      options: { seed },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    // Never echo internal exception details (Phase 14F): database/ORM errors
    // must not reach the client.
    return apiErrorResponse({
      event: "api.practice.session.failure",
      error,
      request,
      message: "Failed to create practice session",
    });
  }
}
