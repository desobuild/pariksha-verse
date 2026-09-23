import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { userWorkspaces } from "./workspaces";
import { topics } from "./topics";

export const userTopicProgress = sqliteTable(
  "user_topic_progress",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => userWorkspaces.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["not_started", "learning", "learned", "practiced", "revised", "mastered"],
    })
      .notNull()
      .default("not_started"),
    startedAt: integer("started_at", { mode: "timestamp" }),
    learnedAt: integer("learned_at", { mode: "timestamp" }),
    practicedAt: integer("practiced_at", { mode: "timestamp" }),
    revisedAt: integer("revised_at", { mode: "timestamp" }),
    masteredAt: integer("mastered_at", { mode: "timestamp" }),
    practiceAttempts: integer("practice_attempts").notNull().default(0),
    correctAnswers: integer("correct_answers").notNull().default(0),
    incorrectAnswers: integer("incorrect_answers").notNull().default(0),
    // Accuracy stored in basis points (0 - 10000, where 10000 = 100.00%) to avoid float drift
    accuracy: integer("accuracy").notNull().default(0),
    lastStudiedAt: integer("last_studied_at", { mode: "timestamp" }),
    lastRevisedAt: integer("last_revised_at", { mode: "timestamp" }),
    nextRevisionAt: integer("next_revision_at", { mode: "timestamp" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("user_topic_progress_workspace_topic_unique").on(table.workspaceId, table.topicId),
    index("user_topic_progress_workspace_id_idx").on(table.workspaceId),
    index("user_topic_progress_topic_id_idx").on(table.topicId),
  ]
);

export const userTopicProgressRelations = relations(userTopicProgress, ({ one }) => ({
  workspace: one(userWorkspaces, {
    fields: [userTopicProgress.workspaceId],
    references: [userWorkspaces.id],
  }),
  topic: one(topics, {
    fields: [userTopicProgress.topicId],
    references: [topics.id],
  }),
}));

export type UserTopicProgress = typeof userTopicProgress.$inferSelect;
export type NewUserTopicProgress = typeof userTopicProgress.$inferInsert;
