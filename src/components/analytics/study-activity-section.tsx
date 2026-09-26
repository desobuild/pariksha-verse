"use client";

import * as React from "react";
import { Clock, CalendarCheck2, Timer, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/section-header";
import { TrendBars, LabeledBar } from "./charts";
import { StatTile, NoDataPanel } from "./stat-tile";
import type { StudyTimeAnalytics } from "@/domain/analytics";
import { formatDurationMinutes } from "@/domain/study";

/**
 * Section 4 — Study activity. Built strictly from recorded study sessions;
 * planned time never appears as studied time.
 */

export function StudyActivitySection({
  study,
  periodLabel,
}: {
  study: StudyTimeAnalytics;
  periodLabel: string;
}) {
  const hasData = study.sessionCount > 0;

  return (
    <section aria-labelledby="study-activity-heading">
      <SectionHeader
        title="Study Activity"
        description={`Time from your recorded study sessions · ${periodLabel}`}
      />
      <span id="study-activity-heading" className="sr-only">
        Study activity
      </span>

      {!hasData ? (
        <NoDataPanel message={`No study sessions recorded in the last ${periodLabel.toLowerCase()}.`} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Study time"
              value={formatDurationMinutes(study.totalMinutes)}
              icon={<Clock className="h-4 w-4" aria-hidden="true" />}
              emphasized
            />
            <StatTile
              label="Sessions"
              value={study.sessionCount}
              icon={<Layers className="h-4 w-4" aria-hidden="true" />}
            />
            <StatTile
              label="Avg session"
              value={formatDurationMinutes(study.avgSessionMinutes)}
              icon={<Timer className="h-4 w-4" aria-hidden="true" />}
            />
            <StatTile
              label="Active days"
              value={study.activeStudyDays}
              icon={<CalendarCheck2 className="h-4 w-4" aria-hidden="true" />}
            />
          </div>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Study time trend</h3>
            <TrendBars
              ariaLabel={`Study time trend, ${periodLabel}`}
              unit="minutes"
              data={study.series.map((b) => ({
                key: b.key,
                label: b.label,
                value: b.minutes,
                hasActivity: b.hasActivity,
                detail: `${formatDurationMinutes(b.minutes)} across ${b.sessions} ${b.sessions === 1 ? "session" : "sessions"}`,
              }))}
            />
          </Card>

          {study.bySubject.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Study time by subject</h3>
              <div className="space-y-3">
                {study.bySubject.map((subject) => (
                  <LabeledBar
                    key={subject.subjectId}
                    label={subject.subjectName}
                    value={subject.minutes}
                    max={Math.max(...study.bySubject.map((s) => s.minutes))}
                    trailing={`${formatDurationMinutes(subject.minutes)} · ${subject.sessions} ${subject.sessions === 1 ? "session" : "sessions"}`}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
