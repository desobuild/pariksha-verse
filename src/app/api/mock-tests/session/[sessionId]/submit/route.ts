import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userWorkspaces } from "@/db/schema";
import { mockTestRepository } from "@/repositories/mock-test.repository";
import { submitMockSessionSchema } from "@/domain/mock-engine";
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

export async function POST(
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
    const parsed = submitMockSessionSchema.safeParse({ ...body, sessionId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid submission input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { workspaceId, submissionStatus, answers, markedForReview, completedAt } = parsed.data;

    const owned = await resolveOwnedWorkspace(session.user.id, workspaceId);
    if (!owned) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const db = getDb();
    const result = await mockTestRepository.submitSession(db, {
      workspaceId,
      sessionId,
      submissionStatus,
      answers,
      markedForReview,
      completedAt,
    });

    return NextResponse.json(result);
  } catch (error) {
    // Never echo internal exception details (Phase 14F).
    return apiErrorResponse({
      event: "api.mock_tests.submit.failure",
      error,
      request,
      message: "Failed to submit mock test session",
    });
  }
}
