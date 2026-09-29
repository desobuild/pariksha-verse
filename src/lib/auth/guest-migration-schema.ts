import { z } from "zod";

const dateOrTimestampSchema = z.union([
  z.string().datetime({ offset: true }),
  z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/),
  z.number().int().positive(),
  z.date(),
]);

export const guestWorkspaceMigrationSchema = z.object({
  id: z.string().max(128).optional(),
  examAttemptId: z.string().min(1).max(128),
  isActive: z.boolean().optional(),
  startedAt: dateOrTimestampSchema.optional(),
  createdAt: dateOrTimestampSchema.optional(),
});

export const guestTopicProgressMigrationSchema = z.object({
  workspaceId: z.string().min(1).max(128),
  topicId: z.string().min(1).max(128),
  status: z
    .enum(["not_started", "learning", "learned", "practiced", "revised", "mastered"])
    .optional(),
  practiceAttempts: z.number().int().min(0).max(50000).optional(),
  correctAnswers: z.number().int().min(0).max(50000).optional(),
  incorrectAnswers: z.number().int().min(0).max(50000).optional(),
  accuracy: z.number().int().min(0).max(10000).optional(),
  lastStudiedAt: dateOrTimestampSchema.optional().nullable(),
  lastRevisedAt: dateOrTimestampSchema.optional().nullable(),
  nextRevisionAt: dateOrTimestampSchema.optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  createdAt: dateOrTimestampSchema.optional(),
});

export const guestPlannerTaskMigrationSchema = z.object({
  workspaceId: z.string().min(1).max(128),
  title: z.string().min(1).max(300),
  subjectId: z.string().max(128).optional().nullable(),
  chapterId: z.string().max(128).optional().nullable(),
  topicId: z.string().max(128).optional().nullable(),
  scheduledDate: z.string().min(1).max(30),
  startTime: z.string().max(30).optional().nullable(),
  durationMinutes: z.number().int().min(0).max(1440).optional(),
  type: z.enum(["study", "practice", "revision", "mock_test", "custom"]).optional(),
  status: z.enum(["upcoming", "in_progress", "completed", "skipped"]).optional(),
  createdAt: dateOrTimestampSchema.optional(),
});

export const guestStudySessionMigrationSchema = z.object({
  id: z.string().max(128).optional(),
  workspaceId: z.string().min(1).max(128),
  plannerTaskId: z.string().max(128).optional().nullable(),
  topicId: z.string().max(128).optional().nullable(),
  durationMinutes: z.number().int().min(1).max(1440),
  sessionType: z.enum(["focused", "pomodoro", "review"]).optional(),
  startedAt: dateOrTimestampSchema,
  endedAt: dateOrTimestampSchema.optional().nullable(),
  createdAt: dateOrTimestampSchema.optional(),
});

export const guestRevisionItemMigrationSchema = z.object({
  workspaceId: z.string().min(1).max(128),
  topicId: z.string().min(1).max(128),
  revisionNumber: z.number().int().min(1).max(100).optional(),
  nextRevisionAt: dateOrTimestampSchema.optional().nullable(),
  lastRevisedAt: dateOrTimestampSchema.optional().nullable(),
  status: z.enum(["scheduled", "due", "completed", "skipped"]).optional(),
  createdAt: dateOrTimestampSchema.optional(),
});

export const guestPracticeSessionMigrationSchema = z.object({
  id: z.string().max(128).optional(),
  workspaceId: z.string().min(1).max(128),
  topicId: z.string().max(128).optional().nullable(),
  questionCount: z.number().int().min(0).max(1000).optional(),
  correct: z.number().int().min(0).max(1000).optional(),
  incorrect: z.number().int().min(0).max(1000).optional(),
  unattempted: z.number().int().min(0).max(1000).optional(),
  durationMinutes: z.number().int().min(0).max(1440).optional(),
  completedAt: dateOrTimestampSchema.optional(),
  createdAt: dateOrTimestampSchema.optional(),
});

export const guestSavedResourceMigrationSchema = z.object({
  workspaceId: z.string().min(1).max(128),
  resourceId: z.string().min(1).max(128),
  savedAt: dateOrTimestampSchema.optional(),
});

export const guestMockTestMigrationSchema = z.object({
  id: z.string().max(128).optional(),
  workspaceId: z.string().min(1).max(128),
  title: z.string().min(1).max(300),
  // Must accept every mock type the app stores locally (see the mock_tests
  // column enum in src/db/schema/mock-tests.ts): fixture/bundled mocks use
  // "subject", and rejecting one entry here fails the WHOLE migration payload.
  type: z.enum(["full_syllabus", "subject", "chapter", "part_syllabus", "custom"]).optional(),
  scheduledAt: dateOrTimestampSchema.optional().nullable(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  source: z.string().max(200).optional().nullable(),
  externalUrl: z.string().url().max(500).optional().nullable(),
  createdAt: dateOrTimestampSchema.optional(),
});

export const guestMockTestResultMigrationSchema = z.object({
  id: z.string().max(128).optional(),
  mockTestId: z.string().min(1).max(128),
  score: z.number().int().min(-720).max(1000).optional(),
  totalMarks: z.number().int().min(1).max(1000).optional(),
  correct: z.number().int().min(0).max(500).optional(),
  incorrect: z.number().int().min(0).max(500).optional(),
  unattempted: z.number().int().min(0).max(500).optional(),
  accuracy: z.number().int().min(0).max(10000).optional(),
  notes: z.string().max(2000).optional().nullable(),
  completedAt: dateOrTimestampSchema.optional(),
  createdAt: dateOrTimestampSchema.optional(),
});

export const guestPreferencesMigrationSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  dailyStudyGoalMinutes: z.number().int().min(10).max(1440).optional(),
  timezone: z.string().max(100).optional(),
  preparationStage: z.string().max(100).optional().nullable(),
});

export const guestNotificationPreferencesMigrationSchema = z.object({
  studyReminders: z.boolean().optional(),
  revisionReminders: z.boolean().optional(),
  mockTestReminders: z.boolean().optional(),
});

export const guestMigrationPayloadSchema = z.object({
  guestId: z.string().min(1).max(128),
  workspaces: z.array(guestWorkspaceMigrationSchema).max(20).optional(),
  topicProgress: z.array(guestTopicProgressMigrationSchema).max(2000).optional(),
  plannerTasks: z.array(guestPlannerTaskMigrationSchema).max(1000).optional(),
  studySessions: z.array(guestStudySessionMigrationSchema).max(1000).optional(),
  revisionItems: z.array(guestRevisionItemMigrationSchema).max(1000).optional(),
  practiceSessions: z.array(guestPracticeSessionMigrationSchema).max(1000).optional(),
  savedResources: z.array(guestSavedResourceMigrationSchema).max(1000).optional(),
  mockTests: z.array(guestMockTestMigrationSchema).max(100).optional(),
  mockTestResults: z.array(guestMockTestResultMigrationSchema).max(200).optional(),
  preferences: guestPreferencesMigrationSchema.optional(),
  notificationPreferences: guestNotificationPreferencesMigrationSchema.optional(),
});
