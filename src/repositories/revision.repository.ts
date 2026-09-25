import { eq, and } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import type { RevisionItemUpsertInput } from "@/domain/revision";
import {
  revisionItems,
  type RevisionItem,
} from "@/db/schema";

/**
 * Server-side revision_items persistence (D1 via Drizzle).
 * `revision_items` has no unique constraint on (workspace_id, topic_id), so
 * upserts resolve the existing row explicitly — guaranteeing one row per
 * workspace topic and therefore no duplicate revision records.
 */
export const revisionItemRepository = {
  async getRevisionItemsForWorkspace(
    db: DatabaseInstance,
    workspaceId: string
  ): Promise<RevisionItem[]> {
    return db
      .select()
      .from(revisionItems)
      .where(eq(revisionItems.workspaceId, workspaceId))
      .orderBy(revisionItems.createdAt);
  },

  async getRevisionItemForTopic(
    db: DatabaseInstance,
    workspaceId: string,
    topicId: string
  ): Promise<RevisionItem | null> {
    const rows = await db
      .select()
      .from(revisionItems)
      .where(
        and(
          eq(revisionItems.workspaceId, workspaceId),
          eq(revisionItems.topicId, topicId)
        )
      )
      .limit(1);
    return rows[0] || null;
  },

  async upsertRevisionItem(
    db: DatabaseInstance,
    data: RevisionItemUpsertInput
  ): Promise<RevisionItem> {
    const existing = await revisionItemRepository.getRevisionItemForTopic(
      db,
      data.workspaceId,
      data.topicId
    );
    const now = new Date();

    if (existing) {
      const rows = await db
        .update(revisionItems)
        .set({
          revisionNumber: data.revisionNumber,
          lastRevisedAt: data.lastRevisedAt ?? null,
          nextRevisionAt: data.nextRevisionAt ?? null,
          status: data.status ?? "scheduled",
          updatedAt: now,
        })
        .where(eq(revisionItems.id, existing.id))
        .returning();
      return rows[0];
    }

    const rows = await db
      .insert(revisionItems)
      .values({
        ...data,
        id: data.id || `rev_${crypto.randomUUID()}`,
        createdAt: data.createdAt || now,
        updatedAt: now,
      })
      .returning();
    return rows[0];
  },
};
