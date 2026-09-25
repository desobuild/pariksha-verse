import { z } from "zod";
import type {
  QuestionType,
  QuestionDifficulty,
  QuestionProvenance,
  QuestionStatus,
  PracticeScopeType,
  QuestionSessionStatus,
} from "@/db/schema/questions";

export type {
  QuestionType,
  QuestionDifficulty,
  QuestionProvenance,
  QuestionStatus,
  PracticeScopeType,
  QuestionSessionStatus,
};

export interface QuestionOptionItem {
  id: string;
  questionId: string;
  displayOrder: number;
  optionKey: string;
  text: string;
  isCorrect?: boolean;
}

export interface QuestionWithOptions {
  id: string;
  examId: string;
  subjectId: string;
  chapterId: string;
  topicId: string;
  text: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  explanation?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  attribution?: string | null;
  license?: string | null;
  externalId?: string | null;
  year?: number | null;
  provenance: QuestionProvenance;
  status: QuestionStatus;
  options: QuestionOptionItem[];
  createdAt: Date;
  updatedAt: Date;
}

export type PracticeScope =
  | { type: "topic"; topicId: string }
  | { type: "subject"; subjectId: string }
  | { type: "mixed"; examAttemptId: string };

export interface QuestionAttemptDetail {
  id: string;
  sessionId: string;
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  displayOrder: number;
  answeredAt: Date | null;
}

export interface QuestionSessionWithAttempts {
  id: string;
  workspaceId: string;
  scopeType: PracticeScopeType;
  scopeId: string;
  totalQuestions: number;
  status: QuestionSessionStatus;
  durationSeconds: number;
  startedAt: Date;
  completedAt: Date | null;
  questions: QuestionWithOptions[];
  attempts: QuestionAttemptDetail[];
}

export interface QuestionReviewOption {
  id: string;
  optionKey: string;
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
}

export interface QuestionReviewItem {
  questionId: string;
  displayOrder: number;
  text: string;
  explanation?: string | null;
  topicId: string;
  topicName?: string;
  subjectName?: string;
  options: QuestionReviewOption[];
  selectedOptionId: string | null;
  correctOptionId: string;
  isCorrect: boolean;
  isAttempted: boolean;
}

export interface QuestionSessionResult {
  sessionId: string;
  workspaceId: string;
  scopeType: PracticeScopeType;
  scopeId: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracyBps: number;
  accuracyPct: number;
  durationSeconds: number;
  completedAt: Date;
  questions: QuestionReviewItem[];
}

export interface CreateQuestionSessionInput {
  workspaceId: string;
  scope: PracticeScope;
  questionCount: number;
  options?: {
    seed?: number;
    shuffle?: boolean;
  };
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const practiceScopeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("topic"),
    topicId: z.string().min(1, "Topic ID is required"),
  }),
  z.object({
    type: z.literal("subject"),
    subjectId: z.string().min(1, "Subject ID is required"),
  }),
  z.object({
    type: z.literal("mixed"),
    examAttemptId: z.string().min(1, "Exam Attempt ID is required"),
  }),
]);

export const createQuestionSessionSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
  scope: practiceScopeSchema,
  questionCount: z
    .number({ invalid_type_error: "Question count must be a number" })
    .int("Question count must be an integer")
    .min(1, "At least 1 question is required")
    .max(50, "Maximum session size is 50 questions"),
  seed: z.number().int().optional(),
});

export const recordAnswerSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
  sessionId: z.string().min(1, "Session ID is required"),
  questionId: z.string().min(1, "Question ID is required"),
  selectedOptionId: z.string().nullable(),
});

export const submitQuestionSessionSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
  sessionId: z.string().min(1, "Session ID is required"),
  durationSeconds: z.number().int().min(0).optional().default(0),
  answers: z.record(z.string().nullable()).optional(),
});
