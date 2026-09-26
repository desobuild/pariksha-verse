import type { PracticeSession } from "@/db/schema";
import {
  startOfLocalDay,
  addLocalDays,
  diffLocalDays,
  toDate,
} from "@/domain/revision";
import { calculateAccuracyBps } from "@/domain/practice";
import type { AnalyticsRangeWindow } from "./types";
import { isDateInRange } from "./types";

/**
 * Time bucketing and practice trend generation.
 *
 * Buckets always cover the whole selected window so a day (or week/month)
 * with no practice renders as an empty slot — never as 0% accuracy.
 * Accuracy is only defined for buckets that contain at least one attempt.
 */

// ============================================================================
// 1. BUCKET MODEL
// ============================================================================

export interface TrendBucketBase {
  /** Stable bucket key (yyyy-mm-dd for days, ISO week span, yyyy-mm for months). */
  key: string;
  /** Short human label for axis/tooltip use. */
  label: string;
  /** Inclusive bucket start (local midnight). */
  start: Date;
  /** Inclusive bucket end (end of day). */
  end: Date;
}

/**
 * @param earliest earliest relevant activity timestamp; widens monthly
 *   all-time buckets so no in-window record falls outside the series.
 */
export function generateBuckets(window: AnalyticsRangeWindow, earliest?: Date | null): TrendBucketBase[] {
  if (window.start === null) {
    return generateMonthlyBuckets(window, earliest);
  }
  const days = window.days ?? 0;
  if (days <= 30) {
    return generateDailyBuckets(window);
  }
  return generateWeeklyBuckets(window);
}

function generateDailyBuckets(window: AnalyticsRangeWindow): TrendBucketBase[] {
  const buckets: TrendBucketBase[] = [];
  const totalDays = window.days ?? 0;
  for (let i = 0; i < totalDays; i++) {
    const day = addLocalDays(startOfLocalDay(window.start!), i);
    buckets.push({
      key: formatDayKey(day),
      label: formatBucketLabel(day, window.referenceDate, "day"),
      start: startOfLocalDay(day),
      end: endOfLocalDaySafe(day),
    });
  }
  return buckets;
}

function generateWeeklyBuckets(window: AnalyticsRangeWindow): TrendBucketBase[] {
  const buckets: TrendBucketBase[] = [];
  const totalDays = window.days ?? 0;
  const firstStart = startOfLocalDay(window.start!);
  for (let offset = 0; offset < totalDays; offset += 7) {
    const span = Math.min(7, totalDays - offset);
    const start = addLocalDays(firstStart, offset);
    const endDay = addLocalDays(firstStart, offset + span - 1);
    buckets.push({
      key: `${formatDayKey(start)}_week`,
      label: formatBucketLabel(start, window.referenceDate, "week", endDay),
      start: startOfLocalDay(start),
      end: endOfLocalDaySafe(endDay),
    });
  }
  return buckets;
}

/**
 * Monthly buckets for the all-time window. Months run from the earliest
 * relevant activity date (when provided) through the reference month, so
 * the series never extends into months that cannot hold data.
 */
