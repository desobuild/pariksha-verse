import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userWorkspaces } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ensureWorkspaceForUser } from "@/lib/workspaces/ensure-workspace";
import { apiErrorResponse } from "@/lib/observability/api-error";

const createWorkspaceSchema = z.object({
  examAttemptId: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  startedAt: z.union([z.string(), z.number(), z.date()]).optional(),
  /**
   * Phase 5 onboarding semantics: reuse an existing workspace for the same
   * exam attempt instead of creating a duplicate.
   */
  ensure: z.boolean().optional().default(false),
});

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    // Strictly enforce ownership by querying only matching authenticated userId
    const workspaces = await db
      .select()
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, session.user.id))
      .orderBy(desc(userWorkspaces.createdAt));

    return NextResponse.json({ workspaces });
  } catch (error) {
    return apiErrorResponse({
      event: "api.workspaces.failure",
      error,
      request,
      message: "Failed to load workspaces",
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
    const result = createWorkspaceSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid workspace input" }, { status: 400 });
    }

    const { examAttemptId, isActive, startedAt, ensure } = result.data;
    const db = getDb();

    // Deterministic find-or-create: deduplicates by (userId, examAttemptId)
    if (ensure) {
      const ensured = await ensureWorkspaceForUser(db, session.user.id, examAttemptId);
      if (!ensured.ok) {
        return NextResponse.json({ error: "Exam attempt not found" }, { status: 422 });
      }
      return NextResponse.json(ensured.workspace, {
        status: ensured.created ? 201 : 200,
      });
    }

    const newWorkspace = {
      id: `ws_${crypto.randomUUID()}`,
      userId: session.user.id, // Strictly derived from session, NOT client input
      examAttemptId,
      isActive,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(userWorkspaces).values(newWorkspace).returning();
    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error) {
    return apiErrorResponse({
      event: "api.workspaces.failure",
      error,
      request,
      message: "Failed to create workspace",
    });
  }
}
