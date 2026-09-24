import { eq, desc } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import type { StudySessionCreateInput } from "@/domain/study";
import {
  studySessions,
  type StudySession,
} from "@/db/schema";

export const studySessionRepository = {
  async getSessionsForWorkspaceId(
    db: DatabaseInstance,
    workspaceId: string
  ): Promise<StudySession[]> {
    return db
      .select()
      .from(studySessions)
      .where(eq(studySessions.workspaceId, workspaceId))
      .orderBy(desc(studySessions.startedAt));
  },

  async createStudySession(
    db: DatabaseInstance,
    data: StudySessionCreateInput
  ): Promise<StudySession> {
    const now = new Date();
    const rows = await db
      .insert(studySessions)
      .values({
        ...data,
        id: data.id || `sess_${crypto.randomUUID()}`,
        createdAt: data.createdAt || now,
        updatedAt: now,
      })
      .returning();
    return rows[0];
  },
};
