"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SectionHeader } from "@/components/shared/section-header";
import { NoDataPanel } from "./stat-tile";
import type { SubjectPerformanceAnalytics } from "@/domain/analytics";
import { formatAccuracy } from "@/domain/practice";
import { cn } from "@/lib/utils/cn";

/**
 * Section 2 — Subject performance. Raw practice metrics per subject in
 * canonical syllabus order; subjects are never labelled best/worst.
 */

export function SubjectPerformanceSection({
  subjects,
  periodLabel,
}: {
  subjects: SubjectPerformanceAnalytics[];
  periodLabel: string;
}) {
  const withData = subjects.filter((s) => s.hasData);

  return (
    <section aria-labelledby="subject-performance-heading">
      <SectionHeader
        title="Subject Performance"
        description={`Practice results by subject · ${periodLabel}`}
      />
      <span id="subject-performance-heading" className="sr-only">
        Subject performance
      </span>

      {withData.length === 0 ? (
        <NoDataPanel message={`No practice questions recorded in the last ${periodLabel.toLowerCase()}.`} />
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => (
            <SubjectCard key={subject.subjectId} subject={subject} periodLabel={periodLabel} />
          ))}
        </div>
      )}
    </section>
  );
}

function SubjectCard({
  subject,
  periodLabel,
}: {
  subject: SubjectPerformanceAnalytics;
  periodLabel: string;
}) {
  if (!subject.hasData) {
    return (
      <Card className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{subject.subjectName}</h3>
          <span className="text-xs text-foreground-subtle">No practice in this period</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="tabular-nums">{subject.topicsCovered}</span> /{" "}
          <span className="tabular-nums">{subject.totalTopics}</span> topics covered (all-time)
        </p>
      </Card>
    );
  }

  const accuracyPct = subject.accuracyBps / 100;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{subject.subjectName}</h3>
        <span className="text-sm font-bold tabular-nums text-foreground">
          {formatAccuracy(subject.accuracyBps)}
          <span className="ml-1 text-xs font-medium text-foreground-subtle">accuracy</span>
        </span>
      </div>

      <Progress
        value={Math.round(accuracyPct)}
        className="h-1.5 bg-surface-tint"
        aria-label={`${subject.subjectName} accuracy ${formatAccuracy(subject.accuracyBps)}`}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SubjectStat label="Attempted" value={subject.questionsAttempted} />
        <SubjectStat label="Correct" value={subject.correct} />
        <SubjectStat label="Incorrect" value={subject.incorrect} />
        <SubjectStat
          label="Weak topics"
          value={subject.weakTopics}
          tone={subject.weakTopics > 0 ? "warning" : undefined}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="tabular-nums">{subject.topicsCovered}</span> /{" "}
        <span className="tabular-nums">{subject.totalTopics}</span> topics covered (all-time) ·{" "}
        <span className="tabular-nums">{subject.sessionCount}</span>{" "}
        {subject.sessionCount === 1 ? "session" : "sessions"} · {periodLabel}
      </p>
    </Card>
  );
}

function SubjectStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning";
}) {
  return (
    <div
      className={
        tone === "warning"
          ? "rounded-lg border border-warning/25 bg-warning/5 p-2 text-center"
          : "rounded-lg bg-surface-tint/50 p-2 text-center"
      }
    >
      <p
        className={cn(
          "text-sm font-bold tabular-nums",
          tone === "warning" ? "text-warning" : "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="text-[10px] font-medium text-foreground-subtle">{label}</p>
    </div>
  );
}
