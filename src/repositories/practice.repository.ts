import { eq, desc, and } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import {
  practiceSessions,
  type PracticeSession,
} from "@/db/schema";
import type { PracticeSessionCreateInput } from "@/domain/practice";

/**
 * Server-side practice_sessions persistence (D1 via Drizzle).
 */
export const practiceRepository = {
  async getSessionsForWorkspaceId(
    db: DatabaseInstance,
    workspaceId: string
  ): Promise<PracticeSession[]> {
    return db
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.workspaceId, workspaceId))
      .orderBy(desc(practiceSessions.completedAt));
  },

  async getSessionsForTopicId(
    db: DatabaseInstance,
    workspaceId: string,
    topicId: string
  ): Promise<PracticeSession[]> {
    return db
      .select()
      .from(practiceSessions)
      .where(
        and(
          eq(practiceSessions.workspaceId, workspaceId),
          eq(practiceSessions.topicId, topicId)
        )
      )
      .orderBy(desc(practiceSessions.completedAt));
  },

  async createPracticeSession(
    db: DatabaseInstance,
    data: PracticeSessionCreateInput
  ): Promise<PracticeSession> {
    const now = new Date();
    const rows = await db
      .insert(practiceSessions)
      .values({
        ...data,
        id: data.id || `prac_${crypto.randomUUID()}`,
        completedAt: data.completedAt instanceof Date ? data.completedAt : new Date(data.completedAt),
        createdAt: data.createdAt instanceof Date ? data.createdAt : now,
        updatedAt: now,
      })
      .returning();
    return rows[0];
  },
};
