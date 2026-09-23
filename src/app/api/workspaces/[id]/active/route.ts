import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userWorkspaces } from "@/db/schema";

/**
 * Establishes a workspace owned by the session user as the active workspace.
 * Ownership is enforced on every statement — foreign workspace IDs are rejected.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const ownedRows = await db
    .select()
    .from(userWorkspaces)
    .where(and(eq(userWorkspaces.id, id), eq(userWorkspaces.userId, session.user.id)))
    .limit(1);

  if (!ownedRows[0]) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  await db
    .update(userWorkspaces)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(userWorkspaces.userId, session.user.id));

  await db
    .update(userWorkspaces)
    .set({ isActive: true, updatedAt: new Date() })
    .where(and(eq(userWorkspaces.id, id), eq(userWorkspaces.userId, session.user.id)));

  return NextResponse.json({ success: true, workspaceId: id });
}
