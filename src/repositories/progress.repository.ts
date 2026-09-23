import { eq, and } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import {
  userTopicProgress,
  type UserTopicProgress,
  type NewUserTopicProgress,
} from "@/db/schema";

export const topicProgressRepository = {
  async getTopicProgress(
    db: DatabaseInstance,
    workspaceId: string,
    topicId: string
  ): Promise<UserTopicProgress | null> {
    const rows = await db
      .select()
      .from(userTopicProgress)
      .where(
        and(
          eq(userTopicProgress.workspaceId, workspaceId),
          eq(userTopicProgress.topicId, topicId)
        )
      )
      .limit(1);
    return rows[0] || null;
  },

  async getProgressByWorkspaceId(
    db: DatabaseInstance,
    workspaceId: string
  ): Promise<UserTopicProgress[]> {
    return db
      .select()
      .from(userTopicProgress)
      .where(eq(userTopicProgress.workspaceId, workspaceId))
      .orderBy(userTopicProgress.createdAt);
  },

  async upsertTopicProgress(
    db: DatabaseInstance,
    data: NewUserTopicProgress
  ): Promise<UserTopicProgress> {
    const now = new Date();
    const rows = await db
      .insert(userTopicProgress)
      .values({
        ...data,
        createdAt: data.createdAt || now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userTopicProgress.workspaceId, userTopicProgress.topicId],
        set: {
          status: data.status,
          startedAt: data.startedAt,
          learnedAt: data.learnedAt,
          practicedAt: data.practicedAt,
          revisedAt: data.revisedAt,
          masteredAt: data.masteredAt,
          practiceAttempts: data.practiceAttempts,
          correctAnswers: data.correctAnswers,
          incorrectAnswers: data.incorrectAnswers,
          accuracy: data.accuracy,
          lastStudiedAt: data.lastStudiedAt,
          lastRevisedAt: data.lastRevisedAt,
          nextRevisionAt: data.nextRevisionAt,
          notes: data.notes,
          updatedAt: now,
        },
      })
      .returning();
    return rows[0];
  },
};
