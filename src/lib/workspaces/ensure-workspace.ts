import { and, eq } from "drizzle-orm";
import { userWorkspaces, examAttempts, type UserWorkspace } from "@/db/schema";
import type { DatabaseInstance } from "@/db";

export type EnsureWorkspaceResult =
  | { ok: true; workspace: UserWorkspace; created: boolean }
  | { ok: false; error: "attempt_not_found" };

/**
 * Server-side deterministic workspace find-or-create (Phase 5 onboarding).
 *
 * - Rejects exam attempt IDs that do not exist in the database.
 * - Reuses an existing workspace for the same (user, attempt) pair instead of
 *   duplicating it — safe across refreshes, retries, and double clicks.
 * - Establishes the resolved workspace as the user's active workspace.
 */
export async function ensureWorkspaceForUser(
  db: DatabaseInstance,
  userId: string,
  examAttemptId: string
): Promise<EnsureWorkspaceResult> {
  // Never trust client-provided attempt IDs: must exist in exam_attempts
  const attemptRows = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, examAttemptId))
    .limit(1);
  if (!attemptRows[0]) {
    return { ok: false, error: "attempt_not_found" };
  }

  const existingRows = await db
    .select()
    .from(userWorkspaces)
    .where(
      and(
        eq(userWorkspaces.userId, userId),
        eq(userWorkspaces.examAttemptId, examAttemptId)
      )
    )
    .limit(1);

  if (existingRows[0]) {
    const existing = existingRows[0];
    if (!existing.isActive) {
      await db
        .update(userWorkspaces)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(userWorkspaces.userId, userId));
      await db
        .update(userWorkspaces)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(userWorkspaces.id, existing.id));
      existing.isActive = true;
    }
    return { ok: true, workspace: existing, created: false };
  }

  const newId = `ws_${crypto.randomUUID()}`;
  await db
    .update(userWorkspaces)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(userWorkspaces.userId, userId));

  const inserted = await db
    .insert(userWorkspaces)
    .values({
      id: newId,
      userId,
      examAttemptId,
      isActive: true,
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return { ok: true, workspace: inserted[0], created: true };
}
