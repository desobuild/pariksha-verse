import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userWorkspaces } from "@/db/schema";
import { revisionItemRepository } from "@/repositories/revision.repository";
import { getTopicMetadata } from "@/domain/dashboard";

const revisionStatusEnum = z.enum(["scheduled", "completed", "skipped"]);

const upsertRevisionSchema = z.object({
  id: z.string().min(1).optional(),
  workspaceId: z.string().min(1),
  topicId: z.string().min(1),
  revisionNumber: z.number().int().min(1).max(999),
  lastRevisedAt: z.coerce.date().nullable().optional(),
  nextRevisionAt: z.coerce.date().nullable().optional(),
  status: revisionStatusEnum.optional(),
});

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

  const revisionItems = await revisionItemRepository.getRevisionItemsForWorkspace(
    getDb(),
    workspaceId
  );
  return NextResponse.json({ revisionItems });
}

export async function PUT(request: Request) {
  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = upsertRevisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid revision item input" }, { status: 400 });
    }

    const { workspaceId, topicId } = parsed.data;
    const owned = await resolveOwnedWorkspace(session.user.id, workspaceId);
    if (!owned) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // The topic must belong to the workspace's exam taxonomy, blocking
    // cross-exam writes that would otherwise be invisible to the queue.
    if (!getTopicMetadata(topicId, owned.examAttemptId)) {
      return NextResponse.json({ error: "Topic not found for this exam" }, { status: 400 });
    }

    const saved = await revisionItemRepository.upsertRevisionItem(getDb(), parsed.data);
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json({ error: "Failed to save revision item" }, { status: 500 });
  }
}
