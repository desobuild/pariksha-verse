import type { PracticeSession, RevisionItem, UserTopicProgress } from "@/db/schema";
import type { QuestionSessionWithAttempts, PracticeScopeType } from "@/domain/practice-engine";
import {
  aggregateAllTopicsPerformance,
  calculateAccuracyBps,
} from "@/domain/practice";
import {
  buildProgressIndex,
  getEffectiveTopicStatus,
  type TopicStatus,
} from "@/domain/study";
import { classifyRevision, isRevisionEligible, toDate } from "@/domain/revision";
import { getTopicMetadata, getSubjectTaxonomySummary } from "@/domain/dashboard";
import type { AnalyticsRangeWindow } from "./types";
import { isDateInRange } from "./types";

/**
 * Subject, topic and question performance (Sections 2, 3 and 6).
 *
 * All aggregation flows through the Phase 9 practice domain
 * (`aggregateAllTopicsPerformance`), keeping the canonical accuracy basis
 * points and the Phase 9 weak-topic definition. Progress rows are only used
 * for all-time aggregation — a finite time range aggregates the sessions
 * inside that range, never the cumulative progress counters.
 */

// ============================================================================
// 1. SESSION WINDOW FILTERING
// ============================================================================

export function filterPracticeSessionsByWindow(
  sessions: PracticeSession[],
  window: AnalyticsRangeWindow
): PracticeSession[] {
  if (window.start === null) return sessions;
  return sessions.filter((s) => isDateInRange(toDate(s.completedAt), window));
}

// ============================================================================
// 2. SUBJECT PERFORMANCE
// ============================================================================

export interface SubjectPerformanceAnalytics {
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  displayOrder: number;
  totalTopics: number;
  topicsCovered: number;
  questionsAttempted: number;
  correct: number;
  incorrect: number;
  /** Basis points; 0 when nothing was attempted (never presented as 0%). */
  accuracyBps: number;
  sessionCount: number;
  weakTopics: number;
  /** False when no question was attempted in scope. */
  hasData: boolean;
}

/**
 * Subject-level performance derived from the same topic rows the topic
 * table renders, preserving canonical subject order. `progressList`
 * supplies covered-topic counts (coverage is cumulative even inside a
 * finite practice window).
 */
export function buildSubjectPerformance(
  examAttemptId: string,
  topics: TopicPerformanceAnalytics[],
  progressList: UserTopicProgress[]
): SubjectPerformanceAnalytics[] {
  const subjects = getSubjectTaxonomySummary(examAttemptId);
  const index = buildProgressIndex(progressList);

  return subjects.map((subject, order) => {
    let questionsAttempted = 0;
    let correct = 0;
    let incorrect = 0;
    let sessionCount = 0;
    let weakTopics = 0;
    let topicsCovered = 0;

    for (const topic of topics) {
      if (topic.subjectId !== subject.id && topic.subjectSlug !== subject.slug) continue;
      questionsAttempted += topic.questionsAttempted;
      correct += topic.correct;
      incorrect += topic.incorrect;
      sessionCount += topic.sessionCount;
      if (topic.isWeak) weakTopics += 1;

      const status = getEffectiveTopicStatus(index, topic.topicId);
      if (status === "learned" || status === "practiced" || status === "revised" || status === "mastered") {
        topicsCovered += 1;
      }
    }

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      subjectSlug: subject.slug,
      displayOrder: order,
      totalTopics: subject.totalTopics,
      topicsCovered,
      questionsAttempted,
      correct,
      incorrect,
      accuracyBps: calculateAccuracyBps(correct, questionsAttempted),
      sessionCount,
      weakTopics,
      hasData: questionsAttempted > 0,
    };
  });
}

// ============================================================================
// 3. TOPIC PERFORMANCE
// ============================================================================

export type TopicRevisionState = "overdue" | "due" | "upcoming" | "none";

export interface TopicPerformanceAnalytics {
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  questionsAttempted: number;
  correct: number;
  incorrect: number;
  accuracyBps: number;
  sessionCount: number;
  lastPracticedAt: Date | null;
  /** Existing Phase 9 weak definition (attempts > 0 and accuracy < 60%). */
  isWeak: boolean;
  status: TopicStatus;
  revisionState: TopicRevisionState;
  nextRevisionAt: Date | null;
  hasData: boolean;
}

