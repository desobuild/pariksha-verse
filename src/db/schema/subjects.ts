import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { exams } from "./exams";

export const subjects = sqliteTable(
  "subjects",
  {
    id: text("id").primaryKey(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("subjects_exam_id_slug_unique").on(table.examId, table.slug),
    index("subjects_exam_id_idx").on(table.examId),
  ]
);

export const subjectsRelations = relations(subjects, ({ one }) => ({
  exam: one(exams, {
    fields: [subjects.examId],
    references: [exams.id],
  }),
}));

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
