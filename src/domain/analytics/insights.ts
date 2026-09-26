import type { UserTopicProgress, PracticeSession, StudySession } from "@/db/schema";
import type { MockTestResultDetail } from "@/domain/mock-engine";
import { getTopicMetadata } from "@/domain/dashboard";
import {
  aggregateAllTopicsPerformance,
  formatAccuracy,
  getWeakTopics,
} from "@/domain/practice";
import { formatDurationMinutes } from "@/domain/study";
import { toDate } from "@/domain/revision";
import type { AnalyticsRangeWindow } from "./types";
import { isDateInRange } from "./types";
import type { CoverageAnalytics } from "./coverage";
import type { RevisionActivityAnalytics } from "./revision";
import type { MockAnalytics } from "./mocks";
import type { StudyTimeAnalytics } from "./study";

/**
 * Deterministic, explainable insights (Section 10 + Insights Engine).
 *
 * Every statement is generated from stored records and carries the numbers
 * it is based on. There is no AI, no prediction and no evaluative language:
 * facts in, sentences out. An empty dataset produces no insights.
 */

export type AnalyticsInsightKind = "attention" | "info";

export interface AnalyticsInsight {
  id: string;
  kind: AnalyticsInsightKind;
  title: string;
  /** Factual sentence including the underlying numbers. */
  detail: string;
  href?: string;
  hrefLabel?: string;
}

export interface InsightInput {
  examAttemptId: string;
  coverage: CoverageAnalytics;
  progressList: UserTopicProgress[];
  practiceSessions: PracticeSession[];
  revision: RevisionActivityAnalytics;
  mocks: MockAnalytics;
  study: StudyTimeAnalytics;
  window: AnalyticsRangeWindow;
}

/** Maximum weak-topic insights surfaced (lowest accuracy first). */
const WEAK_TOPIC_INSIGHT_LIMIT = 3;

export function buildInsights(input: InsightInput): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];
  const { coverage, revision, mocks, study, window } = input;

  // 1. Coverage position — always factual, based on stored topic progress.
  if (coverage.counts.total > 0) {
    insights.push({
      id: "coverage",
      kind: "info",
      title: "Coverage",
      detail: `You have covered ${coverage.counts.covered} of ${coverage.counts.total} topics (${coverage.coveragePct}%).`,
      href: "/app/study",
      hrefLabel: "Open Study",
    });
  }

  // 2. Weak practice performance — the canonical Phase 9 definition via
  // getWeakTopics (attempts > 0, accuracy < 6000 bps), all-time data with
  // the standard progress fallback built into the aggregation.
  const allTimePerformances = aggregateAllTopicsPerformance(
    input.examAttemptId,
    input.practiceSessions,
    input.progressList
  );
  const weak = getWeakTopics(input.examAttemptId, input.practiceSessions, allTimePerformances).slice(
    0,
    WEAK_TOPIC_INSIGHT_LIMIT
  );
  for (const topic of weak) {
    insights.push({
      id: `weak_${topic.topicId}`,
      kind: "attention",
      title: "Practice needs attention",
      detail: `${topic.topicName} — ${formatAccuracy(topic.accuracy)} accuracy across ${topic.totalQuestions} ${topic.totalQuestions === 1 ? "question" : "questions"}.`,
      href: `/app/practice?topicId=${encodeURIComponent(topic.topicId)}`,
      hrefLabel: "Practice",
    });
  }

  // 3. Not-started topics.
  if (coverage.counts.total > 0 && coverage.counts.notStarted > 0) {
    insights.push({
      id: "not_started",
      kind: "info",
      title: "Not started yet",
      detail: `${coverage.counts.notStarted} of ${coverage.counts.total} topics have not been started.`,
      href: "/app/study",
      hrefLabel: "Browse Syllabus",
    });
  }

  // 4. Revision state — straight from the Phase 8 queue summary.
  if (revision.overdue > 0) {
    insights.push({
      id: "revision_overdue",
      kind: "attention",
      title: "Revision overdue",
      detail: `${revision.overdue} ${revision.overdue === 1 ? "topic is" : "topics are"} overdue for revision.`,
      href: "/app/revision",
      hrefLabel: "Open Revision",
    });
  } else if (revision.dueToday > 0) {
    insights.push({
      id: "revision_due",
      kind: "info",
      title: "Revision due",
      detail: `${revision.dueToday} ${revision.dueToday === 1 ? "topic is" : "topics are"} due for revision today.`,
      href: "/app/revision",
      hrefLabel: "Open Revision",
    });
  }

  // 5. Mock accuracy change across the last two completed mocks.
  if (mocks.trend.length >= 2) {
    const previous = mocks.trend[mocks.trend.length - 2];
    const latest = mocks.trend[mocks.trend.length - 1];
    const prevPct = Math.round(previous.accuracyBps / 100);
    const latestPct = Math.round(latest.accuracyBps / 100);
    if (latestPct > prevPct) {
      insights.push({
        id: "mock_accuracy",
        kind: "info",
        title: "Mock accuracy",
        detail: `Mock accuracy increased from ${prevPct}% to ${latestPct}% across your last two mocks.`,
        href: "/app/mock-tests",
        hrefLabel: "View Mocks",
      });
    } else if (latestPct < prevPct) {
      insights.push({
        id: "mock_accuracy",
        kind: "info",
        title: "Mock accuracy",
        detail: `Mock accuracy changed from ${prevPct}% to ${latestPct}% across your last two mocks.`,
        href: "/app/mock-tests",
        hrefLabel: "View Mocks",
      });
    }
  }

  // 6. Study time change versus the previous equal-length window.
  if (study.previousWindowMinutes !== null && window.days !== null) {
    const currentMinutes = study.totalMinutes;
    const previousMinutes = study.previousWindowMinutes;
    if (previousMinutes > 0 && currentMinutes !== previousMinutes) {
      const direction = currentMinutes > previousMinutes ? "increased" : "decreased";
      insights.push({
        id: "study_time_change",
        kind: "info",
        title: "Study time",
        detail: `Study time ${direction} from ${formatDurationMinutes(previousMinutes)} to ${formatDurationMinutes(currentMinutes)} versus the previous ${window.days} days.`,
        href: "/app/study",
        hrefLabel: "Open Study",
      });
    }
  }

  return insights;
}

