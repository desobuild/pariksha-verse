"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/section-header";
import { TrendBars } from "./charts";
import { StatTile, NoDataPanel } from "./stat-tile";
import type { PracticeTrendAnalytics } from "@/domain/analytics";
import { formatAccuracy } from "@/domain/practice";

/**
 * Section 5 — Practice performance trends. Volume buckets show correct vs
 * incorrect attempts; the accuracy series only includes buckets that had
 * practice, so "no activity" is never drawn as 0%.
 */

export function PracticeTrendsSection({
  practice,
  periodLabel,
}: {
  practice: PracticeTrendAnalytics;
  periodLabel: string;
}) {
  const { totals, buckets, accuracySeries } = practice;
  const hasAnyPractice = totals.sessions > 0;

  return (
    <section aria-labelledby="practice-trends-heading">
      <SectionHeader
        title="Practice Trends"
        description={`Questions attempted and accuracy over time · ${periodLabel}`}
      />
      <span id="practice-trends-heading" className="sr-only">
        Practice trends
      </span>

      {!hasAnyPractice ? (
        <NoDataPanel message={`No practice sessions recorded in the last ${periodLabel.toLowerCase()}.`} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Questions attempted" value={totals.questions} emphasized />
            <StatTile label="Correct" value={totals.correct} />
            <StatTile label="Incorrect" value={totals.incorrect} />
            <StatTile label="Accuracy" value={formatAccuracy(totals.accuracyBps)} />
          </div>

          <Card className="p-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Questions per bucket</h3>
              <p className="flex items-center gap-3 text-[11px] text-foreground-subtle">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-primary" />
                  Correct
                </span>
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-destructive/60" />
                  Incorrect
                </span>
              </p>
            </div>
            <TrendBars
              ariaLabel={`Practice volume, ${periodLabel}`}
              unit="questions"
              data={buckets.map((b) => ({
                key: b.key,
                label: b.label,
                value: b.questions,
                hasActivity: b.hasActivity,
                detail: `${b.questions} ${b.questions === 1 ? "question" : "questions"} · ${formatAccuracy(b.accuracyBps ?? 0)} accuracy`,
                segments: [
                  { value: b.correct, className: "bg-primary", name: "correct" },
                  { value: b.incorrect, className: "bg-destructive/60", name: "incorrect" },
                ],
              }))}
            />
            <p className="mt-2 text-[11px] text-foreground-subtle">
              Empty slots are buckets without practice — they are not 0% accuracy.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Accuracy on buckets with practice
            </h3>
            {accuracySeries.length === 0 ? (
              <NoDataPanel message="No accuracy to chart yet." />
            ) : (
              <TrendBars
                ariaLabel={`Practice accuracy, ${periodLabel}`}
                unit="accuracy buckets"
                heightClass="h-24"
                data={accuracySeries.map((b) => ({
                  key: b.key,
                  label: b.label,
                  value: b.accuracyBps / 100,
                  hasActivity: true,
                  detail: `${formatAccuracy(b.accuracyBps)} accuracy across ${b.questions} ${b.questions === 1 ? "question" : "questions"}`,
                }))}
              />
            )}
            <p className="mt-2 text-[11px] text-foreground-subtle">
              <span className="tabular-nums">{totals.avgQuestionsPerSession}</span> questions per
              session on average across <span className="tabular-nums">{totals.sessions}</span>{" "}
              {totals.sessions === 1 ? "session" : "sessions"}.
            </p>
          </Card>
        </div>
      )}
    </section>
  );
}
