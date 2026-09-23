import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { exams } from "./exams";
import { subjects } from "./subjects";
import { chapters } from "./chapters";
import { topics } from "./topics";
import { userWorkspaces } from "./workspaces";

export const resources = sqliteTable(
  "resources",
  {
    id: text("id").primaryKey(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").references(() => subjects.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
    topicId: text("topic_id").references(() => topics.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type", {
      enum: ["ncert", "textbook", "notes", "pyq", "formula_sheet", "revision", "reference"],
    }).notNull(),
    sourceName: text("source_name"),
    url: text("url"),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("resources_exam_id_idx").on(table.examId),
    index("resources_topic_id_idx").on(table.topicId),
  ]
);

export const savedResources = sqliteTable(
  "saved_resources",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => userWorkspaces.id, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    savedAt: integer("saved_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("saved_resources_workspace_resource_unique").on(
      table.workspaceId,
      table.resourceId
    ),
    index("saved_resources_workspace_id_idx").on(table.workspaceId),
  ]
);

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  exam: one(exams, {
    fields: [resources.examId],
    references: [exams.id],
  }),
  subject: one(subjects, {
    fields: [resources.subjectId],
    references: [subjects.id],
  }),
  chapter: one(chapters, {
    fields: [resources.chapterId],
    references: [chapters.id],
  }),
  topic: one(topics, {
    fields: [resources.topicId],
    references: [topics.id],
  }),
  savedBy: many(savedResources),
}));

export const savedResourcesRelations = relations(savedResources, ({ one }) => ({
  workspace: one(userWorkspaces, {
    fields: [savedResources.workspaceId],
    references: [userWorkspaces.id],
  }),
  resource: one(resources, {
    fields: [savedResources.resourceId],
    references: [resources.id],
  }),
}));

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type SavedResource = typeof savedResources.$inferSelect;
export type NewSavedResource = typeof savedResources.$inferInsert;
