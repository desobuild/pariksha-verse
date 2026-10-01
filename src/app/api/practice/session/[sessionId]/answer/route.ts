import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userWorkspaces } from "@/db/schema";
import { questionRepository } from "@/repositories/question.repository";
import { recordAnswerSchema } from "@/domain/practice-engine";
import { apiErrorResponse } from "@/lib/observability/api-error";

async function resolveOwnedWorkspace(userId: string, workspaceId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: userWorkspaces.id })
    .from(userWorkspaces)
    .where(and(eq(userWorkspaces.id, workspaceId), eq(userWorkspaces.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = recordAnswerSchema.safeParse({ ...body, sessionId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid answer input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { workspaceId, questionId, selectedOptionId } = parsed.data;

    const owned = await resolveOwnedWorkspace(session.user.id, workspaceId);
    if (!owned) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const db = getDb();
    await questionRepository.recordAnswer(db, {
      sessionId,
      workspaceId,
      questionId,
      selectedOptionId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Never echo internal exception details (Phase 14F).
    return apiErrorResponse({
      event: "api.practice.answer.failure",
      error,
      request,
      message: "Failed to record answer",
    });
  }
}
