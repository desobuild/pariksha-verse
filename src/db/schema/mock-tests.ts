import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { userWorkspaces } from "./workspaces";

export const mockTests = sqliteTable(
  "mock_tests",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => userWorkspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type", {
      enum: ["full_syllabus", "subject", "chapter", "custom"],
    }).notNull(),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
    durationMinutes: integer("duration_minutes").notNull(),
    source: text("source"),
    externalUrl: text("external_url"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("mock_tests_workspace_scheduled_idx").on(table.workspaceId, table.scheduledAt),
  ]
);

export const mockTestResults = sqliteTable(
  "mock_test_results",
  {
    id: text("id").primaryKey(),
    mockTestId: text("mock_test_id")
      .notNull()
      .references(() => mockTests.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    totalMarks: integer("total_marks").notNull(),
    correct: integer("correct").notNull().default(0),
    incorrect: integer("incorrect").notNull().default(0),
    unattempted: integer("unattempted").notNull().default(0),
    // Accuracy stored in basis points (0 - 10000)
    accuracy: integer("accuracy").notNull().default(0),
    completedAt: integer("completed_at", { mode: "timestamp" }).notNull(),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("mock_test_results_mock_test_id_idx").on(table.mockTestId),
  ]
);

export const mockTestsRelations = relations(mockTests, ({ one, many }) => ({
  workspace: one(userWorkspaces, {
    fields: [mockTests.workspaceId],
    references: [userWorkspaces.id],
  }),
  results: many(mockTestResults),
}));

export const mockTestResultsRelations = relations(mockTestResults, ({ one }) => ({
  mockTest: one(mockTests, {
    fields: [mockTestResults.mockTestId],
    references: [mockTests.id],
  }),
}));

export type MockTest = typeof mockTests.$inferSelect;
export type NewMockTest = typeof mockTests.$inferInsert;
export type MockTestResult = typeof mockTestResults.$inferSelect;
export type NewMockTestResult = typeof mockTestResults.$inferInsert;
