"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PlusCircle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/navigation/page-container";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useRepositories } from "@/repositories/repository-provider";
import type { PracticeSession, UserTopicProgress } from "@/db/schema";
import {
  aggregateAllTopicsPerformance,
  getSubjectPracticePerformance,
  getOverallPracticeSnapshot,
  getWeakTopics,
  sortRecentPracticeSessions,
  type PracticeSubjectFilter,
  type PracticePerformanceFilter,
} from "@/domain/practice";
import { getSubjectTaxonomySummary } from "@/domain/dashboard";

import { RecordPracticeDialog } from "./record-practice-dialog";
import { PerformanceSnapshot } from "./performance-snapshot";
import { SubjectPerformance } from "./subject-performance";
import { WeakTopicsList } from "./weak-topics-list";
import { RecentPracticeList } from "./recent-practice-list";
import { PracticeFilters } from "./practice-filters";

export function PracticeWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTopicId = searchParams.get("topicId");

  const { workspace, status } = useActiveWorkspace();
  const workspaceLoading = status === "loading";
  const repos = useRepositories();

  const [loadingData, setLoadingData] = React.useState(true);
  const [hasInitialLoaded, setHasInitialLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  // Raw data from repository
  const [sessions, setSessions] = React.useState<PracticeSession[]>([]);
  const [progressList, setProgressList] = React.useState<UserTopicProgress[]>([]);

  // Dialog state
  const [recordDialogOpen, setRecordDialogOpen] = React.useState(false);
  const [targetTopicId, setTargetTopicId] = React.useState<string | null>(null);

  // Filters
  const [subjectFilter, setSubjectFilter] = React.useState<PracticeSubjectFilter>("all");
  const [performanceFilter, setPerformanceFilter] = React.useState<PracticePerformanceFilter>("all");

  // Handle URL topicId query parameter
  React.useEffect(() => {
    if (urlTopicId) {
      setTargetTopicId(urlTopicId);
      setRecordDialogOpen(true);
    }
  }, [urlTopicId]);

  // Load data for active workspace
  React.useEffect(() => {
    if (!workspace) return;
    let isMounted = true;
    setLoadingData(true);
    setLoadError(null);

    Promise.all([
      repos.practice.getPracticeSessions(workspace.id),
      repos.progress.getAllProgressForWorkspace(workspace.id),
    ])
      .then(([fetchedSessions, fetchedProgress]) => {
        if (!isMounted) return;
        setSessions(fetchedSessions);
        setProgressList(fetchedProgress);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load practice data");
      })
      .finally(() => {
        if (isMounted) {
          setLoadingData(false);
          setHasInitialLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [workspace, repos, reloadKey]);

  const examAttemptId = workspace?.examAttemptId || "attempt_neet_2027";

  // Aggregated domain models
  const topicPerformances = React.useMemo(
    () => aggregateAllTopicsPerformance(examAttemptId, sessions, progressList),
    [examAttemptId, sessions, progressList]
  );

  const snapshot = React.useMemo(
    () => getOverallPracticeSnapshot(sessions, topicPerformances),
    [sessions, topicPerformances]
  );

  const subjects = React.useMemo(
    () => getSubjectPracticePerformance(examAttemptId, sessions, topicPerformances),
    [examAttemptId, sessions, topicPerformances]
  );

  const weakTopics = React.useMemo(
    () => getWeakTopics(examAttemptId, sessions, topicPerformances),
    [examAttemptId, sessions, topicPerformances]
  );

  const recentSessions = React.useMemo(
    () => sortRecentPracticeSessions(sessions),
    [sessions]
  );

  const subjectTaxonomy = React.useMemo(
    () => getSubjectTaxonomySummary(examAttemptId),
    [examAttemptId]
  );

  // Filtered weak topics when filters are active
  const filteredWeakTopics = React.useMemo(() => {
    if (subjectFilter === "all") return weakTopics;
    return weakTopics.filter(
      (w) =>
        w.subjectSlug.toLowerCase() === subjectFilter.toLowerCase() ||
        w.subjectId.toLowerCase() === subjectFilter.toLowerCase()
    );
  }, [weakTopics, subjectFilter]);

  // Filtered recent sessions when subject filter is active
  const filteredRecentSessions = React.useMemo(() => {
    if (subjectFilter === "all") return recentSessions;
    return recentSessions.filter((s) => {
      if (!s.topicId) return false;
      const perf = topicPerformances.get(s.topicId);
      return (
        perf &&
        (perf.subjectSlug.toLowerCase() === subjectFilter.toLowerCase() ||
          perf.subjectId.toLowerCase() === subjectFilter.toLowerCase())
      );
    });
  }, [recentSessions, subjectFilter, topicPerformances]);

  const handleOpenRecord = (topicId?: string) => {
    setTargetTopicId(topicId ?? null);
    setRecordDialogOpen(true);
  };

  const handleRecordSuccess = () => {
    setReloadKey((k) => k + 1);
  };

  if (workspaceLoading || (!hasInitialLoaded && loadingData)) {
    return (
      <PageContainer className="py-6 sm:py-8">
        <LoadingSkeleton count={4} />
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer className="py-6 sm:py-8">
        <ErrorState
          title="Could not load practice data"
          message={loadError || "An error occurred."}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-6 sm:py-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Target className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">Preparation Practice</span>
          </div>
          <h1 className="type-h1 mt-1">Practice &amp; Performance</h1>
          <p className="mt-1 type-body text-muted-foreground">
            Log questions attempted, track accuracy by topic, and identify focus areas.
          </p>
        </div>

        <Button
          onClick={() => handleOpenRecord()}
          className="min-h-[44px] gap-2 font-semibold shadow-sm self-start sm:self-center"
        >
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          Record Practice
        </Button>
      </div>

      <div className="space-y-6">
        {/* Performance Snapshot */}
        <PerformanceSnapshot snapshot={snapshot} />

        {/* Filters */}
        <PracticeFilters
          subjects={subjectTaxonomy}
          selectedSubject={subjectFilter}
          onSelectSubject={setSubjectFilter}
          selectedPerformance={performanceFilter}
          onSelectPerformance={setPerformanceFilter}
        />

        {/* Subject Performance Cards (shown when not filtered to weak-only) */}
        {performanceFilter !== "weak" && (
          <SubjectPerformance
            subjects={
              subjectFilter === "all"
                ? subjects
                : subjects.filter((s) => s.subjectSlug.toLowerCase() === subjectFilter.toLowerCase())
            }
          />
        )}

        {/* Weak Topics / Practice Needed */}
        {performanceFilter !== "practiced" && (
          <WeakTopicsList
            weakTopics={filteredWeakTopics}
            onPracticeTopic={(topicId) => handleOpenRecord(topicId)}
          />
        )}

        {/* Recent Practice Sessions */}
        {performanceFilter !== "weak" && (
          <RecentPracticeList
            sessions={filteredRecentSessions}
            examAttemptId={examAttemptId}
          />
        )}
      </div>

      {/* Record Practice Dialog */}
      {workspace && (
        <RecordPracticeDialog
          open={recordDialogOpen}
          onOpenChange={(open) => {
            setRecordDialogOpen(open);
            if (!open && urlTopicId) {
              // Clear topicId query param from URL without refreshing
              router.replace("/app/practice", { scroll: false });
            }
          }}
          initialTopicId={targetTopicId}
          examAttemptId={examAttemptId}
          workspaceId={workspace.id}
          onSuccess={handleRecordSuccess}
        />
      )}
    </PageContainer>
  );
}
