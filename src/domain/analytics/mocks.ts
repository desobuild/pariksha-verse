import type { MockTestResultDetail } from "@/domain/mock-engine";
import type { MockSectionResult } from "@/domain/mock-engine";
import { calculateAccuracyBps } from "@/domain/practice";
import { toDate } from "@/domain/revision";
import type { AnalyticsRangeWindow } from "./types";
import { isDateInRange } from "./types";

/**
 * Mock performance (Section 7).
 *
 * Raw mock scores are only meaningful inside their own configuration
 * (marks, marking scheme, question counts differ between mocks), so cross-
 * mock averages use normalized measures only — accuracy and "percentage of
 * maximum marks", clearly labelled. Raw scores are always shown next to
 * their own maximum ("312 / 720"). No percentiles, no predictions, no
 * comparison with other students.
 */

export interface MockHistoryEntry {
  resultId: string;
  mockTestId: string;
  title: string;
  completedAt: Date;
  submissionStatus: MockTestResultDetail["submissionStatus"];
  rawScore: number;
  totalMarks: number;
  /** rawScore / totalMarks as a percentage of THIS mock's maximum, 0–100 (1 dp). */
  scorePctOfMax: number | null;
  accuracyBps: number;
  accuracyPct: number;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  timeSpentSeconds: number;
  sections: MockSectionResult[];
}

export interface MockSectionAggregate {
  sectionId: string;
  name: string;
  /** Completed mocks contributing to this section. */
  mocks: number;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  /** Weighted accuracy across all attempts in the section. */
  accuracyBps: number;
  rawScore: number;
  maxScore: number;
}

export interface MockAnalytics {
  /** Results with completedAt inside the window, newest first. */
  completed: number;
  /** Mean percentage-of-maximum across mocks; null with no data. */
  avgScorePctOfMax: number | null;
  best: { title: string; scorePctOfMax: number | null; accuracyBps: number } | null;
  avgAccuracyBps: number | null;
  /** Mean minutes spent per mock; null with no data. */
  avgTimeMinutes: number | null;
  history: MockHistoryEntry[];
  /** Chronological (oldest first) for trend display. */
  trend: { key: string; label: string; accuracyBps: number; scorePctOfMax: number | null }[];
  /**
   * Per-section aggregation across mocks. Populated only when at least two
   * completed mocks carry section results — a single mock's sections stay
   * visible in its history entry instead.
   */
  sectionPerformance: MockSectionAggregate[];
  /** Mocks with section results inside the window. */
  resultsWithSections: number;
}

/** Minimum completed mocks with sections before cross-mock section analysis. */
export const MOCK_SECTION_MIN_RESULTS = 2;

export function buildMockAnalytics(
  results: MockTestResultDetail[],
  window: AnalyticsRangeWindow
): MockAnalytics {
  const inWindow = results
    .filter((r) => isDateInRange(toDate(r.completedAt), window))
    .map(toHistoryEntry)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

  const withScore = inWindow.filter((r) => r.totalMarks > 0);

  const avgScorePctOfMax =
    withScore.length > 0
      ? round1(withScore.reduce((acc, r) => acc + (r.scorePctOfMax ?? 0), 0) / withScore.length)
      : null;

  const avgAccuracyBps =
    inWindow.length > 0
      ? Math.round(inWindow.reduce((acc, r) => acc + r.accuracyBps, 0) / inWindow.length)
      : null;

  const avgTimeMinutes =
    inWindow.length > 0
      ? round1(inWindow.reduce((acc, r) => acc + r.timeSpentSeconds, 0) / inWindow.length / 60)
      : null;

  let best: MockAnalytics["best"] = null;
  for (const entry of inWindow) {
    if (entry.scorePctOfMax === null) continue;
    if (best === null || (best.scorePctOfMax ?? 0) < entry.scorePctOfMax) {
      best = {
        title: entry.title,
        scorePctOfMax: entry.scorePctOfMax,
        accuracyBps: entry.accuracyBps,
      };
    }
  }

  // Chronological trend, oldest first.
  const trend = [...inWindow]
    .reverse()
    .map((entry, index) => ({
      key: `${entry.resultId}_${index}`,
      label: formatDateLabel(entry.completedAt),
      accuracyBps: entry.accuracyBps,
      scorePctOfMax: entry.scorePctOfMax,
    }));

  const withSections = inWindow.filter((r) => r.sections.length > 0);
  const sectionPerformance =
    withSections.length >= MOCK_SECTION_MIN_RESULTS
      ? aggregateSections(withSections)
      : [];

  return {
    completed: inWindow.length,
    avgScorePctOfMax,
    best,
    avgAccuracyBps,
    avgTimeMinutes,
    history: inWindow,
    trend,
    sectionPerformance,
    resultsWithSections: withSections.length,
  };
}

function toHistoryEntry(result: MockTestResultDetail): MockHistoryEntry {
  const completedAt = toDate(result.completedAt) ?? new Date(0);
  return {
    resultId: result.id,
    mockTestId: result.mockTestId,
    title: result.mockTitle,
    completedAt,
    submissionStatus: result.submissionStatus,
    rawScore: result.rawScore,
    totalMarks: result.totalMarks,
    scorePctOfMax:
      result.totalMarks > 0
        ? round1((result.rawScore / result.totalMarks) * 100)
        : null,
    accuracyBps: result.accuracy ?? calculateAccuracyBps(result.correct, result.attempted),
    accuracyPct: result.accuracyPct ?? Math.round((result.accuracy ?? 0) / 100),
    totalQuestions: result.totalQuestions,
    attempted: result.attempted,
    correct: result.correct,
    incorrect: result.incorrect,
    unattempted: result.unattempted,
    timeSpentSeconds: result.timeSpentSeconds,
    sections: result.sections ?? [],
  };
}

function aggregateSections(entries: MockHistoryEntry[]): MockSectionAggregate[] {
  const bySection = new Map<string, MockSectionAggregate>();

  for (const entry of entries) {
    for (const section of entry.sections) {
      const current = bySection.get(section.sectionId) ?? {
        sectionId: section.sectionId,
        name: section.name,
        mocks: 0,
        totalQuestions: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        accuracyBps: 0,
        rawScore: 0,
        maxScore: 0,
      };
      current.mocks += 1;
      current.totalQuestions += section.totalQuestions;
      current.attempted += section.attempted;
      current.correct += section.correct;
      current.incorrect += section.incorrect;
      current.unanswered += section.unanswered;
      current.rawScore += section.rawScore;
      current.maxScore += section.maxScore;
      current.accuracyBps = calculateAccuracyBps(current.correct, current.attempted);
      bySection.set(section.sectionId, current);
    }
  }

  return [...bySection.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
