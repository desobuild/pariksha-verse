import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { userWorkspaces } from "./workspaces";
import { exams } from "./exams";

export const MOCK_TEST_TYPES = ["full_syllabus", "subject", "chapter", "custom"] as const;
export type MockTestType = (typeof MOCK_TEST_TYPES)[number];

export const MOCK_TEST_STATUSES = ["draft", "active", "archived"] as const;
export type MockTestStatus = (typeof MOCK_TEST_STATUSES)[number];

export const MOCK_SESSION_STATUSES = [
  "in_progress",
  "completed",
  "auto_submitted",
  "abandoned",
] as const;
export type MockSessionStatus = (typeof MOCK_SESSION_STATUSES)[number];

export const MOCK_PROVENANCES = ["fixture", "authored", "official", "sample"] as const;
export type MockProvenance = (typeof MOCK_PROVENANCES)[number];

export const mockTests = sqliteTable(
  "mock_tests",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => userWorkspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type", {
      enum: ["full_syllabus", "subject", "chapter", "custom"],
    }).notNull(),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
    durationMinutes: integer("duration_minutes").notNull(),
    totalQuestions: integer("total_questions").notNull().default(0),
    examId: text("exam_id").references(() => exams.id, { onDelete: "cascade" }),
    markingScheme: text("marking_scheme"), // JSON: MockMarkingScheme
    sections: text("sections"), // JSON: MockSectionConfig[]
    questionSelectionConfig: text("question_selection_config"), // JSON
    status: text("status", { enum: ["draft", "active", "archived"] })
      .notNull()
      .default("active"),
    provenance: text("provenance", {
      enum: ["fixture", "authored", "official", "sample"],
    })
      .notNull()
      .default("fixture"),
    source: text("source"),
    externalUrl: text("external_url"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("mock_tests_workspace_scheduled_idx").on(table.workspaceId, table.scheduledAt),
  ]
);

export const mockTestSessions = sqliteTable(
  "mock_test_sessions",
  {
    id: text("id").primaryKey(),
    mockTestId: text("mock_test_id")
      .notNull()
      .references(() => mockTests.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => userWorkspaces.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["in_progress", "completed", "auto_submitted", "abandoned"],
    })
      .notNull()
      .default("in_progress"),
    questionIds: text("question_ids").notNull(), // JSON array
    selectedAnswers: text("selected_answers").notNull().default("{}"), // JSON Record<questionId, optionId|null>
    markedForReview: text("marked_for_review").notNull().default("[]"), // JSON string[]
    currentIndex: integer("current_index").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("mock_test_sessions_workspace_status_idx").on(table.workspaceId, table.status),
    index("mock_test_sessions_mock_test_id_idx").on(table.mockTestId),
  ]
);

export const mockTestResults = sqliteTable(
  "mock_test_results",
  {
    id: text("id").primaryKey(),
    mockTestId: text("mock_test_id")
      .notNull()
      .references(() => mockTests.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => mockTestSessions.id, {
      onDelete: "set null",
    }),
    score: integer("score").notNull(),
    totalMarks: integer("total_marks").notNull(),
    correct: integer("correct").notNull().default(0),
    incorrect: integer("incorrect").notNull().default(0),
    unattempted: integer("unattempted").notNull().default(0),
    // Accuracy stored in basis points (0 - 10000)
    accuracy: integer("accuracy").notNull().default(0),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    submissionStatus: text("submission_status", {
      enum: ["completed", "auto_submitted"],
    })
      .notNull()
      .default("completed"),
    sectionResults: text("section_results"), // JSON: MockSectionResult[]
    questionResults: text("question_results"), // JSON: MockQuestionReviewItem[]
    completedAt: integer("completed_at", { mode: "timestamp" }).notNull(),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("mock_test_results_mock_test_id_idx").on(table.mockTestId),
    index("mock_test_results_session_id_idx").on(table.sessionId),
  ]
);

export const mockTestsRelations = relations(mockTests, ({ one, many }) => ({
  workspace: one(userWorkspaces, {
    fields: [mockTests.workspaceId],
    references: [userWorkspaces.id],
  }),
  results: many(mockTestResults),
  sessions: many(mockTestSessions),
}));

export const mockTestSessionsRelations = relations(mockTestSessions, ({ one }) => ({
  mockTest: one(mockTests, {
    fields: [mockTestSessions.mockTestId],
    references: [mockTests.id],
  }),
  workspace: one(userWorkspaces, {
    fields: [mockTestSessions.workspaceId],
    references: [userWorkspaces.id],
  }),
}));

export const mockTestResultsRelations = relations(mockTestResults, ({ one }) => ({
  mockTest: one(mockTests, {
    fields: [mockTestResults.mockTestId],
    references: [mockTests.id],
  }),
  session: one(mockTestSessions, {
    fields: [mockTestResults.sessionId],
    references: [mockTestSessions.id],
  }),
}));

export type MockTest = typeof mockTests.$inferSelect;
export type NewMockTest = typeof mockTests.$inferInsert;
export type MockTestSession = typeof mockTestSessions.$inferSelect;
export type NewMockTestSession = typeof mockTestSessions.$inferInsert;
export type MockTestResult = typeof mockTestResults.$inferSelect;
export type NewMockTestResult = typeof mockTestResults.$inferInsert;