/**
 * Topic-level rows in canonical syllabus order.
 *
 * `statusProgress` always drives the status and revision-state columns —
 * preparation state is cumulative. Practice metrics come from `sessions`;
 * pass `metricsFallbackProgress` only for all-time views, where the
 * canonical Phase 9 progress fallback applies. In a finite window leave it
 * empty so cumulative counters never leak into the window's metrics.
 */
export function buildTopicPerformance(
  examAttemptId: string,
  sessions: PracticeSession[],
  statusProgress: UserTopicProgress[],
  revisionItems: RevisionItem[],
  referenceDate: Date,
  metricsFallbackProgress: UserTopicProgress[] = []
): TopicPerformanceAnalytics[] {
  const performances = aggregateAllTopicsPerformance(
    examAttemptId,
    sessions,
    metricsFallbackProgress
  );
  const progressIndex = buildProgressIndex(statusProgress);
  const revisionByTopic = new Map(revisionItems.map((r) => [r.topicId, r]));

  return [...performances.values()].map((perf) => {
    const progress = progressIndex.get(perf.topicId);
    const item = revisionByTopic.get(perf.topicId);
    // Same schedule-of-record precedence as the Phase 8 queue:
    // revision_items.nextRevisionAt falls back to progress.nextRevisionAt,
    // and only eligible schedules surface as a revision state.
    const nextRevisionAt = toDate(item?.nextRevisionAt ?? progress?.nextRevisionAt ?? null);

    let revisionState: TopicRevisionState = "none";
    if (progress && isRevisionEligible(progress.status, nextRevisionAt, item ?? null) && nextRevisionAt) {
      revisionState = classifyRevision(nextRevisionAt, referenceDate);
    }

    return {
      topicId: perf.topicId,
      topicName: perf.topicName,
      chapterId: perf.chapterId,
      chapterName: perf.chapterName,
      subjectId: perf.subjectId,
      subjectName: perf.subjectName,
      subjectSlug: perf.subjectSlug,
      questionsAttempted: perf.totalQuestions,
      correct: perf.totalCorrect,
      incorrect: perf.totalIncorrect,
      accuracyBps: perf.accuracy,
      sessionCount: perf.sessionCount,
      lastPracticedAt: perf.lastPracticedAt,
      isWeak: perf.isWeak,
      status: progress?.status ?? "not_started",
      revisionState,
      nextRevisionAt,
      hasData: perf.totalQuestions > 0,
    };
  });
}

// ============================================================================
// 4. TOPIC FILTERS + SORTING
// ============================================================================

export type TopicSubjectFilter = "all" | string;
export type TopicStatusFilterValue = TopicStatus | "all";
export type TopicPerformanceFilter = "all" | "practiced" | "weak";
export type TopicSortKey =
  | "syllabus"
  | "accuracy_asc"
  | "accuracy_desc"
  | "attempted_desc"
  | "attempted_asc"
  | "name";

export const TOPIC_SORT_OPTIONS: { value: TopicSortKey; label: string }[] = [
  { value: "syllabus", label: "Syllabus order" },
  { value: "accuracy_asc", label: "Accuracy: low to high" },
  { value: "accuracy_desc", label: "Accuracy: high to low" },
  { value: "attempted_desc", label: "Most attempted" },
  { value: "attempted_asc", label: "Least attempted" },
  { value: "name", label: "Name (A–Z)" },
];

export interface TopicPerformanceFilters {
  subject?: TopicSubjectFilter;
  status?: TopicStatusFilterValue;
  performance?: TopicPerformanceFilter;
  sort?: TopicSortKey;
}

