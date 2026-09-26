"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, Target, Timer, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared/section-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TrendBars } from "./charts";
import { StatTile } from "./stat-tile";
import type { MockAnalytics, MockHistoryEntry } from "@/domain/analytics";
import { formatAccuracy } from "@/domain/practice";
import { formatDurationMinutes } from "@/domain/study";
import { formatRelativeDay } from "./format";

/**
 * Section 7 — Mock performance. Raw scores are always shown against their
 * own maximum ("312 / 720"); cross-mock averages use normalized measures
 * (accuracy, % of max marks) and are labelled as such. No percentiles, no
 * predictions.
 */

/** Mock history entries shown before "Show older results". */
const HISTORY_LIMIT = 5;

export function MockPerformanceSection({
  mocks,
  periodLabel,
}: {
  mocks: MockAnalytics;
  periodLabel: string;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const hasMocks = mocks.completed > 0;
  const history = showAll ? mocks.history : mocks.history.slice(0, HISTORY_LIMIT);

  return (
    <section aria-labelledby="mock-performance-heading">
      <SectionHeader
        title="Mock Performance"
        description={`Completed mock tests · ${periodLabel}`}
      />
      <span id="mock-performance-heading" className="sr-only">
        Mock performance
      </span>

      {!hasMocks ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" aria-hidden="true" />}
          title={`No mocks completed in this period`}
          description="Mock results appear here after you finish a test in Mock Tests."
          action={
            <Button asChild size="sm" className="min-h-[44px]">
              <Link href="/app/mock-tests">Open Mock Tests</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Mocks completed"
              value={mocks.completed}
              icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
              emphasized
            />
            <StatTile
              label="Avg score"
              value={mocks.avgScorePctOfMax !== null ? `${mocks.avgScorePctOfMax}%` : "—"}
              hint="of each mock's max marks"
              icon={<Target className="h-4 w-4" aria-hidden="true" />}
            />
            <StatTile
              label="Avg accuracy"
              value={mocks.avgAccuracyBps !== null ? formatAccuracy(mocks.avgAccuracyBps) : "—"}
            />
            <StatTile
              label="Avg time"
              value={mocks.avgTimeMinutes !== null ? formatDurationMinutes(mocks.avgTimeMinutes) : "—"}
              icon={<Timer className="h-4 w-4" aria-hidden="true" />}
            />
          </div>

          {mocks.best && (
            <p className="text-xs text-muted-foreground">
              <Award className="mr-1 inline h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Highest score: {mocks.best.title} —{" "}
              {mocks.best.scorePctOfMax !== null ? `${mocks.best.scorePctOfMax}% of max marks` : "n/a"},{" "}
              {formatAccuracy(mocks.best.accuracyBps)} accuracy.
            </p>
          )}

          {mocks.trend.length >= 2 && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Accuracy across mocks</h3>
              <TrendBars
                ariaLabel="Mock accuracy across completed mocks, oldest to newest"
                unit="percent"
                heightClass="h-24"
                data={mocks.trend.map((entry) => ({
                  key: entry.key,
                  label: entry.label,
                  value: entry.accuracyBps / 100,
                  hasActivity: true,
                  detail: `${formatAccuracy(entry.accuracyBps)} accuracy`,
                }))}
              />
            </Card>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Mock history</h3>
            <ul className="space-y-2.5">
              {history.map((entry) => (
                <MockHistoryCard key={entry.resultId} entry={entry} />
              ))}
            </ul>
            {!showAll && mocks.history.length > HISTORY_LIMIT && (
              <Button
                variant="outline"
                className="mt-3 min-h-[44px] w-full sm:w-auto"
                onClick={() => setShowAll(true)}
              >
                Show older results ({mocks.history.length - HISTORY_LIMIT})
              </Button>
            )}
          </div>

          {mocks.sectionPerformance.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground">Section performance</h3>
              <p className="mt-0.5 text-xs text-foreground-subtle">
                Aggregated across {mocks.resultsWithSections} mocks with sections
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <caption className="sr-only">
                    Section performance aggregated across mocks
                  </caption>
                  <thead>
                    <tr className="border-b border-border-subtle text-xs text-foreground-subtle">
                      <th scope="col" className="pb-2 pr-3 font-medium">Section</th>
                      <th scope="col" className="pb-2 pr-3 font-medium">Attempted</th>
                      <th scope="col" className="pb-2 pr-3 font-medium">Correct</th>
                      <th scope="col" className="pb-2 pr-3 font-medium">Incorrect</th>
                      <th scope="col" className="pb-2 pr-3 font-medium">Accuracy</th>
                      <th scope="col" className="pb-2 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {mocks.sectionPerformance.map((section) => (
                      <tr key={section.sectionId}>
                        <th scope="row" className="py-2 pr-3 font-medium text-foreground">
                          {section.name}
                        </th>
                        <td className="py-2 pr-3 tabular-nums text-foreground-subtle">
                          {section.attempted}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-foreground-subtle">
                          {section.correct}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-foreground-subtle">
                          {section.incorrect}
                        </td>
                        <td className="py-2 pr-3 tabular-nums font-medium text-foreground">
                          {formatAccuracy(section.accuracyBps)}
                        </td>
                        <td className="py-2 tabular-nums text-foreground-subtle">
                          {section.rawScore} / {section.maxScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

function MockHistoryCard({ entry }: { entry: MockHistoryEntry }) {
  return (
    <li>
      <Card className="space-y-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{entry.title}</span>
          <span className="flex items-center gap-2">
            {entry.submissionStatus === "auto_submitted" && (
              <Badge variant="neutral">Auto-submitted</Badge>
            )}
            <span className="text-xs tabular-nums text-foreground-subtle">
              {formatRelativeDay(entry.completedAt)}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {entry.rawScore} / {entry.totalMarks} marks
            {entry.scorePctOfMax !== null && (
              <span className="ml-1 font-normal text-foreground-subtle">
                ({entry.scorePctOfMax}% of max)
              </span>
            )}
          </span>
          <span className="tabular-nums">{formatAccuracy(entry.accuracyBps)} accuracy</span>
          <span className="tabular-nums">
            {entry.attempted} / {entry.totalQuestions} attempted
          </span>
          <span className="tabular-nums">
            {formatDurationMinutes(Math.round(entry.timeSpentSeconds / 60))} taken
          </span>
        </div>
        {entry.sections.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border-subtle pt-2 text-[11px] text-muted-foreground">
            {entry.sections.map((section) => (
              <span key={section.sectionId} className="tabular-nums">
                {section.name}: {section.rawScore}/{section.maxScore} ·{" "}
                {formatAccuracy(section.accuracyBps)}
              </span>
            ))}
          </div>
        )}
      </Card>
    </li>
  );
}
