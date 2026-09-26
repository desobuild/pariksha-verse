"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart2 } from "lucide-react";
import { useRepositories } from "@/repositories/repository-provider";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { PageContainer } from "@/components/navigation/page-container";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ANALYTICS_RANGE_OPTIONS,
  analyticsRangeLabel,
  getAnalyticsRangeWindow,
  buildAnalyticsSnapshot,
  type AnalyticsRange,
  type AnalyticsSnapshotInput,
} from "@/domain/analytics";
import { getExamAttempt } from "@/domain/exam-catalog";
import { CoverageSection } from "./coverage-section";
import { InsightsSection, RecentChangesSection } from "./insights-section";
import { SubjectPerformanceSection } from "./subject-performance-section";
import { TopicPerformanceSection } from "./topic-performance-section";
import { PracticeTrendsSection } from "./practice-trends-section";
import { StudyActivitySection } from "./study-activity-section";
import { QuestionPerformanceSection } from "./question-performance-section";
import { MockPerformanceSection } from "./mock-performance-section";
import { RevisionActivitySection } from "./revision-activity-section";
import { ConsistencySection } from "./consistency-section";

interface AnalyticsRawData {
  /** Reference instant fixed at fetch time so range switches stay stable. */
  referenceDate: Date;
  progressList: AnalyticsSnapshotInput["progressList"];
  studySessions: AnalyticsSnapshotInput["studySessions"];
  practiceSessions: AnalyticsSnapshotInput["practiceSessions"];
  revisionItems: AnalyticsSnapshotInput["revisionItems"];
  mockResults: AnalyticsSnapshotInput["mockResults"];
  recentQuestionSessions: AnalyticsSnapshotInput["recentQuestionSessions"];
}

const DEFAULT_RANGE: AnalyticsRange = "30d";

/**
 * The Progress screen (Phase 12): the primary analytics destination.
 *
 * Raw workspace data is loaded once via the repository abstractions (guest
 * IndexedDB or authenticated D1-backed repositories — analytics does not
 * care which), then every section is derived in memory for the selected
 * time range. No section calculates its own metrics.
 */
export function AnalyticsWorkspace() {
  const router = useRouter();
  const repos = useRepositories();
  const { workspace, status } = useActiveWorkspace();

  const [range, setRange] = React.useState<AnalyticsRange>(DEFAULT_RANGE);
  const [data, setData] = React.useState<AnalyticsRawData | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (status === "ready" && !workspace) {
      router.replace("/exam/select");
    }
  }, [status, workspace, router]);

  React.useEffect(() => {
    if (status !== "ready" || !workspace) return;
    let cancelled = false;
    setLoadError(null);
    Promise.all([
      repos.progress.getAllProgressForWorkspace(workspace.id),
      repos.studySession.getSessionsForWorkspace(workspace.id).catch(() => []),
      repos.practice.getPracticeSessions(workspace.id).catch(() => []),
      repos.revision.getRevisionItems(workspace.id).catch(() => []),
      repos.mock.getAllResultsForWorkspace(workspace.id).catch(() => []),
      repos.questionSession.getRecentQuestionSessions(workspace.id).catch(() => []),
    ])
      .then(
        ([
          progressList,
          studySessions,
          practiceSessions,
          revisionItems,
          mockResults,
          recentQuestionSessions,
        ]) => {
          if (cancelled) return;
          setData({
            referenceDate: new Date(),
            progressList,
            studySessions,
            practiceSessions,
            revisionItems,
            mockResults,
            recentQuestionSessions,
          });
        }
      )
      .catch(() => {
        if (!cancelled) setLoadError("Could not load your analytics data.");
      });
    return () => {
      cancelled = true;
    };
  }, [repos, workspace, status, reloadKey]);

  const window = React.useMemo(
    () => getAnalyticsRangeWindow(range, data?.referenceDate ?? new Date()),
    [range, data]
  );

  const snapshot = React.useMemo(() => {
    if (!data || !workspace) return null;
    return buildAnalyticsSnapshot({
      workspaceId: workspace.id,
      examAttemptId: workspace.examAttemptId,
      window,
      progressList: data.progressList,
      studySessions: data.studySessions,
      practiceSessions: data.practiceSessions,
      revisionItems: data.revisionItems,
      mockResults: data.mockResults,
      recentQuestionSessions: data.recentQuestionSessions,
    });
  }, [data, workspace, window]);

  if (status === "loading" || !workspace) {
    return (
      <PageContainer className="py-6 sm:py-8" size="wide">
        <LoadingSkeleton count={5} />
      </PageContainer>
    );
  }

  if (loadError && !data) {
    return (
      <PageContainer className="py-6 sm:py-8" size="wide">
        <ErrorState
          title="Could not load your analytics"
          message={loadError}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </PageContainer>
    );
  }

  if (!data || !snapshot) {
    return (
      <PageContainer className="py-6 sm:py-8" size="wide">
        <LoadingSkeleton count={5} />
      </PageContainer>
    );
  }

  const attemptLabel = getExamAttempt(workspace.examAttemptId)?.label ?? "Your exam";
  const periodLabel = analyticsRangeLabel(range);
  const subjects = snapshot.coverage.subjects.map((s) => ({
    id: s.subjectId,
    name: s.subjectName,
    slug: s.subjectSlug,
  }));
  const hasPracticeInRange = snapshot.practice.totals.sessions > 0;

  return (
    <PageContainer className="py-6 sm:py-8" size="wide">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="type-h1">Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Analytics for {attemptLabel} — every number comes from your recorded activity.
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as AnalyticsRange)}>
          <div className="max-w-full overflow-x-auto">
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto sm:w-auto">
              {ANALYTICS_RANGE_OPTIONS.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className="min-h-[44px] flex-1 px-4 sm:flex-none"
                  aria-label={`Time range: ${option.label}`}
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </header>

      {/* First-visit orientation before any data exists */}
      {!snapshot.hasAnyActivity && (
        <div className="mt-6">
          <EmptyState
            icon={<BarChart2 className="h-6 w-6" aria-hidden="true" />}
            title="No preparation data yet"
            description="Coverage below reflects the full syllabus. Study, practice and mock analytics will appear as soon as you record your first session."
            action={
              <Button asChild size="sm" className="min-h-[44px]">
                <Link href="/app/study">Start Studying</Link>
              </Button>
            }
          />
        </div>
      )}

      <div className="mt-6 space-y-8">
        {/* WHERE AM I */}
        <CoverageSection coverage={snapshot.coverage} />

        {/* WHAT TO FOCUS ON — deterministic, traceable statements */}
        <InsightsSection insights={snapshot.insights} />

        {/* WHAT AM I GOOD AT / WHAT NEEDS ATTENTION */}
        <SubjectPerformanceSection subjects={snapshot.subjects} periodLabel={periodLabel} />

        <TopicPerformanceSection
          topics={snapshot.topics}
          subjects={subjects}
          periodLabel={periodLabel}
          hasAnyPracticeInRange={hasPracticeInRange}
        />

        {/* HOW AM I TRENDING */}
        <PracticeTrendsSection practice={snapshot.practice} periodLabel={periodLabel} />

        <StudyActivitySection study={snapshot.study} periodLabel={periodLabel} />

        <QuestionPerformanceSection questions={snapshot.questions} />

        <MockPerformanceSection mocks={snapshot.mocks} periodLabel={periodLabel} />

        <RevisionActivitySection revision={snapshot.revision} periodLabel={periodLabel} />

        <ConsistencySection consistency={snapshot.consistency} />

        <RecentChangesSection items={snapshot.recentChanges} />
      </div>
    </PageContainer>
  );
}
