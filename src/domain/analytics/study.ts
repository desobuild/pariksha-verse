import type { PracticeSession, StudySession } from "@/db/schema";
import type { MockTestResultDetail } from "@/domain/mock-engine";
import { getTopicMetadata } from "@/domain/dashboard";
import { toDate } from "@/domain/revision";
import type { AnalyticsRangeWindow } from "./types";
import { isDateInRange, getPreviousWindow } from "./types";
import { generateBuckets, bucketIndexForDate, type TrendBucketBase } from "./trends";

/**
 * Study activity (Section 4) and consistency (Section 9).
 *
 * Built exclusively from recorded `study_sessions` — planned time never
 * counts as studied time. Day/bucket keys use the established local
 * calendar semantics (Phase 8 helpers), so "last 7 days" always means the
 * 7 local calendar days ending today.
 */

// ============================================================================
// 1. STUDY TIME
// ============================================================================

export interface SubjectStudyTime {
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  minutes: number;
  sessions: number;
}

export interface StudyBucket extends TrendBucketBase {
  minutes: number;
  sessions: number;
  hasActivity: boolean;
}

export interface StudyTimeAnalytics {
  totalMinutes: number;
  sessionCount: number;
  /** Mean minutes per session; 0 with no sessions. */
  avgSessionMinutes: number;
  /** Distinct local calendar days with at least one recorded session. */
  activeStudyDays: number;
  /** Subjects in canonical order; only subjects with time appear. */
  bySubject: SubjectStudyTime[];
  /** Every bucket in the window, chronological; zero = no activity. */
  series: StudyBucket[];
  /** Total minutes in the equal-length window before this one (finite ranges only). */
  previousWindowMinutes: number | null;
}

export function buildStudyAnalytics(
  sessions: StudySession[],
  examAttemptId: string,
  window: AnalyticsRangeWindow
): StudyTimeAnalytics {
  const inWindow = sessions.filter((s) => isDateInRange(toDate(s.startedAt), window));

  let totalMinutes = 0;
  const activeDays = new Set<string>();
  const subjectTotals = new Map<string, SubjectStudyTime>();

  for (const session of inWindow) {
    totalMinutes += session.durationMinutes || 0;
    const startedAt = toDate(session.startedAt);
    if (startedAt) activeDays.add(localDayKey(startedAt));

    if (session.topicId) {
      const meta = getTopicMetadata(session.topicId, examAttemptId);
      if (meta) {
        const current = subjectTotals.get(meta.subjectId) ?? {
          subjectId: meta.subjectId,
          subjectName: meta.subjectName,
          subjectSlug: meta.subjectSlug,
          minutes: 0,
          sessions: 0,
        };
        current.minutes += session.durationMinutes || 0;
        current.sessions += 1;
        subjectTotals.set(meta.subjectId, current);
      }
    }
  }

  // Buckets span the whole window; sessions cannot land twice.
  const buckets = generateBuckets(window, earliestOf(inWindow, (s) => toDate(s.startedAt))).map<StudyBucket>(
    (b) => ({ ...b, minutes: 0, sessions: 0, hasActivity: false })
  );
  for (const session of inWindow) {
    const index = bucketIndexForDate(toDate(session.startedAt), buckets, window);
    if (index === -1) continue;
    buckets[index].minutes += session.durationMinutes || 0;
    buckets[index].sessions += 1;
  }
  for (const bucket of buckets) {
    bucket.hasActivity = bucket.minutes > 0 || bucket.sessions > 0;
  }

  const previous = getPreviousWindow(window);
  let previousWindowMinutes: number | null = null;
  if (previous) {
    previousWindowMinutes = sessions
      .filter((s) => isDateInRange(toDate(s.startedAt), previous))
      .reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  }

  return {
    totalMinutes,
    sessionCount: inWindow.length,
    avgSessionMinutes:
      inWindow.length > 0 ? Math.round((totalMinutes / inWindow.length) * 10) / 10 : 0,
    activeStudyDays: activeDays.size,
    bySubject: [...subjectTotals.values()].sort(
      (a, b) => b.minutes - a.minutes || a.subjectName.localeCompare(b.subjectName)
    ),
    series: buckets,
    previousWindowMinutes,
  };
}

// ============================================================================
// 2. CONSISTENCY (factual activity counts, no gamification)
// ============================================================================

export interface ConsistencyAnalytics {
  /** Calendar days covered by the window; null = all time. */
  windowDays: number | null;
  windowLabel: string;
  activeStudyDays: number;
  activePracticeDays: number;
  studySessions: number;
  practiceSessions: number;
  mocksCompleted: number;
  revisionCompletions: number;
}

export function buildConsistencyAnalytics(input: {
  studySessions: StudySession[];
  practiceSessions: PracticeSession[];
  mockResults: MockTestResultDetail[];
  revisionCompletions: number;
  window: AnalyticsRangeWindow;
  windowLabel: string;
}): ConsistencyAnalytics {
  const { studySessions, practiceSessions, mockResults, revisionCompletions, window } = input;

  return {
    windowDays: window.days,
    windowLabel: input.windowLabel,
    activeStudyDays: countActiveDays(studySessions, window, (s) => s.startedAt),
    activePracticeDays: countActiveDays(practiceSessions, window, (s) => s.completedAt),
    studySessions: countInRange(studySessions, window, (s) => s.startedAt),
    practiceSessions: countInRange(practiceSessions, window, (s) => s.completedAt),
    mocksCompleted: countInRange(mockResults, window, (r) => r.completedAt),
    revisionCompletions,
  };
}

// ============================================================================
// helpers
// ============================================================================

function countActiveDays<T>(
  items: T[],
  window: AnalyticsRangeWindow,
  getDate: (item: T) => Date | string | null | undefined
): number {
  const days = new Set<string>();
  for (const item of items) {
    const date = toDate(getDate(item));
    if (isDateInRange(date, window) && date) days.add(localDayKey(date));
  }
  return days.size;
}

function countInRange<T>(
  items: T[],
  window: AnalyticsRangeWindow,
  getDate: (item: T) => Date | string | null | undefined
): number {
  return items.filter((item) => isDateInRange(toDate(getDate(item)), window)).length;
}

function earliestOf<T>(
  items: T[],
  getDate: (item: T) => Date | null
): Date | null {
  let earliest: Date | null = null;
  for (const item of items) {
    const date = getDate(item);
    if (date && (earliest === null || date.getTime() < earliest.getTime())) earliest = date;
  }
  return earliest;
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
