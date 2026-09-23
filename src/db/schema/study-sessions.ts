import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { userWorkspaces } from "./workspaces";
import { plannerTasks } from "./planner";
import { topics } from "./topics";

export const studySessions = sqliteTable(
  "study_sessions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => userWorkspaces.id, { onDelete: "cascade" }),
    plannerTaskId: text("planner_task_id").references(() => plannerTasks.id, {
      onDelete: "set null",
    }),
    topicId: text("topic_id").references(() => topics.id, { onDelete: "set null" }),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp" }),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    sessionType: text("session_type").notNull().default("focused"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("study_sessions_workspace_id_idx").on(table.workspaceId),
  ]
);

export const studySessionsRelations = relations(studySessions, ({ one }) => ({
  workspace: one(userWorkspaces, {
    fields: [studySessions.workspaceId],
    references: [userWorkspaces.id],
  }),
  plannerTask: one(plannerTasks, {
    fields: [studySessions.plannerTaskId],
    references: [plannerTasks.id],
  }),
  topic: one(topics, {
    fields: [studySessions.topicId],
    references: [topics.id],
  }),
}));

export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;
