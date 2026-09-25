import { calculateAccuracyBps } from "@/domain/practice";
import type {
  QuestionWithOptions,
  QuestionSessionResult,
  QuestionReviewItem,
  QuestionReviewOption,
  PracticeScopeType,
} from "./types";

export interface GradeSessionInput {
  sessionId: string;
  workspaceId: string;
  scopeType: PracticeScopeType;
  scopeId: string;
  questions: QuestionWithOptions[];
  answers: Record<string, string | null>; // questionId -> selectedOptionId
  durationSeconds?: number;
  completedAt?: Date;
  metadataResolver?: (topicId: string) => { topicName?: string; subjectName?: string } | null;
}

/**
 * Server/Domain authoritative evaluation of a practice session.
 * Never trusts client-reported isCorrect or accuracy.
 */
export function gradeQuestionSession(input: GradeSessionInput): QuestionSessionResult {
  const {
    sessionId,
    workspaceId,
    scopeType,
    scopeId,
    questions,
    answers,
    durationSeconds = 0,
    completedAt = new Date(),
    metadataResolver,
  } = input;

  let attempted = 0;
  let correct = 0;

  const reviewItems: QuestionReviewItem[] = questions.map((q, idx) => {
    const selectedOptionId = answers[q.id] ?? null;
    const isAttempted = selectedOptionId !== null && selectedOptionId !== "";

    // Find authoritative correct option
    const correctOption = q.options.find((opt) => opt.isCorrect);
    const correctOptionId = correctOption?.id ?? "";

    const isCorrect = isAttempted && selectedOptionId === correctOptionId;

    if (isAttempted) {
      attempted++;
      if (isCorrect) {
        correct++;
      }
    }

    const reviewOptions: QuestionReviewOption[] = q.options.map((opt) => ({
      id: opt.id,
      optionKey: opt.optionKey,
      text: opt.text,
      isCorrect: Boolean(opt.isCorrect),
      isSelected: opt.id === selectedOptionId,
    }));

    const meta = metadataResolver ? metadataResolver(q.topicId) : null;

    return {
      questionId: q.id,
      displayOrder: idx + 1,
      text: q.text,
      explanation: q.explanation ?? null,
      topicId: q.topicId,
      topicName: meta?.topicName,
      subjectName: meta?.subjectName,
      options: reviewOptions,
      selectedOptionId,
      correctOptionId,
      isCorrect,
      isAttempted,
    };
  });

  const totalQuestions = questions.length;
  const incorrect = attempted - correct;
  const unanswered = Math.max(0, totalQuestions - attempted);
  const accuracyBps = calculateAccuracyBps(correct, attempted);
  const accuracyPct = Math.round(accuracyBps / 100);

  return {
    sessionId,
    workspaceId,
    scopeType,
    scopeId,
    totalQuestions,
    attempted,
    correct,
    incorrect,
    unanswered,
    accuracyBps,
    accuracyPct,
    durationSeconds,
    completedAt,
    questions: reviewItems,
  };
}
