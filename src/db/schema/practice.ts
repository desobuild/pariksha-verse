import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { userWorkspaces } from "./workspaces";
import { topics } from "./topics";

export const practiceSessions = sqliteTable(
  "practice_sessions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => userWorkspaces.id, { onDelete: "cascade" }),
    topicId: text("topic_id").references(() => topics.id, { onDelete: "set null" }),
    questionCount: integer("question_count").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    incorrect: integer("incorrect").notNull().default(0),
    unattempted: integer("unattempted").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    completedAt: integer("completed_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("practice_sessions_workspace_completed_idx").on(table.workspaceId, table.completedAt),
  ]
);

export const practiceSessionsRelations = relations(practiceSessions, ({ one }) => ({
  workspace: one(userWorkspaces, {
    fields: [practiceSessions.workspaceId],
    references: [userWorkspaces.id],
  }),
  topic: one(topics, {
    fields: [practiceSessions.topicId],
    references: [topics.id],
  }),
}));

export type PracticeSession = typeof practiceSessions.$inferSelect;
export type NewPracticeSession = typeof practiceSessions.$inferInsert;
