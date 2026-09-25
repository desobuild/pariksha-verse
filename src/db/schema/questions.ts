import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { exams } from "./exams";
import { subjects } from "./subjects";
import { chapters } from "./chapters";
import { topics } from "./topics";
import { userWorkspaces } from "./workspaces";

export const QUESTION_TYPES = ["single_choice"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export const QUESTION_PROVENANCE = [
  "authored",
  "licensed",
  "official",
  "public_domain",
  "open_license",
  "fixture",
] as const;
export type QuestionProvenance = (typeof QUESTION_PROVENANCE)[number];

export const QUESTION_STATUSES = ["active", "draft", "archived"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const PRACTICE_SCOPE_TYPES = ["topic", "subject", "mixed"] as const;
export type PracticeScopeType = (typeof PRACTICE_SCOPE_TYPES)[number];

export const QUESTION_SESSION_STATUSES = ["in_progress", "completed", "abandoned"] as const;
export type QuestionSessionStatus = (typeof QUESTION_SESSION_STATUSES)[number];

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    type: text("type", { enum: ["single_choice"] })
      .notNull()
      .default("single_choice"),
    difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] })
      .notNull()
      .default("medium"),
    explanation: text("explanation"),
    source: text("source"),
    sourceUrl: text("source_url"),
    attribution: text("attribution"),
    license: text("license"),
    externalId: text("external_id"),
    year: integer("year"),
    provenance: text("provenance", {
      enum: ["authored", "licensed", "official", "public_domain", "open_license", "fixture"],
    })
      .notNull()
      .default("fixture"),
    status: text("status", { enum: ["active", "draft", "archived"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("questions_topic_status_idx").on(table.topicId, table.status),
    index("questions_subject_status_idx").on(table.subjectId, table.status),
    index("questions_exam_status_idx").on(table.examId, table.status),
  ]
);

export const questionOptions = sqliteTable(
  "question_options",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    displayOrder: integer("display_order").notNull().default(0),
    optionKey: text("option_key").notNull(),
    text: text("text").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    index("question_options_question_order_idx").on(table.questionId, table.displayOrder),
  ]
);

export const questionSessions = sqliteTable(
  "question_sessions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => userWorkspaces.id, { onDelete: "cascade" }),
    scopeType: text("scope_type", { enum: ["topic", "subject", "mixed"] }).notNull(),
    scopeId: text("scope_id").notNull(),
    totalQuestions: integer("total_questions").notNull().default(0),
    status: text("status", { enum: ["in_progress", "completed", "abandoned"] })
      .notNull()
      .default("in_progress"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("question_sessions_workspace_status_idx").on(table.workspaceId, table.status),
    index("question_sessions_workspace_completed_idx").on(table.workspaceId, table.completedAt),
  ]
);

export const questionAttempts = sqliteTable(
  "question_attempts",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => questionSessions.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedOptionId: text("selected_option_id")
      .references(() => questionOptions.id, { onDelete: "set null" }),
    isCorrect: integer("is_correct", { mode: "boolean" }),
    displayOrder: integer("display_order").notNull().default(0),
    answeredAt: integer("answered_at", { mode: "timestamp" }),
  },
  (table) => [
    index("question_attempts_session_order_idx").on(table.sessionId, table.displayOrder),
    index("question_attempts_question_idx").on(table.questionId),
  ]
);

export const questionsRelations = relations(questions, ({ one, many }) => ({
  exam: one(exams, {
    fields: [questions.examId],
    references: [exams.id],
  }),
  subject: one(subjects, {
    fields: [questions.subjectId],
    references: [subjects.id],
  }),
  chapter: one(chapters, {
    fields: [questions.chapterId],
    references: [chapters.id],
  }),
  topic: one(topics, {
    fields: [questions.topicId],
    references: [topics.id],
  }),
  options: many(questionOptions),
  attempts: many(questionAttempts),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
}));

export const questionSessionsRelations = relations(questionSessions, ({ one, many }) => ({
  workspace: one(userWorkspaces, {
    fields: [questionSessions.workspaceId],
    references: [userWorkspaces.id],
  }),
  attempts: many(questionAttempts),
}));

export const questionAttemptsRelations = relations(questionAttempts, ({ one }) => ({
  session: one(questionSessions, {
    fields: [questionAttempts.sessionId],
    references: [questionSessions.id],
  }),
  question: one(questions, {
    fields: [questionAttempts.questionId],
    references: [questions.id],
  }),
  selectedOption: one(questionOptions, {
    fields: [questionAttempts.selectedOptionId],
    references: [questionOptions.id],
  }),
}));

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type NewQuestionOption = typeof questionOptions.$inferInsert;
export type QuestionSession = typeof questionSessions.$inferSelect;
export type NewQuestionSession = typeof questionSessions.$inferInsert;
export type QuestionAttempt = typeof questionAttempts.$inferSelect;
export type NewQuestionAttempt = typeof questionAttempts.$inferInsert;
