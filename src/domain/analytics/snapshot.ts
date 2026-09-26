import type { UserWorkspace } from "@/db/schema";
import type { DomainRepositories } from "@/repositories/interfaces";
import type {
  AnalyticsSnapshotInput,
  AnalyticsRange,
  AnalyticsRangeWindow,
} from "./types";
import { getAnalyticsRangeWindow, analyticsRangeLabel } from "./types";
import type { CoverageAnalytics } from "./coverage";
import type { SubjectPerformanceAnalytics, TopicPerformanceAnalytics, QuestionAnalytics } from "./performance";
import type { PracticeTrendAnalytics } from "./trends";
import type { StudyTimeAnalytics, ConsistencyAnalytics } from "./study";
import type { RevisionActivityAnalytics } from "./revision";
import type { MockAnalytics } from "./mocks";
import type { AnalyticsInsight, RecentChangeItem } from "./insights";
import { buildCoverageAnalytics } from "./coverage";
import {
  buildSubjectPerformance,
  buildTopicPerformance,
  buildQuestionAnalytics,
  filterPracticeSessionsByWindow,
} from "./performance";
import { buildPracticeTrends } from "./trends";
import { buildStudyAnalytics, buildConsistencyAnalytics } from "./study";
import { buildRevisionAnalytics } from "./revision";
import { buildMockAnalytics } from "./mocks";
import { buildInsights, buildRecentChanges } from "./insights";

/** The complete analytics view: every section derived once from source data. */
export interface AnalyticsSnapshot {
  workspaceId: string;
  examAttemptId: string;
  generatedAt: Date;
  window: AnalyticsRangeWindow;
  coverage: CoverageAnalytics;
  subjects: SubjectPerformanceAnalytics[];
  topics: TopicPerformanceAnalytics[];
  practice: PracticeTrendAnalytics;
  study: StudyTimeAnalytics;
  questions: QuestionAnalytics;
  mocks: MockAnalytics;
  revision: RevisionActivityAnalytics;
  consistency: ConsistencyAnalytics;
  insights: AnalyticsInsight[];
  recentChanges: RecentChangeItem[];
  /** True when the workspace holds no activity of any kind. */
  hasAnyActivity: boolean;
}

/**
 * Loads every analytics source in one bulk fan-out and derives the full
 * snapshot in memory. Works identically for guest (IndexedDB) and
 * authenticated (D1-backed) repositories because both satisfy
 * `DomainRepositories` — analytics never knows where data came from.
 *
 * Read failures degrade to empty lists (same policy as the Phase 6
 * dashboard loader) so one flaky endpoint cannot blank the page.
 */
export async function loadAnalyticsSnapshot(
  repos: DomainRepositories,
  workspace: UserWorkspace,
  options: { range?: AnalyticsRange; referenceDate?: Date } = {}
): Promise<AnalyticsSnapshot> {
  const window: AnalyticsRangeWindow = getAnalyticsRangeWindow(
    options.range ?? "30d",
    options.referenceDate ?? new Date()
  );

  const [
    progressList,
    studySessions,
    practiceSessions,
    revisionItems,
    mockResults,
    recentQuestionSessions,
  ] = await Promise.all([
    repos.progress.getAllProgressForWorkspace(workspace.id).catch(() => []),
    repos.studySession.getSessionsForWorkspace(workspace.id).catch(() => []),
    repos.practice.getPracticeSessions(workspace.id).catch(() => []),
    repos.revision.getRevisionItems(workspace.id).catch(() => []),
    repos.mock.getAllResultsForWorkspace(workspace.id).catch(() => []),
    repos.questionSession.getRecentQuestionSessions(workspace.id).catch(() => []),
  ]);

  return buildAnalyticsSnapshot({
    workspaceId: workspace.id,
    examAttemptId: workspace.examAttemptId,
    progressList,
    studySessions,
    practiceSessions,
    revisionItems,
    mockResults,
    recentQuestionSessions,
    window,
  });
}

/**
 * Pure snapshot assembly from already-loaded records — unit-testable
 * without any repository.
 */
export function buildAnalyticsSnapshot(input: AnalyticsSnapshotInput): AnalyticsSnapshot {
  const { window } = input;

  // Coverage is cumulative state and intentionally not windowed.
  const coverage = buildCoverageAnalytics(input.examAttemptId, input.progressList);

  // All-time windows use the canonical Phase 9 aggregation (sessions with
  // the standard progress fallback); finite windows aggregate only the
  // sessions inside the window, so cumulative counters never leak into a
  // "last 7 days" view. Topic status and revision state always come from
  // the full progress list — preparation state is cumulative, not windowed.
  const windowSessions = filterPracticeSessionsByWindow(input.practiceSessions, window);
  const allTime = window.start === null;
  const performanceSessions = allTime ? input.practiceSessions : windowSessions;
  const metricsFallbackProgress = allTime ? input.progressList : [];

  const topics = buildTopicPerformance(
    input.examAttemptId,
    performanceSessions,
    input.progressList,
    input.revisionItems,
    window.referenceDate,
    metricsFallbackProgress
  );
  const subjects = buildSubjectPerformance(input.examAttemptId, topics, input.progressList);

  const practice = buildPracticeTrends(windowSessions, window);
  const study = buildStudyAnalytics(input.studySessions, input.examAttemptId, window);
  const questions = buildQuestionAnalytics(input.recentQuestionSessions, input.examAttemptId);
  const mocks = buildMockAnalytics(input.mockResults, window);
  const revision = buildRevisionAnalytics(
    input.examAttemptId,
    input.progressList,
    input.revisionItems,
    window
  );
  const consistency = buildConsistencyAnalytics({
    studySessions: input.studySessions,
    practiceSessions: input.practiceSessions,
    mockResults: input.mockResults,
    revisionCompletions: revision.completionsInRange,
    window,
    windowLabel: analyticsRangeLabel(window.range),
  });

  // Insights are factual statements about all recorded data.
  const insights = buildInsights({
    examAttemptId: input.examAttemptId,
    coverage,
    progressList: input.progressList,
    practiceSessions: input.practiceSessions,
    revision,
    mocks,
    study,
    window,
  });

  const recentChanges = buildRecentChanges({
    examAttemptId: input.examAttemptId,
    progressList: input.progressList,
    mockResults: input.mockResults,
    window,
  });

  const hasAnyActivity =
    input.studySessions.length > 0 ||
    input.practiceSessions.length > 0 ||
    input.mockResults.length > 0 ||
    input.recentQuestionSessions.length > 0 ||
    input.progressList.length > 0;

  return {
    workspaceId: input.workspaceId,
    examAttemptId: input.examAttemptId,
    generatedAt: new Date(),
    window,
    coverage,
    subjects,
    topics,
    practice,
    study,
    questions,
    mocks,
    revision,
    consistency,
    insights,
    recentChanges,
    hasAnyActivity,
  };
}
