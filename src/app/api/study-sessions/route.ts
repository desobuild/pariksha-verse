import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userWorkspaces } from "@/db/schema";
import { studySessionRepository } from "@/repositories/study-session.repository";

const createSessionSchema = z.object({
  workspaceId: z.string().min(1),
  topicId: z.string().min(1).nullable().optional(),
  plannerTaskId: z.string().min(1).nullable().optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable().optional(),
  durationMinutes: z.number().int().min(0).max(24 * 60),
  sessionType: z.string().min(1).max(50).optional(),
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

  const sessions = await studySessionRepository.getSessionsForWorkspaceId(getDb(), workspaceId);
  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid study session input" }, { status: 400 });
    }

    const { workspaceId } = parsed.data;
    const owned = await resolveOwnedWorkspace(session.user.id, workspaceId);
    if (!owned) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const created = await studySessionRepository.createStudySession(getDb(), {
      ...parsed.data,
      plannerTaskId: parsed.data.plannerTaskId ?? null,
      topicId: parsed.data.topicId ?? null,
      endedAt: parsed.data.endedAt ?? null,
      sessionType: parsed.data.sessionType ?? "focused",
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to save study session" }, { status: 500 });
  }
}
