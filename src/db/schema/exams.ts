import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import type { ExamScoringConfig, ExamMetadata } from "@/types/exam-config";

export const exams = sqliteTable(
  "exams",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    status: text("status", { enum: ["active", "draft", "archived"] })
      .notNull()
      .default("active"),
    metadata: text("metadata", { mode: "json" }).$type<ExamMetadata>(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("exams_slug_unique").on(table.slug),
  ]
);

export const examAttempts = sqliteTable(
  "exam_attempts",
  {
    id: text("id").primaryKey(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    examDate: integer("exam_date", { mode: "timestamp" }),
    status: text("status", { enum: ["upcoming", "active", "completed", "archived"] })
      .notNull()
      .default("upcoming"),
    scoringConfig: text("scoring_config", { mode: "json" }).$type<ExamScoringConfig>(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("exam_attempts_exam_id_slug_unique").on(table.examId, table.slug),
    index("exam_attempts_exam_id_idx").on(table.examId),
  ]
);

export const examsRelations = relations(exams, ({ many }) => ({
  attempts: many(examAttempts),
}));

export const examAttemptsRelations = relations(examAttempts, ({ one }) => ({
  exam: one(exams, {
    fields: [examAttempts.examId],
    references: [exams.id],
  }),
}));

export type Exam = typeof exams.$inferSelect;
export type NewExam = typeof exams.$inferInsert;
export type ExamAttempt = typeof examAttempts.$inferSelect;
export type NewExamAttempt = typeof examAttempts.$inferInsert;
