"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck2, RotateCcw, CalendarClock, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared/section-header";
import { TrendBars } from "./charts";
import { StatTile } from "./stat-tile";
import type { RevisionActivityAnalytics } from "@/domain/analytics";
import { formatRelativeDay } from "./format";

/**
 * Section 8 — Revision activity. Queue counts reuse the Phase 8 revision
 * domain; completions come from recorded revision timestamps.
 */

const RECENT_LIMIT = 5;

export function RevisionActivitySection({
  revision,
  periodLabel,
}: {
  revision: RevisionActivityAnalytics;
  periodLabel: string;
}) {
  const recent = revision.recentlyRevised.slice(0, RECENT_LIMIT);

  return (
    <section aria-labelledby="revision-activity-heading">
      <SectionHeader
        title="Revision Activity"
        description="Spaced review state and completed revisions"
      />
      <span id="revision-activity-heading" className="sr-only">
        Revision activity
      </span>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Due today"
            value={revision.dueToday}
            icon={<CalendarCheck2 className="h-4 w-4" aria-hidden="true" />}
            emphasized
          />
          <StatTile
            label="Overdue"
            value={revision.overdue}
            icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
            tone={revision.overdue > 0 ? "warning" : undefined}
          />
          <StatTile
            label="Upcoming"
            value={revision.upcoming}
            icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label={`Revised · ${periodLabel}`}
            value={revision.completionsInRange}
            icon={<History className="h-4 w-4" aria-hidden="true" />}
          />
        </div>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Revision completions over time
          </h3>
          <TrendBars
            ariaLabel={`Revision completions, ${periodLabel}`}
            unit="topics"
            heightClass="h-20"
            data={revision.series.map((b) => ({
              key: b.key,
              label: b.label,
              value: b.topicsRevised,
              hasActivity: b.hasActivity,
              detail: `${b.topicsRevised} ${b.topicsRevised === 1 ? "topic" : "topics"} revised`,
            }))}
          />
        </Card>

        {recent.length > 0 && (
          <Card className="divide-y divide-border-subtle">
            {recent.map((entry) => (
              <div key={entry.topicId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/app/study/${encodeURIComponent(entry.topicId)}`}
                    className="inline-flex items-center rounded text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {entry.topicName}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {entry.subjectName} · {entry.chapterName}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-foreground-subtle">
                  {formatRelativeDay(entry.lastRevisedAt)}
                </span>
              </div>
            ))}
          </Card>
        )}

        <Button asChild variant="outline" className="min-h-[44px] w-full sm:w-auto">
          <Link href="/app/revision">Open Revision Queue</Link>
        </Button>
      </div>
    </section>
  );
}
