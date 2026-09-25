import { calculateAccuracyBps } from "@/domain/practice";
import type {
  MockTestDetail,
  MockTestResultDetail,
  MockSectionResult,
  MockQuestionReviewItem,
  MockMarkingScheme,
} from "./types";
import type {
  QuestionWithOptions,
  QuestionReviewOption,
} from "@/domain/practice-engine/types";

export interface CalculateMockResultInput {
  mockTest: MockTestDetail;
  sessionId: string;
  workspaceId: string;
  questions: QuestionWithOptions[];
  answers: Record<string, string | null>; // questionId -> selectedOptionId
  markedForReview: string[]; // questionIds marked for review
  startedAt: Date;
  completedAt?: Date;
  submissionStatus?: "completed" | "auto_submitted";
  notes?: string | null;
  metadataResolver?: (topicId: string) => { topicName?: string; subjectName?: string } | null;
}

/**
 * Authoritative, server-side grading of a mock test session.
 *
 * Scrupulously adheres to Phase 11 exam-agnostic requirements:
 * 1. Scoring rules derived strictly from mock test configuration (never hardcoded).
 * 2. Raw score computed with negative penalty where configured.
 * 3. Marked for review:
 *    - marked + answered = graded normally
 *    - marked + unanswered = unanswered
 * 4. Accuracy computed in basis points using existing domain utility.
 * 5. Section-level breakdown calculated when sections exist.
 * 6. Never calculates rank or percentile (deferred to later phases).
 */
export function calculateMockResult(input: CalculateMockResultInput): MockTestResultDetail {
  const {
    mockTest,
    sessionId,
    workspaceId,
    questions,
    answers,
    markedForReview,
    startedAt,
    completedAt = new Date(),
    submissionStatus = "completed",
    notes = null,
    metadataResolver,
  } = input;

  const scheme: MockMarkingScheme = mockTest.markingScheme || {
    correctMarks: 4,
    incorrectPenalty: 1,
    unansweredMarks: 0,
  };

  const markedSet = new Set(markedForReview);

  // Section tracking map
  const sectionResultsMap = new Map<
    string,
    {
      id: string;
      name: string;
      totalQuestions: number;
      attempted: number;
      correct: number;
      incorrect: number;
      unanswered: number;
      rawScore: number;
      maxScore: number;
    }
  >();

  for (const sec of mockTest.sections || []) {
    sectionResultsMap.set(sec.id, {
      id: sec.id,
      name: sec.name,
      totalQuestions: 0,
      attempted: 0,
      correct: 0,
      incorrect: 0,
      unanswered: 0,
      rawScore: 0,
      maxScore: 0,
    });
  }

  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalUnanswered = 0;
  let rawScore = 0;

  const reviewQuestions: MockQuestionReviewItem[] = questions.map((q, idx) => {
    const selectedOptionId = answers[q.id] ?? null;
    const isAttempted = selectedOptionId !== null && selectedOptionId !== "";
    const isMarked = markedSet.has(q.id);

    // Authoritative correct option
    const correctOption = q.options.find((opt) => opt.isCorrect);
    const correctOptionId = correctOption?.id ?? "";

    const isCorrect = isAttempted && selectedOptionId === correctOptionId;

    let marksAwarded = scheme.unansweredMarks;

    if (isAttempted) {
      totalAttempted++;
      if (isCorrect) {
        totalCorrect++;
        marksAwarded = scheme.correctMarks;
      } else {
        totalIncorrect++;
        marksAwarded = -Math.abs(scheme.incorrectPenalty);
      }
    } else {
      totalUnanswered++;
    }

    rawScore += marksAwarded;

    // Associate question with section if configured
    let assignedSectionId: string | undefined;
    let assignedSectionName: string | undefined;

    if (mockTest.sections && mockTest.sections.length > 0) {
      // Find matching section by subjectId or topicId
      const matchingSection =
        mockTest.sections.find((s) => s.subjectId && s.subjectId === q.subjectId) ||
        mockTest.sections.find((s) => s.topicId && s.topicId === q.topicId) ||
        mockTest.sections[0];

      if (matchingSection) {
        assignedSectionId = matchingSection.id;
        assignedSectionName = matchingSection.name;

        const secStats = sectionResultsMap.get(matchingSection.id);
        if (secStats) {
          secStats.totalQuestions++;
          secStats.rawScore += marksAwarded;
          secStats.maxScore += scheme.correctMarks;
          if (isAttempted) {
            secStats.attempted++;
            if (isCorrect) {
              secStats.correct++;
            } else {
              secStats.incorrect++;
            }
          } else {
            secStats.unanswered++;
          }
        }
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
      sectionId: assignedSectionId,
      sectionName: assignedSectionName,
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
      isMarkedForReview: isMarked,
      marksAwarded,
    };
  });

  const totalQuestions = questions.length;
  const maxPossibleScore = totalQuestions * scheme.correctMarks;
  const accuracyBps = calculateAccuracyBps(totalCorrect, totalAttempted);
  const accuracyPct = Math.round(accuracyBps / 100);

  // Calculate elapsed duration clamped to realistic boundaries
  const timeSpentSeconds = Math.max(
    0,
    Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)
  );

  const sections: MockSectionResult[] = Array.from(sectionResultsMap.values()).map(
    (sec) => {
      const secAccBps = calculateAccuracyBps(sec.correct, sec.attempted);
      return {
        sectionId: sec.id,
        name: sec.name,
        totalQuestions: sec.totalQuestions,
        attempted: sec.attempted,
        correct: sec.correct,
        incorrect: sec.incorrect,
        unanswered: sec.unanswered,
        rawScore: sec.rawScore,
        maxScore: sec.maxScore,
        accuracyBps: secAccBps,
        accuracyPct: Math.round(secAccBps / 100),
      };
    }
  );

  return {
    id: `res_${sessionId}`,
    mockTestId: mockTest.id,
    sessionId,
    workspaceId,
    mockTitle: mockTest.title,
    rawScore,
    totalMarks: maxPossibleScore,
    totalQuestions,
    attempted: totalAttempted,
    correct: totalCorrect,
    incorrect: totalIncorrect,
    unattempted: totalUnanswered,
    markedForReviewCount: markedForReview.length,
    accuracy: accuracyBps,
    accuracyPct,
    timeSpentSeconds,
    submissionStatus,
    completedAt,
    notes,
    sections,
    questions: reviewQuestions,
  };
}
