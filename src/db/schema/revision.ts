import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { userWorkspaces } from "./workspaces";
import { topics } from "./topics";

export const revisionItems = sqliteTable(
  "revision_items",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => userWorkspaces.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull().default(1),
    lastRevisedAt: integer("last_revised_at", { mode: "timestamp" }),
    nextRevisionAt: integer("next_revision_at", { mode: "timestamp" }),
    status: text("status", {
      enum: ["scheduled", "completed", "skipped"],
    })
      .notNull()
      .default("scheduled"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("revision_items_workspace_next_rev_idx").on(table.workspaceId, table.nextRevisionAt),
  ]
);

export const revisionItemsRelations = relations(revisionItems, ({ one }) => ({
  workspace: one(userWorkspaces, {
    fields: [revisionItems.workspaceId],
    references: [userWorkspaces.id],
  }),
  topic: one(topics, {
    fields: [revisionItems.topicId],
    references: [topics.id],
  }),
}));

export type RevisionItem = typeof revisionItems.$inferSelect;
export type NewRevisionItem = typeof revisionItems.$inferInsert;
