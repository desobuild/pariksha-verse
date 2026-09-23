import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { examAttempts } from "./exams";

export const userWorkspaces = sqliteTable(
  "user_workspaces",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    examAttemptId: text("exam_attempt_id")
      .notNull()
      .references(() => examAttempts.id, { onDelete: "restrict" }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("user_workspaces_user_id_idx").on(table.userId),
    index("user_workspaces_exam_attempt_id_idx").on(table.examAttemptId),
  ]
);

export const userWorkspacesRelations = relations(userWorkspaces, ({ one }) => ({
  user: one(users, {
    fields: [userWorkspaces.userId],
    references: [users.id],
  }),
  examAttempt: one(examAttempts, {
    fields: [userWorkspaces.examAttemptId],
    references: [examAttempts.id],
  }),
}));

export type UserWorkspace = typeof userWorkspaces.$inferSelect;
export type NewUserWorkspace = typeof userWorkspaces.$inferInsert;
