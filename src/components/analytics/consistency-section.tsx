"use client";

import * as React from "react";
import { CalendarCheck2, PenLine, ClipboardList, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/section-header";
import { StatTile } from "./stat-tile";
import type { ConsistencyAnalytics } from "@/domain/analytics";

/**
 * Section 9 — Consistency. A neutral, factual view of activity: how many
 * days in the window had recorded study or practice. No streak mechanics,
 * no judgement, no gamification.
 */

export function ConsistencySection({ consistency }: { consistency: ConsistencyAnalytics }) {
  const windowDays = consistency.windowDays;
  const periodText =
    windowDays !== null
      ? `the last ${windowDays} ${windowDays === 1 ? "day" : "days"}`
      : "the selected period (all time)";

  return (
    <section aria-labelledby="consistency-heading">
      <SectionHeader
        title="Consistency"
        description={`Activity recorded during ${periodText}`}
      />
      <span id="consistency-heading" className="sr-only">
        Consistency
      </span>

      <Card className="space-y-4 p-4 sm:p-5">
        <p className="text-sm text-foreground">
          {windowDays !== null ? (
            <>
              Studied on{" "}
              <span className="font-semibold tabular-nums">{consistency.activeStudyDays}</span> of
              the last <span className="tabular-nums">{windowDays}</span>{" "}
              {windowDays === 1 ? "day" : "days"}.
            </>
          ) : (
            <>
              Studied on{" "}
              <span className="font-semibold tabular-nums">{consistency.activeStudyDays}</span>{" "}
              {consistency.activeStudyDays === 1 ? "day" : "days"} in total.
            </>
          )}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Active study days"
            value={consistency.activeStudyDays}
            icon={<CalendarCheck2 className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Active practice days"
            value={consistency.activePracticeDays}
            icon={<PenLine className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Practice sessions"
            value={consistency.practiceSessions}
            icon={<ClipboardList className="h-4 w-4" aria-hidden="true" />}
          />
          <StatTile
            label="Revisions completed"
            value={consistency.revisionCompletions}
            icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      </Card>
    </section>
  );
}
