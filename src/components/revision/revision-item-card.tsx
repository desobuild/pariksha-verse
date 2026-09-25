"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RevisionQueueEntry } from "@/domain/revision";
import { cn } from "@/lib/utils/cn";

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Status badge for a queue entry. Text always carries the meaning
 * ("Overdue by N days", "Due today", date) so color is never the only cue.
 */
export function RevisionDueBadge({
  entry,
  className,
}: {
  entry: RevisionQueueEntry;
  className?: string;
}) {
  if (entry.bucket === "overdue") {
    const days = entry.overdueDays;
    return (
      <Badge variant="warning" className={className}>
        {days === 1 ? "1 day overdue" : `${days} days overdue`}
      </Badge>
    );
  }
  if (entry.bucket === "due") {
    return (
      <Badge variant="primary" className={className}>
        Due today
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" className={className}>
      {entry.dueInDays === 1
        ? "Tomorrow"
        : formatShortDate(new Date(entry.nextRevisionAt.getTime()))}
  </Badge>
  );
}

export interface RevisionItemCardProps {
  entry: RevisionQueueEntry;
  /** Emphasised treatment for the Due Today bucket. */
  prominent?: boolean;
}

export function RevisionItemCard({ entry, prominent }: RevisionItemCardProps) {
  const lastLabel = entry.lastRevisedAt
    ? `Last revised ${formatShortDate(entry.lastRevisedAt)}`
    : entry.lastStudiedAt
      ? `Last studied ${formatShortDate(entry.lastStudiedAt)}`
      : null;

  return (
    <Card
      variant="base"
      className={cn(
        "p-4",
        prominent && "border-primary/30 bg-gradient-to-b from-surface to-surface-tint/25"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/app/study/${encodeURIComponent(entry.topicId)}`}
            className="inline-flex min-h-[24px] items-center text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {entry.topicName}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.subjectName} · {entry.chapterName}
          </p>
        </div>
        <RevisionDueBadge entry={entry} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-foreground-subtle">
          {lastLabel ?? "Scheduled from your study progress"}
          {entry.revisionNumber > 1 && (
            <>
              {" · "}
              <span className="tabular-nums">Revision #{entry.revisionNumber}</span>
            </>
          )}
          {entry.practiceAttempts !== undefined && entry.practiceAttempts > 0 && (
            <>
              {" · "}
              <span>Last practice: {Math.round((entry.practiceAccuracy ?? 0) / 100)}% accuracy</span>
            </>
          )}
        </p>
        <Button asChild size="sm" className="min-h-[44px] gap-1.5 font-semibold">
          <Link href={`/app/study/${encodeURIComponent(entry.topicId)}`}>
            Review Topic
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