export function filterAndSortTopicPerformance(
  topics: TopicPerformanceAnalytics[],
  filters: TopicPerformanceFilters = {}
): TopicPerformanceAnalytics[] {
  const subject = filters.subject ?? "all";
  const status = filters.status ?? "all";
  const performance = filters.performance ?? "all";

  const filtered = topics.filter((topic) => {
    if (subject !== "all" && topic.subjectSlug !== subject) return false;
    if (status !== "all" && topic.status !== status) return false;
    if (performance === "practiced" && !topic.hasData) return false;
    if (performance === "weak" && !topic.isWeak) return false;
    return true;
  });

  // Accuracy sorts keep no-data topics at the end in both directions:
  // accuracy is undefined without attempts, never 0% or 100%.
  const noDataLast = (a: TopicPerformanceAnalytics, b: TopicPerformanceAnalytics) =>
    a.hasData !== b.hasData ? (a.hasData ? -1 : 1) : 0;
  const byName = (a: TopicPerformanceAnalytics, b: TopicPerformanceAnalytics) =>
    a.topicName.localeCompare(b.topicName);

  const sorted = [...filtered];
  switch (filters.sort ?? "syllabus") {
    case "syllabus":
      break;
    case "accuracy_asc":
      sorted.sort(
        (a, b) => noDataLast(a, b) || a.accuracyBps - b.accuracyBps || byName(a, b)
      );
      break;
    case "accuracy_desc":
      sorted.sort(
        (a, b) => noDataLast(a, b) || b.accuracyBps - a.accuracyBps || byName(a, b)
      );
      break;
    case "attempted_desc":
      sorted.sort((a, b) => b.questionsAttempted - a.questionsAttempted || byName(a, b));
      break;
    case "attempted_asc":
      sorted.sort((a, b) => a.questionsAttempted - b.questionsAttempted || byName(a, b));
      break;
    case "name":
      sorted.sort(byName);
      break;
  }
  return sorted;
}

// ============================================================================
// 5. QUESTION-ENGINE PERFORMANCE (recent sessions)
// ============================================================================

export interface QuestionSessionSummary {
  id: string;
  scopeType: PracticeScopeType;
  scopeLabel: string;
  status: QuestionSessionWithAttempts["status"];
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracyBps: number;
  completedAt: Date | null;
}

export interface QuestionAnalytics {
  /** Newest first, exactly as provided by the repository (capped at 10). */
  sessions: QuestionSessionSummary[];
  totals: {
    /** Completed sessions only — in-progress sessions are listed but not counted. */
    sessions: number;
    questions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    accuracyBps: number;
  };
}

/**
 * Summarises Phase 10 question-engine sessions. The repository contract
 * caps this at the 10 most recent sessions, so totals are labelled
 * "recent" by the UI and never added to all-time practice totals.
 */
export function buildQuestionAnalytics(
  sessions: QuestionSessionWithAttempts[],
  examAttemptId: string
): QuestionAnalytics {
  const summaries = sessions.map((session) => {
    const attempted = session.attempts.filter((a) => a.selectedOptionId !== null).length;
    const correct = session.attempts.filter((a) => a.isCorrect === true).length;
    const incorrect = attempted - correct;
    const unanswered = Math.max(0, session.totalQuestions - attempted);

    return {
      id: session.id,
      scopeType: session.scopeType,
      scopeLabel: resolveScopeLabel(session, examAttemptId),
      status: session.status,
      totalQuestions: session.totalQuestions,
      attempted,
      correct,
      incorrect,
      unanswered,
      accuracyBps: calculateAccuracyBps(correct, attempted),
      completedAt: toDate(session.completedAt),
    };
  });

  const completed = summaries.filter((s) => s.status === "completed");
  const totals = completed.reduce(
    (acc, s) => ({
      sessions: acc.sessions + 1,
      questions: acc.questions + s.totalQuestions,
      attempted: acc.attempted + s.attempted,
      correct: acc.correct + s.correct,
      incorrect: acc.incorrect + s.incorrect,
      unanswered: acc.unanswered + s.unanswered,
    }),
    { sessions: 0, questions: 0, attempted: 0, correct: 0, incorrect: 0, unanswered: 0 }
  );

  return {
    sessions: summaries,
    totals: { ...totals, accuracyBps: calculateAccuracyBps(totals.correct, totals.attempted) },
  };
}

function resolveScopeLabel(session: QuestionSessionWithAttempts, examAttemptId: string): string {
  if (session.scopeType === "mixed") return "Mixed practice";
  if (session.scopeType === "topic") {
    const meta = getTopicMetadata(session.scopeId, examAttemptId);
    return meta ? meta.topicName : "Topic practice";
  }
  const subjects = getSubjectTaxonomySummary(examAttemptId);
  const subject = subjects.find((s) => s.id === session.scopeId || s.slug === session.scopeId);
  return subject ? `${subject.name} practice` : "Subject practice";
}
