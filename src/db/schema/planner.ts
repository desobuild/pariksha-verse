import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { userWorkspaces } from "./workspaces";
import { subjects } from "./subjects";
import { chapters } from "./chapters";
import { topics } from "./topics";

export const plannerTasks = sqliteTable(
  "planner_tasks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => userWorkspaces.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["study", "practice", "revision", "mock_test", "custom"],
    }).notNull(),
    title: text("title").notNull(),
    subjectId: text("subject_id").references(() => subjects.id, { onDelete: "set null" }),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    topicId: text("topic_id").references(() => topics.id, { onDelete: "set null" }),
    scheduledDate: text("scheduled_date").notNull(),
    startTime: text("start_time"),
    durationMinutes: integer("duration_minutes").notNull(),
    status: text("status", {
      enum: ["upcoming", "in_progress", "completed", "skipped"],
    })
      .notNull()
      .default("upcoming"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("planner_tasks_workspace_scheduled_idx").on(table.workspaceId, table.scheduledDate),
  ]
);

export const plannerTasksRelations = relations(plannerTasks, ({ one }) => ({
  workspace: one(userWorkspaces, {
    fields: [plannerTasks.workspaceId],
    references: [userWorkspaces.id],
  }),
  subject: one(subjects, {
    fields: [plannerTasks.subjectId],
    references: [subjects.id],
  }),
  chapter: one(chapters, {
    fields: [plannerTasks.chapterId],
    references: [chapters.id],
  }),
  topic: one(topics, {
    fields: [plannerTasks.topicId],
    references: [topics.id],
  }),
}));

export type PlannerTask = typeof plannerTasks.$inferSelect;
export type NewPlannerTask = typeof plannerTasks.$inferInsert;
