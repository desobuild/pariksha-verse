"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SectionHeader } from "@/components/shared/section-header";
import { LabeledBar } from "./charts";
import type { CoverageAnalytics, SubjectCoverageAnalytics } from "@/domain/analytics";

/**
 * Section 1 — Preparation coverage. Cumulative syllabus coverage from the
 * existing topic-status model, breakdown by subject (expandable to
 * chapter). Values come straight from the coverage analytics.
 */

export function CoverageSection({ coverage }: { coverage: CoverageAnalytics }) {
  const counts = coverage.counts;
  return (
    <section aria-labelledby="coverage-heading">
      <SectionHeader
        title="Preparation Coverage"
        description="Syllabus coverage from your topic statuses — all-time"
      />
      <Card className="space-y-5 p-4 sm:p-5">
        <span id="coverage-heading" className="sr-only">
          Preparation coverage
        </span>

        {/* Overall */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">Overall</span>
            <span className="text-xs font-medium text-foreground-subtle">
              <span className="font-bold text-foreground tabular-nums">{counts.covered}</span> /{" "}
              <span className="tabular-nums">{counts.total}</span> topics covered (
              <span className="tabular-nums">{coverage.coveragePct}</span>%)
            </span>
          </div>
          <Progress value={coverage.coveragePct} aria-label={`Overall coverage ${coverage.coveragePct} percent`} />
        </div>

        {/* Per-subject with expandable chapter breakdown */}
        <div className="space-y-3 border-t border-border-subtle pt-4">
          {coverage.subjects.map((subject) => (
            <SubjectCoverageRow key={subject.subjectId} subject={subject} />
          ))}
        </div>

        {/* Full status breakdown — all six canonical statuses */}
        <div className="border-t border-border-subtle pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Topics by status
          </h3>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            <StatusStat label="Mastered" value={counts.mastered} />
            <StatusStat label="Revised" value={counts.revised} />
            <StatusStat label="Practiced" value={counts.practiced} />
            <StatusStat label="Learned" value={counts.learned} />
            <StatusStat label="Learning" value={counts.learning} />
            <StatusStat label="Not started" value={counts.notStarted} />
          </dl>
        </div>
      </Card>
    </section>
  );
}

function SubjectCoverageRow({ subject }: { subject: SubjectCoverageAnalytics }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{subject.subjectName}</span>
        <span className="text-foreground-subtle">
          <span className="font-semibold text-foreground tabular-nums">{subject.covered}</span> /{" "}
          <span className="tabular-nums">{subject.total}</span>
        </span>
      </div>
      <Progress
        value={subject.percentage}
        className="h-1.5 bg-surface-tint"
        aria-label={`${subject.subjectName} coverage ${subject.percentage} percent`}
      />
      {subject.chapters.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-1 inline-flex items-center gap-1 rounded text-[11px] font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {open ? "Hide chapters" : `Chapters (${subject.chaptersCount})`}
            <span aria-hidden="true" className={open ? "rotate-180 transition-transform" : "transition-transform"}>
              ▾
            </span>
          </button>
          {open && (
            <div className="mt-2 space-y-2.5 rounded-xl bg-surface-tint/40 p-3">
              {subject.chapters.map((chapter) => (
                <LabeledBar
                  key={chapter.chapterId}
                  label={chapter.chapterName}
                  value={chapter.covered}
                  max={chapter.total}
                  trailing={`${chapter.covered} / ${chapter.total}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-lg bg-surface-tint/50 p-2">
      <dt className="order-2 text-[10px] font-medium text-foreground-subtle">{label}</dt>
      <dd className="order-1 text-sm font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
