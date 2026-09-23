import { z } from "zod";

export const examStatusSchema = z.enum(["active", "draft", "archived"]);
export const examAttemptStatusSchema = z.enum(["upcoming", "active", "completed", "archived"]);
export const topicStatusSchema = z.enum([
  "not_started",
  "learning",
  "learned",
  "practiced",
  "revised",
  "mastered",
]);
export const plannerTaskTypeSchema = z.enum([
  "study",
  "practice",
  "revision",
  "mock_test",
  "custom",
]);
export const plannerTaskStatusSchema = z.enum([
  "upcoming",
  "in_progress",
  "completed",
  "skipped",
]);
export const revisionStatusSchema = z.enum(["scheduled", "completed", "skipped"]);
export const resourceTypeSchema = z.enum([
  "ncert",
  "textbook",
  "notes",
  "pyq",
  "formula_sheet",
  "revision",
  "reference",
]);
export const mockTestTypeSchema = z.enum([
  "full_syllabus",
  "subject",
  "chapter",
  "custom",
]);
export const themeSchema = z.enum(["light", "dark", "system"]);

export const scoringRuleSchema = z.object({
  correctMarks: z.number(),
  incorrectMarks: z.number(),
  unattemptedMarks: z.number().default(0),
});

export const examSectionConfigSchema = z.object({
  name: z.string().min(1),
  subjectSlug: z.string().min(1),
  totalQuestions: z.number().int().positive(),
  mandatoryQuestions: z.number().int().positive().optional(),
  scoringRule: scoringRuleSchema,
});

export const examScoringConfigSchema = z.object({
  totalMarks: z.number().int().positive(),
  defaultRule: scoringRuleSchema,
  durationMinutes: z.number().int().positive(),
  totalQuestions: z.number().int().positive(),
  sections: z.array(examSectionConfigSchema).optional(),
  negativeMarking: z.boolean().default(true),
  syllabusVersion: z.string().optional(),
  passingCriteriaDescription: z.string().optional(),
});

export const examSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  shortName: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().min(1),
  status: examStatusSchema.default("active"),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const examAttemptSchema = z.object({
  id: z.string().min(1),
  examId: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  examDate: z.date().nullable().optional(),
  status: examAttemptStatusSchema.default("upcoming"),
  scoringConfig: examScoringConfigSchema.nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const subjectSchema = z.object({
  id: z.string().min(1),
  examId: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  displayOrder: z.number().int().default(0),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const chapterSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  displayOrder: z.number().int().default(0),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const topicSchema = z.object({
  id: z.string().min(1),
  chapterId: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  displayOrder: z.number().int().default(0),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const userTopicProgressSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  topicId: z.string().min(1),
  status: topicStatusSchema.default("not_started"),
  practiceAttempts: z.number().int().nonnegative().default(0),
  correctAnswers: z.number().int().nonnegative().default(0),
  incorrectAnswers: z.number().int().nonnegative().default(0),
  accuracy: z.number().int().min(0).max(10000).default(0), // basis points (0-10000)
  notes: z.string().nullable().optional(),
});
