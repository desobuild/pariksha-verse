"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared/section-header";
import { StatTile, NoDataPanel } from "./stat-tile";
import type { QuestionAnalytics } from "@/domain/analytics";
import { formatAccuracy } from "@/domain/practice";
import { formatRelativeDay } from "./format";

/**
 * Section 6 — Question performance. Reads Phase 10 question-engine data.
 * The repository caps sessions at the 10 most recent, so totals are
 * labelled "recent" and never presented as all-time history.
 */

export function QuestionPerformanceSection({
  questions,
}: {
  questions: QuestionAnalytics;
}) {
  const hasSessions = questions.sessions.length > 0;
  const { totals } = questions;

  return (
    <section aria-labelledby="question-performance-heading">
      <SectionHeader
        title="Question Sessions"
        description="From the practice question engine — recent sessions"
      />
      <span id="question-performance-heading" className="sr-only">
        Question sessions
      </span>

      {!hasSessions ? (
        <NoDataPanel message="No question sessions recorded yet. Start a practice session to see question analytics." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Recent sessions"
              value={totals.sessions}
              hint="Completed sessions (max 10 recent)"
              emphasized
            />
            <StatTile label="Questions attempted" value={totals.attempted} />
            <StatTile label="Correct" value={totals.correct} />
            <StatTile label="Accuracy" value={formatAccuracy(totals.accuracyBps)} />
          </div>

          <Card className="divide-y divide-border-subtle">
            {questions.sessions.map((session) => (
              <div key={session.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{session.scopeLabel}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="tabular-nums">{session.attempted}</span> /{" "}
                    <span className="tabular-nums">{session.totalQuestions}</span> attempted ·{" "}
                    <span className="tabular-nums">{session.incorrect}</span> incorrect ·{" "}
                    <span className="tabular-nums">{session.unanswered}</span> unanswered
                    {session.completedAt && (
                      <>
                        {" · "}
                        {formatRelativeDay(session.completedAt)}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {session.status !== "completed" && <Badge variant="neutral">In progress</Badge>}
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatAccuracy(session.accuracyBps)}
                  </span>
                </div>
              </div>
            ))}
          </Card>
          <p className="text-[11px] text-foreground-subtle">
            Showing the most recent {questions.sessions.length} question{" "}
            {questions.sessions.length === 1 ? "session" : "sessions"}; totals cover completed
            sessions only.
          </p>
        </div>
      )}
    </section>
  );
}