function generateMonthlyBuckets(window: AnalyticsRangeWindow, earliest?: Date | null): TrendBucketBase[] {
  const reference = startOfLocalDay(window.referenceDate);
  let firstMonth = new Date(reference.getFullYear(), reference.getMonth(), 1);
  if (earliest && !Number.isNaN(earliest.getTime())) {
    const candidate = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    if (candidate.getTime() < firstMonth.getTime()) firstMonth = candidate;
  }
  // Guard against unbounded series from corrupt timestamps.
  const maxMonths = 24;
  if (diffLocalDays(firstMonth, reference) > 365 * maxMonths) {
    firstMonth = addLocalDays(reference, -365);
    firstMonth = new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1);
  }

  const buckets: TrendBucketBase[] = [];
  const cursor = new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1);
  while (cursor.getTime() <= reference.getTime()) {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    buckets.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: cursor.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      start,
      end,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function endOfLocalDaySafe(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function formatDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatBucketLabel(
  d: Date,
  referenceDate: Date,
  granularity: "day" | "week",
  weekEnd?: Date
): string {
  const dayDiff = diffLocalDays(d, referenceDate);
  if (granularity === "day") {
    if (dayDiff === 0) return "Today";
    if (dayDiff === -1) return "Yesterday";
  }
  if (granularity === "week" && weekEnd) {
    const fmt = (x: Date) => x.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `${fmt(d)}–${fmt(weekEnd)}`;
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Assigns a timestamp to its bucket index, or -1 when outside the window. */
export function bucketIndexForDate(date: Date | null, buckets: TrendBucketBase[], window: AnalyticsRangeWindow): number {
  const d = toDate(date);
  if (!d || !isDateInRange(d, window)) return -1;
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    if (d.getTime() >= b.start.getTime() && d.getTime() <= b.end.getTime()) return i;
  }
  return -1;
}

// ============================================================================
// 2. PRACTICE TRENDS
// ============================================================================

export interface PracticeTrendBucket extends TrendBucketBase {
  /** Questions attempted within the bucket (0 = no practice). */
  questions: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  sessions: number;
  /** False when nothing was practiced — accuracy must not be read as 0%. */
  hasActivity: boolean;
  /** Basis points; null when the bucket has no activity. */
  accuracyBps: number | null;
}

export interface PracticeTrendTotals {
  questions: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  sessions: number;
  accuracyBps: number;
  /** Mean attempted questions per session; 0 with no sessions. */
  avgQuestionsPerSession: number;
}

export interface PracticeTrendAnalytics {
  buckets: PracticeTrendBucket[];
  totals: PracticeTrendTotals;
  /** Buckets with activity only, chronological — the accuracy series. */
  accuracySeries: { key: string; label: string; accuracyBps: number; questions: number }[];
}

export function buildPracticeTrends(
  sessions: PracticeSession[],
  window: AnalyticsRangeWindow
): PracticeTrendAnalytics {
  let earliest: Date | null = null;
  for (const session of sessions) {
    const completedAt = toDate(session.completedAt);
    if (completedAt && (earliest === null || completedAt.getTime() < earliest.getTime())) {
      earliest = completedAt;
    }
  }

  const buckets = generateBuckets(window, earliest).map<PracticeTrendBucket>((b) => ({
    ...b,
    questions: 0,
    correct: 0,
    incorrect: 0,
    unattempted: 0,
    sessions: 0,
    hasActivity: false,
    accuracyBps: null,
  }));

  const totals: PracticeTrendTotals = {
    questions: 0,
    correct: 0,
    incorrect: 0,
    unattempted: 0,
    sessions: 0,
    accuracyBps: 0,
    avgQuestionsPerSession: 0,
  };

  for (const session of sessions) {
    const completedAt = toDate(session.completedAt);
    const index = bucketIndexForDate(completedAt, buckets, window);
    // Totals cover the whole selected window only.
    if (index === -1) continue;
    const bucket = buckets[index];
    const questions = session.questionCount || 0;
    bucket.questions += questions;
    bucket.correct += session.correct || 0;
    bucket.incorrect += session.incorrect || 0;
    bucket.unattempted += session.unattempted || 0;
    bucket.sessions += 1;

    totals.questions += questions;
    totals.correct += session.correct || 0;
    totals.incorrect += session.incorrect || 0;
    totals.unattempted += session.unattempted || 0;
    totals.sessions += 1;
  }

  for (const bucket of buckets) {
    bucket.hasActivity = bucket.questions > 0;
    bucket.accuracyBps = bucket.hasActivity
      ? calculateAccuracyBps(bucket.correct, bucket.questions)
      : null;
  }

  totals.accuracyBps = calculateAccuracyBps(totals.correct, totals.questions);
  totals.avgQuestionsPerSession =
    totals.sessions > 0 ? Math.round((totals.questions / totals.sessions) * 10) / 10 : 0;

  const accuracySeries = buckets
    .filter((b) => b.hasActivity && b.accuracyBps !== null)
    .map((b) => ({
      key: b.key,
      label: b.label,
      accuracyBps: b.accuracyBps as number,
      questions: b.questions,
    }));

  return { buckets, totals, accuracySeries };
}
