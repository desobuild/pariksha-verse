import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userWorkspaces } from "@/db/schema";
import { mockTestRepository } from "@/repositories/mock-test.repository";
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

export async function GET(request: Request, { params }: { params: Promise<{ mockId: string }> }) {
  try {
    const session = await getSession(request);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mockId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const owned = await resolveOwnedWorkspace(session.user.id, workspaceId);
    if (!owned) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const db = getDb();
    const allResults = await mockTestRepository.getAllResultsForWorkspace(db, workspaceId);
    const match = allResults.find((r) => r.mockTestId === mockId);
    if (!match) {
      return NextResponse.json({ error: "Mock test result not found" }, { status: 404 });
    }

    return NextResponse.json(match);
  } catch (error) {
    return apiErrorResponse({
      event: "api.mock_tests.result.failure",
      error,
      request,
      message: "Failed to load mock test result",
    });
  }
}
