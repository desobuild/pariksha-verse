"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, Loader2, Target } from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusControl, TopicStatusBadge } from "@/components/study/topic-status";
import { StudySessionPanel } from "@/components/study/study-session-panel";
import { useRepositories } from "@/repositories/repository-provider";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { getTopicMetadata } from "@/domain/dashboard";
import {
  applyStudySessionToProgress,
  applyTopicStatusChange,
  type TopicStatus,
} from "@/domain/study";
import {
  applyRevisionCompletion,
  diffLocalDays,
  isRevisionDue,
  isRevisionEligible,
  isRevisionOverdue,
  toDate,
} from "@/domain/revision";
import type {
  PracticeSession,
  RevisionItem,
  StudySession,
  UserTopicProgress,
} from "@/db/schema";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatAccuracy(basisPoints: number): string {
  return `${Math.round(basisPoints / 100)}%`;
}

export interface TopicDetailViewProps {
  topicId: string;
}

interface TopicDetailData {
  progressList: UserTopicProgress[];
  sessions: StudySession[];
  revisionItems: RevisionItem[];
  practiceSessions: PracticeSession[];
}

export function TopicDetailView({ topicId }: TopicDetailViewProps) {
  const router = useRouter();
  const repos = useRepositories();
  const { workspace, status } = useActiveWorkspace();

  const [data, setData] = React.useState<TopicDetailData | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [savingStatus, setSavingStatus] = React.useState(false);
  const [markingRevision, setMarkingRevision] = React.useState(false);
  const [revisionFeedback, setRevisionFeedback] = React.useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

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
      repos.studySession.getSessionsForWorkspace(workspace.id),
      repos.revision.getRevisionItems(workspace.id).catch(() => [] as RevisionItem[]),
      repos.practice.getPracticeSessions(workspace.id).catch(() => [] as PracticeSession[]),
    ])
      .then(([progressList, sessions, revisionItems, practiceSessions]) => {
        if (cancelled) return;
        setData({ progressList, sessions, revisionItems, practiceSessions });
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load this topic's data.");
      });
    return () => {
      cancelled = true;
    };
  }, [repos, workspace, status, reloadKey]);

  const metadata = React.useMemo(
    () => (workspace ? getTopicMetadata(topicId, workspace.examAttemptId) : null),
    [workspace, topicId]
  );

  const progress = React.useMemo(
    () => data?.progressList.find((p) => p.topicId === topicId) ?? null,
    [data, topicId]
  );

  const topicSessions = React.useMemo(
    () =>
      (data?.sessions ?? [])
        .filter((s) => s.topicId === topicId)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [data, topicId]
  );

  const revisionItem = React.useMemo(
    () => data?.revisionItems.find((r) => r.topicId === topicId) ?? null,
    [data, topicId]
  );

  const practiceAttemptsTotal = progress?.practiceAttempts ?? 0;
  const topicPracticeSessions = React.useMemo(
    () => (data?.practiceSessions ?? []).filter((p) => p.topicId === topicId),
    [data, topicId]
  );
  const lastPracticedAt = React.useMemo(() => {
    const fromProgress = progress?.practicedAt ? new Date(progress.practicedAt) : null;
    const fromSessions = topicPracticeSessions
      .map((p) => new Date(p.completedAt))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (fromProgress && fromSessions) {
      return fromProgress.getTime() >= fromSessions.getTime() ? fromProgress : fromSessions;
    }
    return fromProgress ?? fromSessions ?? null;
  }, [progress, topicPracticeSessions]);

  if (status === "loading" || !workspace) {
    return (
      <PageContainer className="py-6 sm:py-8" size="default">
        <LoadingSkeleton count={4} />
      </PageContainer>
    );
  }

  if (!metadata) {
    return (
      <PageContainer className="py-6 sm:py-8" size="default">
        <EmptyState
          title="Topic not found"
          description="This topic is not part of your exam syllabus."
          action={
            <Button asChild size="sm">
              <Link href="/app/study">Back to Study</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer className="py-6 sm:py-8" size="default">
        <ErrorState
          title="Could not load topic"
          message={loadError}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer className="py-6 sm:py-8" size="default">
        <LoadingSkeleton count={4} />
      </PageContainer>
    );
  }

  const handleStatusChange = async (next: TopicStatus) => {
    if (!workspace) return;
    setSavingStatus(true);
    setRevisionFeedback(null);
    try {
      const saved = await repos.progress.upsertProgress(
        applyTopicStatusChange({
          workspaceId: workspace.id,
          topicId: metadata.topicId,
          status: next,
          existing: progress,
        })
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              progressList: [
                ...prev.progressList.filter((p) => p.topicId !== saved.topicId),
                saved,
              ],
            }
          : prev
      );
    } finally {
      setSavingStatus(false);
    }
  };

  const handleMarkRevised = async () => {
    if (!workspace || markingRevision) return;
    setMarkingRevision(true);
    setRevisionFeedback(null);
    const completion = applyRevisionCompletion({
      workspaceId: workspace.id,
      topicId: metadata.topicId,
      existingProgress: progress,
      existingRevisionItem: revisionItem,
    });
    try {
      // Revision item first (authoritative revisionNumber), then progress
      // timestamps/schedule; the queue reads either, so a partial write
      // still leaves a consistent schedule behind.
      const savedItem = await repos.revision.upsertRevisionItem(completion.revisionItem);
      const savedProgress = await repos.progress.upsertProgress(completion.progress);
      setData((prev) =>
        prev
          ? {
              ...prev,
              revisionItems: [
                ...prev.revisionItems.filter((r) => r.topicId !== savedItem.topicId),
                savedItem,
              ],
              progressList: [
                ...prev.progressList.filter((p) => p.topicId !== savedProgress.topicId),
                savedProgress,
              ],
            }
          : prev
      );
      setRevisionFeedback({
        kind: "success",
        message: `Revision completed. Next review in ${completion.nextIntervalDays} ${
          completion.nextIntervalDays === 1 ? "day" : "days"
        }.`,
      });
    } catch {
      // Nothing was persisted on failure paths that throw; state stays intact.
      setRevisionFeedback({ kind: "error", message: "Couldn't update revision. Try again." });
    } finally {
      setMarkingRevision(false);
    }
  };

  const handleCreateSession = async (input: {
    startedAt: Date;
    endedAt: Date;
    durationMinutes: number;
    sessionType: string;
  }) => {
    if (!workspace) throw new Error("No workspace");
    const created = await repos.studySession.createSession({
      workspaceId: workspace.id,
      topicId: metadata.topicId,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMinutes: input.durationMinutes,
      sessionType: input.sessionType,
    });
    return created;
  };

  const handleSessionCreated = (session: StudySession) => {
    setData((prev) => (prev ? { ...prev, sessions: [...prev.sessions, session] } : prev));
    // Refresh lastStudiedAt without touching the preparation status.
    if (workspace) {
      void repos.progress
        .upsertProgress(
          applyStudySessionToProgress({
            workspaceId: workspace.id,
            topicId: metadata.topicId,
            existing: progress,
          })
        )
        .then((saved) => {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  progressList: [
                    ...prev.progressList.filter((p) => p.topicId !== saved.topicId),
                    saved,
                  ],
                }
              : prev
          );
        })
        .catch(() => undefined);
    }
  };

  const nextRevisionAt = toDate(revisionItem?.nextRevisionAt ?? progress?.nextRevisionAt ?? null);
  const lastRevisedAt = toDate(revisionItem?.lastRevisedAt ?? progress?.lastRevisedAt ?? null);
  const revisionEligible = isRevisionEligible(
    progress?.status ?? "not_started",
    nextRevisionAt,
    revisionItem ?? null
  );
  const revisionDue = revisionEligible && nextRevisionAt !== null && isRevisionDue(nextRevisionAt);
  const revisionOverdue = revisionEligible && nextRevisionAt !== null && isRevisionOverdue(nextRevisionAt);

  return (
    <PageContainer className="py-6 sm:py-8" size="default">
      {/* Back + breadcrumb */}
      <Link
        href={`/app/study?subject=${metadata.subjectSlug}`}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to {metadata.subjectName}
      </Link>

      <header className="mt-3">
        <p className="text-xs font-medium text-foreground-subtle">
          {metadata.subjectName} · {metadata.chapterName}
        </p>
        <h1 className="type-h1 mt-1">{metadata.topicName}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <TopicStatusBadge status={progress?.status ?? "not_started"} />
          <StatusControl
            value={progress?.status ?? "not_started"}
            onChange={(s) => void handleStatusChange(s)}
            disabled={savingStatus}
          />
        </div>
      </header>

      <div className="mt-6 space-y-5">
        <StudySessionPanel
          sessions={topicSessions}
          onCreateSession={handleCreateSession}
          onSessionCreated={handleSessionCreated}
        />

        {/* Preparation timeline — only real, recorded milestones */}
        <Card variant="base" className="p-5">
          <h2 className="type-h4">Study Progress</h2>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
            <TimelineRow label="Status" value={progress?.status ? undefined : "Not started yet"} status={progress?.status} />
            <TimelineRow label="Started" value={formatDate(progress?.startedAt)} />
            <TimelineRow label="Learned" value={formatDate(progress?.learnedAt)} />
            <TimelineRow label="Practiced" value={formatDate(progress?.practicedAt)} />
            <TimelineRow label="Revised" value={formatDate(progress?.revisedAt)} />
            <TimelineRow label="Mastered" value={formatDate(progress?.masteredAt)} />
            <TimelineRow label="Last studied" value={formatDate(progress?.lastStudiedAt)} />
          </dl>
        </Card>

        {/* Revision — spaced review state with the Phase 8 completion action */}
        <Card variant="base" className="p-5">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="type-h4">Revision</h2>
          </div>
          {nextRevisionAt ? (
            <div className="mt-3">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                <TimelineRow label="Next revision" value={formatDate(nextRevisionAt)} />
                <TimelineRow
                  label="Last revised"
                  value={lastRevisedAt ? formatRelativeDay(lastRevisedAt) : "—"}
                />
              </dl>
              <div className="mt-3.5 flex flex-wrap items-center gap-3">
                {revisionDue ? (
                  <>
                    <Badge variant={revisionOverdue ? "warning" : "primary"}>
                      <span className="sr-only">Revision: </span>
                      {revisionOverdue ? overdueLabel(revisionOverdueDays(nextRevisionAt)) : "Due today"}
                    </Badge>
                    <Button
                      onClick={() => void handleMarkRevised()}
                      disabled={markingRevision}
                      className="min-h-[44px] gap-2 font-semibold"
                    >
                      {markingRevision && (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      )}
                      Mark as Revised
                    </Button>
                  </>
                ) : (
                  <Badge variant="neutral">
                    <span className="sr-only">Revision: </span>
                    {upcomingLabel(nextRevisionAt)}
                  </Badge>
                )}
              </div>
              {revisionFeedback && (
                <p
                  role="status"
                  className={
                    revisionFeedback.kind === "success"
                      ? "mt-3 flex items-center gap-1.5 text-sm font-medium text-success"
                      : "mt-3 text-sm font-medium text-destructive"
                  }
                >
                  {revisionFeedback.kind === "success" && (
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {revisionFeedback.message}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No revision scheduled yet.</p>
          )}
        </Card>

        {/* Practice info — compact summary of existing data */}
        <Card variant="base" className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="type-h4">Practice Performance</h2>
            </div>
            <Button asChild size="sm" variant="outline" className="min-h-[44px] font-semibold">
              <Link href={`/app/practice?topicId=${encodeURIComponent(metadata.topicId)}`}>
                Record Practice
              </Link>
            </Button>
          </div>
          {practiceAttemptsTotal > 0 || topicPracticeSessions.length > 0 ? (
            <dl className="mt-3.5 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-3">
              <TimelineRow label="Questions" value={String(practiceAttemptsTotal)} />
              <TimelineRow
                label="Accuracy"
                value={practiceAttemptsTotal > 0 ? formatAccuracy(progress?.accuracy ?? 0) : "—"}
              />
              <TimelineRow
                label="Last practiced"
                value={lastPracticedAt ? formatRelativeDay(lastPracticedAt) : "—"}
              />
            </dl>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">No practice attempts yet.</p>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}

function TimelineRow({
  label,
  value,
  status,
}: {
  label: string;
  value?: string;
  status?: TopicStatus;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2.5 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">
        {status !== undefined ? <TopicStatusBadge status={status} /> : (value ?? "—")}
      </dd>
    </div>
  );
}

/** Calendar days a schedule is in the past (never below 1 when shown). */
function revisionOverdueDays(nextRevisionAt: Date): number {
  const now = new Date();
  return Math.max(1, diffLocalDays(nextRevisionAt, now));
}

function overdueLabel(days: number): string {
  return days === 1 ? "Overdue by 1 day" : `Overdue by ${days} days`;
}

function upcomingLabel(nextRevisionAt: Date): string {
  const days = Math.max(0, diffLocalDays(new Date(), nextRevisionAt));
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function formatRelativeDay(d: Date): string {
  const diff = diffLocalDays(d, new Date());
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
