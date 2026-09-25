import { z } from "zod";
import type {
  MockTestType,
  MockTestStatus,
  MockSessionStatus,
  MockProvenance,
} from "@/db/schema/mock-tests";
import type {
  QuestionWithOptions,
  QuestionReviewOption,
} from "@/domain/practice-engine/types";

export type {
  MockTestType,
  MockTestStatus,
  MockSessionStatus,
  MockProvenance,
};

// ============================================================================
// 1. MARKING & CONFIGURATION
// ============================================================================

export interface MockMarkingScheme {
  correctMarks: number;
  incorrectPenalty: number; // positive number representing deduction, e.g. 1
  unansweredMarks: number; // usually 0
}

export interface MockSectionConfig {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  questionCount: number;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
}

export interface MockQuestionSelectionConfig {
  mode: "sections" | "pool";
  seed?: number;
  shuffle?: boolean;
  fixedQuestionIds?: string[];
}

export interface MockTestDetail {
  id: string;
  workspaceId: string;
  examId: string | null;
  title: string;
  description: string | null;
  type: MockTestType;
  scheduledAt: Date | null;
  durationMinutes: number;
  totalQuestions: number;
  markingScheme: MockMarkingScheme;
  sections: MockSectionConfig[];
  questionSelectionConfig?: MockQuestionSelectionConfig | null;
  source: string | null;
  externalUrl: string | null;
  provenance: MockProvenance;
  status: MockTestStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 2. SESSION & INTERACTIVE STATE
// ============================================================================

export interface MockTestSessionDetail {
  id: string;
  mockTestId: string;
  workspaceId: string;
  status: MockSessionStatus;
  questionIds: string[];
  selectedAnswers: Record<string, string | null>; // questionId -> optionId
  markedForReview: string[]; // questionIds marked for review
  currentIndex: number;
  durationSeconds: number;
  startedAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
  questions: QuestionWithOptions[];
  mockTest: MockTestDetail;
}

// ============================================================================
// 3. RESULTS & EVALUATION
// ============================================================================

export interface MockSectionResult {
  sectionId: string;
  name: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  rawScore: number;
  maxScore: number;
  accuracyBps: number;
  accuracyPct: number;
}

export interface MockQuestionReviewItem {
  questionId: string;
  displayOrder: number;
  sectionId?: string;
  sectionName?: string;
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
  isMarkedForReview: boolean;
  marksAwarded: number;
}

export interface MockTestResultDetail {
  id: string;
  mockTestId: string;
  sessionId?: string | null;
  workspaceId: string;
  mockTitle: string;
  rawScore: number;
  totalMarks: number; // Maximum possible score
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  markedForReviewCount: number;
  accuracy: number; // Basis points (0 - 10000)
  accuracyPct: number;
  timeSpentSeconds: number;
  submissionStatus: "completed" | "auto_submitted";
  completedAt: Date;
  notes?: string | null;
  sections: MockSectionResult[];
  questions: MockQuestionReviewItem[];
}

// ============================================================================
// 4. VALIDATION SCHEMAS
// ============================================================================

export const mockMarkingSchemeSchema = z.object({
  correctMarks: z.number().finite("Correct marks must be finite"),
  incorrectPenalty: z.number().min(0, "Penalty must be non-negative"),
  unansweredMarks: z.number().finite("Unanswered marks must be finite").default(0),
});

export const mockSectionConfigSchema = z.object({
  id: z.string().min(1, "Section ID is required"),
  name: z.string().min(1, "Section name is required"),
  description: z.string().optional(),
  displayOrder: z.number().int().default(0),
  questionCount: z.number().int().min(1, "Section question count must be at least 1"),
  subjectId: z.string().optional(),
  chapterId: z.string().optional(),
  topicId: z.string().optional(),
});

export const createMockSessionSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
  mockTestId: z.string().min(1, "Mock test ID is required"),
  seed: z.number().int().optional(),
});

export const updateMockAnswerSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
  sessionId: z.string().min(1, "Session ID is required"),
  questionId: z.string().min(1, "Question ID is required"),
  selectedOptionId: z.string().nullable().optional(),
  isMarkedForReview: z.boolean().optional(),
  currentIndex: z.number().int().min(0).optional(),
});

export const submitMockSessionSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
  sessionId: z.string().min(1, "Session ID is required"),
  submissionStatus: z.enum(["completed", "auto_submitted"]).default("completed"),
  answers: z.record(z.string().nullable()).optional(),
  markedForReview: z.array(z.string()).optional(),
  completedAt: z.coerce.date().optional(),
});
