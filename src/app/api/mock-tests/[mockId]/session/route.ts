import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userWorkspaces } from "@/db/schema";
import { mockTestRepository } from "@/repositories/mock-test.repository";
import { createMockSessionSchema, InsufficientQuestionsError } from "@/domain/mock-engine";
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

export async function POST(request: Request, { params }: { params: Promise<{ mockId: string }> }) {
  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mockId } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = createMockSessionSchema.safeParse({ ...body, mockTestId: mockId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid session input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { workspaceId, seed } = parsed.data;

    const owned = await resolveOwnedWorkspace(session.user.id, workspaceId);
    if (!owned) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const db = getDb();
    const mockSession = await mockTestRepository.createSession(db, {
      workspaceId,
      mockTestId: mockId,
      seed,
    });

    return NextResponse.json(mockSession);
  } catch (err) {
    if (err instanceof InsufficientQuestionsError) {
      return NextResponse.json(
        {
          error: err.message,
          required: err.required,
          available: err.available,
          missingSections: err.missingSections,
        },
        { status: 422 }
      );
    }
    // The 422 domain error above is the only case that carries detail; every
    // other failure is generic so internal exceptions never reach the client
    // (Phase 14F).
    return apiErrorResponse({
      event: "api.mock_tests.session.failure",
      error: err,
      request,
      message: "Failed to create mock test session",
    });
  }
}
