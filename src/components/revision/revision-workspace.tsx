"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck2, CalendarClock, History, RotateCcw } from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RevisionItemCard } from "./revision-item-card";
import { useRepositories } from "@/repositories/repository-provider";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { getExamAttempt } from "@/domain/exam-catalog";
import { getSubjectTaxonomySummary } from "@/domain/dashboard";
import {
  RECENTLY_REVISED_DISPLAY_LIMIT,
  UPCOMING_DISPLAY_LIMIT,
  diffLocalDays,
  filterRevisionQueue,
  getRevisionQueue,
  type RecentlyRevisedEntry,
  type RevisionStatusFilter,
  type RevisionSubjectFilter,
} from "@/domain/revision";
import type { RevisionItem, UserTopicProgress } from "@/db/schema";
import { cn } from "@/lib/utils/cn";

interface RevisionData {
  progressList: UserTopicProgress[];
  revisionItems: RevisionItem[];
  referenceDate: Date;
}

function formatDayLabel(d: Date, referenceDate: Date): string {
  const diff = diffLocalDays(referenceDate, d);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const STATUS_FILTERS: { value: RevisionStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Upcoming" },
];

export function RevisionWorkspace() {
  const router = useRouter();
  const repos = useRepositories();
  const { workspace, status } = useActiveWorkspace();

  const [data, setData] = React.useState<RevisionData | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [statusFilter, setStatusFilter] = React.useState<RevisionStatusFilter>("all");
  const [subjectFilter, setSubjectFilter] = React.useState<RevisionSubjectFilter>("all");
  const [showAllUpcoming, setShowAllUpcoming] = React.useState(false);

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
      repos.revision.getRevisionItems(workspace.id).catch(() => [] as RevisionItem[]),
    ])
      .then(([progressList, revisionItems]) => {
        if (!cancelled) setData({ progressList, revisionItems, referenceDate: new Date() });
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load your revision queue.");
      });
    return () => {
      cancelled = true;
    };
  }, [repos, workspace, status, reloadKey]);

  const queue = React.useMemo(
    () =>
      data && workspace
        ? getRevisionQueue({
            examAttemptId: workspace.examAttemptId,
            progressList: data.progressList,
            revisionItems: data.revisionItems,
            referenceDate: data.referenceDate,
          })
        : null,
    [data, workspace]
  );

  const filtered = React.useMemo(
    () => (queue ? filterRevisionQueue(queue, { status: statusFilter, subject: subjectFilter }) : null),
    [queue, statusFilter, subjectFilter]
  );

  const subjects = React.useMemo(
    () => (workspace ? getSubjectTaxonomySummary(workspace.examAttemptId) : []),
    [workspace]
  );

  // Reset "show more" whenever the filter context changes.
  React.useEffect(() => {
    setShowAllUpcoming(false);
  }, [statusFilter, subjectFilter]);

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
          title="Could not load your revision queue"
          message={loadError}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </PageContainer>
    );
  }

  if (!data || !queue || !filtered) {
    return (
      <PageContainer className="py-6 sm:py-8" size="wide">
        <LoadingSkeleton count={5} />
      </PageContainer>
    );
  }

  const referenceDate = data.referenceDate;
  const attemptLabel = getExamAttempt(workspace.examAttemptId)?.label ?? "Your exam";
  const { summary } = queue;
  const showDue = statusFilter === "all" || statusFilter === "due";
  const showOverdue = statusFilter === "all" || statusFilter === "overdue";
  const showUpcoming = statusFilter === "all" || statusFilter === "upcoming";
  const showRecent = statusFilter === "all";

  const upcomingEntries = showAllUpcoming
    ? filtered.upcoming
    : filtered.upcoming.slice(0, UPCOMING_DISPLAY_LIMIT);
  const upcomingGroups = groupByDay(upcomingEntries, referenceDate, (e) => e.nextRevisionAt);
  const recentEntries = filtered.recentlyRevised.slice(0, RECENTLY_REVISED_DISPLAY_LIMIT);
  const recentGroups = groupByDay(recentEntries, referenceDate, (e) => e.lastRevisedAt);
  const nothingDueAnywhere = summary.dueToday === 0 && summary.overdue === 0;
  const hasAnySchedule =
    summary.dueToday + summary.overdue + summary.upcoming + summary.recentlyRevised > 0;

  return (
    <PageContainer className="py-6 sm:py-8" size="wide">
      {/* Revision header */}
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="type-h1">Revision</h1>
          <p className="text-sm font-medium text-foreground-subtle">{attemptLabel}</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{summary.dueToday}</span>{" "}
          {summary.dueToday === 1 ? "topic" : "topics"} due
          <span aria-hidden="true" className="text-foreground-subtle"> · </span>
          <span className="tabular-nums">{summary.overdue}</span> overdue
          <span aria-hidden="true" className="text-foreground-subtle"> · </span>
          <span className="tabular-nums">{summary.upcoming}</span> upcoming
        </p>
      </header>

      {/* Compact counts — real data, no scores */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat
          label="Due Today"
          value={summary.dueToday}
          icon={<CalendarCheck2 className="h-4 w-4" aria-hidden="true" />}
          emphasized
        />
        <SummaryStat
          label="Overdue"
          value={summary.overdue}
          icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
          tone="warning"
        />
        <SummaryStat
          label="Upcoming"
          value={summary.upcoming}
          icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
        />
        <SummaryStat
          label="Recently Revised"
          value={summary.recentlyRevised}
          icon={<History className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      {/* Lightweight filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as RevisionStatusFilter)}>
          <div className="max-w-full overflow-x-auto">
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto sm:w-auto">
              {STATUS_FILTERS.map((f) => (
                <TabsTrigger
                  key={f.value}
                  value={f.value}
                  className="min-h-[44px] flex-1 px-4 sm:flex-none"
                >
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <div className="sm:w-52">
          <Select
            value={subjectFilter}
            onValueChange={(v) => setSubjectFilter(v as RevisionSubjectFilter)}
          >
            <SelectTrigger aria-label="Filter by subject" className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="min-h-[44px]">
                All Subjects
              </SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.slug} className="min-h-[44px]">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-7 space-y-8">
        {/* Due Today — the most important section, always first */}
        {showDue && (
          <section>
            <SectionHeader
              title="Due Today"
              description="Reviews scheduled for today or earlier"
            />
            {filtered.dueToday.length > 0 ? (
              <div className="space-y-2.5">
                {filtered.dueToday.map((entry) => (
                  <RevisionItemCard key={entry.topicId} entry={entry} prominent />
                ))}
              </div>
            ) : nothingDueAnywhere ? (
              <EmptyState
                icon={<CalendarCheck2 className="h-6 w-6" aria-hidden="true" />}
                title="You're all caught up."
                description={
                  hasAnySchedule
                    ? "No revisions are due today. Check Upcoming for what's next."
                    : "Topics you mark as learned in Study get a spaced review schedule automatically."
                }
                action={
                  !hasAnySchedule ? (
                    <Button asChild size="sm" className="min-h-[44px]">
                      <Link href="/app/study">Browse Syllabus</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <EmptyState
                icon={<CalendarCheck2 className="h-6 w-6" aria-hidden="true" />}
                title="You're all caught up."
                description="Nothing is due today."
              />
            )}
          </section>
        )}

        {/* Overdue — clearly distinguishable, calmly worded */}
        {showOverdue && (
          <section>
            <SectionHeader
              title="Overdue"
              description="Reviews past their date — pick any of these up when ready"
            />
            {filtered.overdue.length > 0 ? (
              <div className="space-y-2.5">
                {filtered.overdue.map((entry) => (
                  <RevisionItemCard key={entry.topicId} entry={entry} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-3.5 text-sm text-muted-foreground">
                Nothing overdue. Reviews you complete on time keep this list clear.
              </p>
            )}
          </section>
        )}

        {/* Upcoming — grouped by scheduled date */}
        {showUpcoming && (
          <section>
            <SectionHeader title="Upcoming" description="Scheduled reviews on the calendar" />
            {upcomingGroups.length > 0 ? (
              <div className="space-y-4">
                {upcomingGroups.map((group) => (
                  <div key={group.label}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
                      {group.label}
                    </h3>
                    <div className="mt-2 space-y-2.5">
                      {group.entries.map((entry) => (
                        <RevisionItemCard key={entry.topicId} entry={entry} />
                      ))}
                    </div>
                  </div>
                ))}
                {!showAllUpcoming && filtered.upcoming.length > UPCOMING_DISPLAY_LIMIT && (
                  <Button
                    variant="outline"
                    className="min-h-[44px] w-full sm:w-auto"
                    onClick={() => setShowAllUpcoming(true)}
                  >
                    Show all {filtered.upcoming.length} upcoming
                  </Button>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarClock className="h-6 w-6" aria-hidden="true" />}
                title="No upcoming revisions scheduled."
                description={
                  subjectFilter !== "all"
                    ? `No scheduled reviews in ${subjects.find((s) => s.slug === subjectFilter)?.name ?? "this subject"} yet.`
                    : "Mark topics as learned to plan their spaced reviews."
                }
              />
            )}
          </section>
        )}

        {/* Recently Revised — real history only */}
        {showRecent && (
          <section>
            <SectionHeader title="Recently Revised" description="Your last 7 days of reviews" />
            {recentGroups.length > 0 ? (
              <div className="space-y-4">
                {recentGroups.map((group) => (
                  <div key={group.label}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
                      {group.label}
                    </h3>
                    <div className="mt-2 space-y-2">
                      {group.entries.map((entry) => (
                        <RecentRevisionRow key={entry.topicId} entry={entry} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<History className="h-6 w-6" aria-hidden="true" />}
                title="No revision sessions recorded yet."
                description="Completed reviews will appear here."
              />
            )}
          </section>
        )}
      </div>
    </PageContainer>
  );
}

function SummaryStat({
  label,
  value,
  icon,
  tone,
  emphasized,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "warning";
  emphasized?: boolean;
}) {
  return (
    <Card
      variant="base"
      className={
        emphasized
          ? "border-primary/30 bg-surface-tint/40 p-3.5"
          : tone === "warning"
            ? "border-warning/25 p-3.5"
            : "p-3.5"
      }
    >
      <div className="flex items-center gap-1.5 text-foreground-subtle">
        <span aria-hidden="true" className={tone === "warning" ? "text-warning" : emphasized ? "text-primary" : undefined}>
          {icon}
        </span>
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p
        className={cn(
          "mt-1.5 text-2xl font-bold tabular-nums",
          tone === "warning" ? "text-warning" : emphasized ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
    </Card>
  );
}

function RecentRevisionRow({ entry }: { entry: RecentlyRevisedEntry }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3">
      <div className="min-w-0">
        <Link
          href={`/app/study/${encodeURIComponent(entry.topicId)}`}
          className="inline-flex items-center text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {entry.topicName}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {entry.subjectName} · {entry.chapterName}
          {entry.completedRevisions !== null && entry.completedRevisions > 0 && (
            <>
              {" · "}
              <span className="tabular-nums">
                {entry.completedRevisions} {entry.completedRevisions === 1 ? "revision" : "revisions"}
              </span>
            </>
          )}
        </p>
      </div>
      <span className="shrink-0 text-xs text-foreground-subtle" aria-hidden="true">
        <RotateCcw className="h-4 w-4" />
      </span>
    </div>
  );
}

function groupByDay<T>(
  entries: T[],
  referenceDate: Date,
  getDate: (entry: T) => Date
): { label: string; entries: T[] }[] {
  const groups: { label: string; entries: T[] }[] = [];
  for (const entry of entries) {
    const label = formatDayLabel(getDate(entry), referenceDate);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.entries.push(entry);
    } else {
      groups.push({ label, entries: [entry] });
    }
  }
  return groups;
}