// ============================================================================
// RECENT CHANGES
// ============================================================================

export type RecentChangeType = "learned" | "practiced" | "revised" | "mock" | "status";

export interface RecentChangeItem {
  id: string;
  type: RecentChangeType;
  /** Factual headline, e.g. "Learned Units & Measurements". */
  label: string;
  /** Supporting numbers, e.g. "24 questions · 71% accuracy". */
  detail: string;
  at: Date;
  href?: string;
}

export interface RecentChangesInput {
  examAttemptId: string;
  progressList: UserTopicProgress[];
  mockResults: MockTestResultDetail[];
  window: AnalyticsRangeWindow;
  /** Cap on returned items (newest first). */
  limit?: number;
}

/**
 * Recent changes derived from milestone timestamps and completion records
 * inside the window. Each item cites the record it came from.
 */
export function buildRecentChanges(input: RecentChangesInput): RecentChangeItem[] {
  const { examAttemptId, progressList, mockResults, window } = input;
  const limit = input.limit ?? 8;
  const items: RecentChangeItem[] = [];

  for (const progress of progressList) {
    const meta = getTopicMetadata(progress.topicId, examAttemptId);
    const topicName = meta?.topicName ?? "Topic";

    const learnedAt = toDate(progress.learnedAt ?? null);
    if (learnedAt && isDateInRange(learnedAt, window)) {
      items.push({
        id: `learned_${progress.topicId}`,
        type: "learned",
        label: `Learned ${topicName}`,
        detail: meta ? `${meta.subjectName} · ${meta.chapterName}` : "",
        at: learnedAt,
        href: `/app/study/${encodeURIComponent(progress.topicId)}`,
      });
    }

    const practicedAt = toDate(progress.practicedAt ?? null);
    if (practicedAt && isDateInRange(practicedAt, window) && progress.practiceAttempts > 0) {
      items.push({
        id: `practiced_${progress.topicId}`,
        type: "practiced",
        label: `Practiced ${topicName}`,
        detail: `${progress.practiceAttempts} ${progress.practiceAttempts === 1 ? "question" : "questions"} · ${formatAccuracy(progress.accuracy)} accuracy`,
        at: practicedAt,
        href: `/app/practice?topicId=${encodeURIComponent(progress.topicId)}`,
      });
    }

    const lastRevisedAt = toDate(progress.lastRevisedAt ?? progress.revisedAt ?? null);
    if (lastRevisedAt && isDateInRange(lastRevisedAt, window)) {
      items.push({
        id: `revised_${progress.topicId}`,
        type: "revised",
        label: `Revised ${topicName}`,
        detail: meta ? `${meta.subjectName} · ${meta.chapterName}` : "",
        at: lastRevisedAt,
        href: `/app/study/${encodeURIComponent(progress.topicId)}`,
      });
    }
  }

  for (const result of mockResults) {
    const completedAt = toDate(result.completedAt);
    if (completedAt && isDateInRange(completedAt, window)) {
      items.push({
        id: `mock_${result.id}`,
        type: "mock",
        label: `Completed mock: ${result.mockTitle}`,
        detail:
          result.totalMarks > 0
            ? `${result.rawScore} / ${result.totalMarks} marks · ${Math.round((result.accuracy ?? 0) / 100)}% accuracy`
            : `${Math.round((result.accuracy ?? 0) / 100)}% accuracy`,
        at: completedAt,
        href: "/app/mock-tests",
      });
    }
  }

  return items
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}

/** Study sessions are summarised, not listed individually. */
export function studySessionCount(sessions: StudySession[], window: AnalyticsRangeWindow): number {
  return sessions.filter((s) => isDateInRange(toDate(s.startedAt), window)).length;
}
