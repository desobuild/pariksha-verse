"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Search, X } from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRepositories } from "@/repositories/repository-provider";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { getExamAttempt } from "@/domain/exam-catalog";
import {
  TOPIC_STATUS_OPTIONS,
  buildProgressIndex,
  getChapterProgress,
  getNextStudyTarget,
  getStudyOverview,
  getSubjectProgress,
  getSyllabusTree,
  getTopicStatusCounts,
  hasActiveStudyFilters,
  searchAndFilterSubject,
  type FilteredChapter,
  type StudySectionProgress,
  type TopicStatusFilter,
} from "@/domain/study";
import { ChapterList } from "@/components/study/chapter-list";
import type { UserTopicProgress } from "@/db/schema";
import { cn } from "@/lib/utils/cn";

const ALL_FILTER = "all" as const;

export function StudyWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repos = useRepositories();
  const { workspace, status } = useActiveWorkspace();

  const [progressList, setProgressList] = React.useState<UserTopicProgress[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<TopicStatusFilter>(ALL_FILTER);
  const [expandedIds, setExpandedIds] = React.useState<ReadonlySet<string>>(new Set());

  // New users enter onboarding; returning users land in their space.
  React.useEffect(() => {
    if (status === "ready" && !workspace) {
      router.replace("/exam/select");
    }
  }, [status, workspace, router]);

  React.useEffect(() => {
    if (status !== "ready" || !workspace) return;
    let cancelled = false;
    setLoadError(null);
    repos.progress
      .getAllProgressForWorkspace(workspace.id)
      .then((list) => {
        if (!cancelled) setProgressList(list);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load your study progress.");
      });
    return () => {
      cancelled = true;
    };
  }, [repos, workspace, status, reloadKey]);

  const subjects = React.useMemo(
    () => getSyllabusTree(workspace?.examAttemptId ?? "attempt_neet_2027"),
    [workspace?.examAttemptId]
  );

  const activeSlugParam = searchParams.get("subject");
  const activeSubject = React.useMemo(
    () => subjects.find((s) => s.slug === activeSlugParam) ?? subjects[0],
    [subjects, activeSlugParam]
  );

  // Fresh view whenever the subject context changes (tab click, back button).
  React.useEffect(() => {
    setQuery("");
    setStatusFilter(ALL_FILTER);
    setExpandedIds(new Set());
  }, [activeSubject?.slug]);

  const progressIndex = React.useMemo(
    () => buildProgressIndex(progressList ?? []),
    [progressList]
  );

  const overview = React.useMemo(
    () => getStudyOverview(subjects, progressIndex),
    [subjects, progressIndex]
  );

  const subjectProgressList = React.useMemo(
    () => subjects.map((subject) => ({ subject, stats: getSubjectProgress(subject, progressIndex) })),
    [subjects, progressIndex]
  );

  const activeStats = React.useMemo(
    () => (activeSubject ? getSubjectProgress(activeSubject, progressIndex) : null),
    [activeSubject, progressIndex]
  );

  const statusCounts = React.useMemo(
    () =>
      activeSubject
        ? getTopicStatusCounts(
            activeSubject.chapters.flatMap((c) => c.topics.map((t) => t.topicId)),
            progressIndex
          )
        : null,
    [activeSubject, progressIndex]
  );

  const statsByChapter = React.useMemo(() => {
    const map = new Map<string, StudySectionProgress>();
    if (!activeSubject) return map;
    for (const chapter of activeSubject.chapters) {
      map.set(chapter.chapterId, getChapterProgress(chapter, progressIndex));
    }
    return map;
  }, [activeSubject, progressIndex]);

  const visibleChapters = React.useMemo<FilteredChapter[]>(
    () =>
      activeSubject
        ? searchAndFilterSubject(activeSubject, query, statusFilter, progressIndex)
        : [],
    [activeSubject, query, statusFilter, progressIndex]
  );

  const nextTarget = React.useMemo(
    () => (activeSubject ? getNextStudyTarget(activeSubject.chapters, progressIndex) : null),
    [activeSubject, progressIndex]
  );

  const filtersActive = hasActiveStudyFilters(query, statusFilter);

  // During search/filtering chapters render expanded so matches are visible.
  const effectiveExpanded = React.useMemo(
    () =>
      filtersActive ? new Set(visibleChapters.map((c) => c.chapterId)) : expandedIds,
    [filtersActive, visibleChapters, expandedIds]
  );

  const handleSubjectChange = React.useCallback(
    (slug: string) => {
      router.replace(`/app/study?subject=${slug}`, { scroll: false });
    },
    [router]
  );

  const handleToggleChapter = React.useCallback((chapterId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }, []);

  if (status === "loading" || !workspace || !activeSubject || !activeStats || !statusCounts) {
    return (
      <PageContainer className="py-6 sm:py-8" size="wide">
        <StudyHeadingSkeleton />
        <LoadingSkeleton count={5} className="mt-8" />
      </PageContainer>
    );
  }

  const attemptLabel = getExamAttempt(workspace.examAttemptId)?.label ?? "Your exam";
  const hasNoProgress = overview.completedTopics === 0 && overview.learningTopics === 0;
  const loadingProgress = progressList === null && loadError === null;

  return (
    <PageContainer className="py-6 sm:py-8" size="wide">
      {/* Study header: active workspace context + concise progress summary */}
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="type-h1">Study</h1>
          <p className="text-sm font-medium text-foreground-subtle">{attemptLabel}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
          <span className="tabular-nums">
            <span className="font-semibold text-foreground">{overview.totalTopics}</span> topics
          </span>
          <span aria-hidden="true" className="text-foreground-subtle">·</span>
          <span className="tabular-nums">{overview.completedTopics} completed</span>
          <span aria-hidden="true" className="text-foreground-subtle">·</span>
          <span className="tabular-nums">{overview.learningTopics} learning</span>
          <span aria-hidden="true" className="text-foreground-subtle">·</span>
          <span className="tabular-nums">{overview.remainingTopics} remaining</span>
        </div>
        <Progress
          value={overview.percentage}
          className="mt-3 h-1.5 max-w-md"
          aria-label={`Syllabus progress: ${overview.percentage}% covered`}
        />
        {hasNoProgress && (
          <p className="mt-2.5 text-xs text-foreground-subtle">
            Start studying a topic to begin tracking your progress.
          </p>
        )}
      </header>

      {/* Subject navigation */}
      <Tabs
        value={activeSubject.slug}
        onValueChange={handleSubjectChange}
        className="mt-6"
      >
        <div className="max-w-full overflow-x-auto">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto sm:w-auto sm:justify-center">
            {subjectProgressList.map(({ subject, stats }) => (
              <TabsTrigger
                key={subject.slug}
                value={subject.slug}
                className="min-h-[44px] flex-1 gap-2 px-4 sm:flex-none"
              >
                <span>{subject.name}</span>
                <span className="text-xs tabular-nums text-foreground-subtle">
                  {stats.percentage}%
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={activeSubject.slug} className="mt-5">
          {/* Search + status filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${activeSubject.name} chapters and topics…`}
                aria-label={`Search ${activeSubject.name} syllabus`}
                className="pl-9 pr-10"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-foreground-subtle transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div
              role="group"
              aria-label="Filter topics by status"
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            >
              <FilterChip
                label="All"
                count={statusCounts.total}
                active={statusFilter === ALL_FILTER}
                onClick={() => setStatusFilter(ALL_FILTER)}
              />
              {TOPIC_STATUS_OPTIONS.map((option) => {
                const count =
                  option.value === "not_started"
                    ? statusCounts.notStarted
                    : statusCounts[option.value];
                return (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    count={count}
                    active={statusFilter === option.value}
                    onClick={() => setStatusFilter(option.value)}
                  />
                );
              })}
            </div>
          </div>

          {/* Main + aside layout on desktop */}
          <div className="mt-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
            <div className="lg:col-span-8 xl:col-span-8">
              {loadError ? (
                <ErrorState
                  title="Could not load Study"
                  message={loadError}
                  onRetry={() => setReloadKey((k) => k + 1)}
                />
              ) : loadingProgress ? (
                <div className="space-y-3" aria-label="Loading syllabus">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
                  <LoadingSkeleton count={4} />
                </div>
              ) : visibleChapters.length === 0 ? (
                <EmptyState
                  title="No topics match your search."
                  description="Try a different search term or clear the status filter."
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setStatusFilter(ALL_FILTER);
                      }}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Clear search and filters
                    </button>
                  }
                />
              ) : (
                <>
                  {!filtersActive && nextTarget && (
                    <Link
                      href={`/app/study/${encodeURIComponent(nextTarget.topic.topicId)}`}
                      className="group mb-4 block focus-visible:outline-none"
                    >
                      <Card
                        variant="muted"
                        className="flex min-h-[44px] items-center gap-3 p-4 transition-colors group-hover:border-primary/30"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground-subtle">
                            {nextTarget.reason === "not_started" ? "Suggested next" : "Continue learning"}
                          </p>
                          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                            {nextTarget.topic.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-foreground-subtle">
                            {nextTarget.chapterName}
                          </p>
                        </div>
                        <ArrowRight
                          className="h-4 w-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                      </Card>
                    </Link>
                  )}

                  <SectionHeader
                    title="Chapters"
                    description={`${activeSubject.name} · ${activeStats.total} topics across ${activeSubject.chapters.length} chapters`}
                  />
                  <ChapterList
                    chapters={visibleChapters}
                    progressIndex={progressIndex}
                    statsByChapter={statsByChapter}
                    expandedIds={effectiveExpanded}
                    onToggleChapter={handleToggleChapter}
                  />
                </>
              )}
            </div>

            {/* Desktop aside: subject-level overview */}
            <aside className="mt-8 hidden lg:col-span-4 lg:mt-0 xl:col-span-4 lg:block">
              <div className="lg:sticky lg:top-20 space-y-4">
                <Card variant="base" className="p-5">
                  <h2 className="type-h4">Subjects</h2>
                  <p className="mt-0.5 text-xs text-foreground-subtle">
                    Coverage across your syllabus
                  </p>
                  <ul className="mt-4 space-y-4">
                    {subjectProgressList.map(({ subject, stats }) => (
                      <li key={subject.subjectId}>
                        <button
                          type="button"
                          onClick={() => handleSubjectChange(subject.slug)}
                          aria-current={subject.slug === activeSubject.slug ? "true" : undefined}
                          className={cn(
                            "w-full rounded-xl p-2 -m-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            subject.slug === activeSubject.slug ? "bg-surface-tint/60" : "hover:bg-muted/60"
                          )}
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{subject.name}</span>
                            <span className="text-xs tabular-nums text-foreground-subtle">
                              {stats.covered} / {stats.total}
                            </span>
                          </span>
                          <Progress
                            value={stats.percentage}
                            className="mt-2 h-1.5"
                            aria-label={`${subject.name}: ${stats.covered} of ${stats.total} topics covered (${stats.percentage}%)`}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card variant="base" className="p-5">
                  <h2 className="type-h4">{activeSubject.name}</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Covered</dt>
                      <dd className="font-semibold tabular-nums">{activeStats.covered} topics</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Learning</dt>
                      <dd className="font-semibold tabular-nums">{activeStats.learning} topics</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Not started</dt>
                      <dd className="font-semibold tabular-nums">{activeStats.notStarted} topics</dd>
                    </div>
                  </dl>
                </Card>
              </div>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "border-primary bg-surface-tint text-primary"
          : "border-border bg-surface text-foreground-subtle hover:border-primary/30 hover:text-foreground"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
          active ? "bg-primary/10 text-primary" : "bg-muted text-foreground-subtle"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StudyHeadingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-72 animate-pulse rounded-lg bg-muted" />
      <div className="h-1.5 w-64 max-w-full animate-pulse rounded-full bg-muted" />
    </div>
  );
}
