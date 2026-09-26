import type { UserTopicProgress, StudySession, PracticeSession, RevisionItem } from "@/db/schema";
import type { MockTestResultDetail } from "@/domain/mock-engine";
import type { QuestionSessionWithAttempts } from "@/domain/practice-engine";
import {
  startOfLocalDay,
  endOfLocalDay,
  addLocalDays,
} from "@/domain/revision";

/**
 * Analytics domain (Phase 12).
 *
 * A read-only aggregation layer over the data recorded by Phases 1–11.
 * Every metric here is derived from stored source records — coverage from
 * `user_topic_progress`, practice numbers from `practice_sessions`, study
 * time from `study_sessions`, revision state from the Phase 8 queue, mock
 * numbers from `mock_test_results`. Nothing is invented: a section without
 * data reports "not enough data" through its empty shape.
 *
 * No readiness scores, no predictions, no rankings — factual metrics only.
 */

// ============================================================================
// 1. TIME RANGES
// ============================================================================

export const ANALYTICS_RANGE_VALUES = ["7d", "30d", "90d", "all"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGE_VALUES)[number];

export const ANALYTICS_RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return typeof value === "string" && (ANALYTICS_RANGE_VALUES as readonly string[]).includes(value);
}

/** Calendar days covered by a finite range (including today); null = all time. */
export function analyticsRangeDays(range: AnalyticsRange): number | null {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "all":
      return null;
  }
}

export function analyticsRangeLabel(range: AnalyticsRange): string {
  return ANALYTICS_RANGE_OPTIONS.find((r) => r.value === range)?.label ?? "All time";
}

/**
 * Window for a range in local calendar time: finite ranges cover the last
 * N calendar days including today, from local midnight through the end of
 * the reference day. `start` is null for all time.
 */
export function getAnalyticsRangeWindow(
  range: AnalyticsRange,
  referenceDate: Date = new Date()
): AnalyticsRangeWindow {
  const days = analyticsRangeDays(range);
  const end = endOfLocalDay(referenceDate);
  const start = days === null ? null : addLocalDays(startOfLocalDay(referenceDate), -(days - 1));
  return { range, days, start, end, referenceDate: new Date(referenceDate) };
}

export interface AnalyticsRangeWindow {
  range: AnalyticsRange;
  /** Calendar days in a finite window; null = all time. */
  days: number | null;
  /** Local midnight of the first covered day; null = all time. */
  start: Date | null;
  /** End of the reference day (23:59:59.999 local). */
  end: Date;
  referenceDate: Date;
}

export function isDateInRange(date: Date | null | undefined, window: AnalyticsRangeWindow): boolean {
  if (!date) return false;
  const time = date.getTime();
  if (Number.isNaN(time)) return false;
  if (window.start !== null && time < window.start.getTime()) return false;
  return time <= window.end.getTime();
}

/**
 * The equal-length window immediately before `window` (null start stays
 * null). Used for factual "compared with the previous period" statements.
 */
export function getPreviousWindow(window: AnalyticsRangeWindow): AnalyticsRangeWindow | null {
  if (window.start === null) return null;
  const days = window.days ?? 0;
  const start = addLocalDays(startOfLocalDay(window.start), -days);
  const end = new Date(window.start.getTime() - 1);
  return { ...window, start, end };
}

// ============================================================================
// 2. SNAPSHOT INPUT (one bulk read per section source)
// ============================================================================

/**
 * Everything the analytics layer needs, read once per view. Repositories are
 * only touched by `loadAnalyticsSnapshot`; the builders below are pure.
 */
export interface AnalyticsSnapshotInput {
  workspaceId: string;
  examAttemptId: string;
  progressList: UserTopicProgress[];
  studySessions: StudySession[];
  practiceSessions: PracticeSession[];
  revisionItems: RevisionItem[];
  mockResults: MockTestResultDetail[];
  /**
   * Question-engine sessions from the Phase 10 repository. Both repository
   * implementations cap this list at the 10 most recent sessions, so any
   * totals built from it are labelled "recent" and never presented as
   * all-time question history.
   */
  recentQuestionSessions: QuestionSessionWithAttempts[];
  window: AnalyticsRangeWindow;
}
