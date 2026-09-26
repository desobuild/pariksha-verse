"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Lightweight, accessible trend chart used across the analytics screen.
 *
 * Deliberately hand-rolled (no chart library): the product ships no chart
 * dependency, and these trends are simple value-over-bucket bars that stay
 * readable at 375px. Buckets without activity render as an empty slot so
 * "no practice" is never drawn as a 0%-accuracy or 0-minute bar.
 */

export interface TrendBarDatum {
  key: string;
  label: string;
  /** Primary value driving the bar height. */
  value: number;
  /** False buckets render as empty slots (no baseline bar, distinct aria text). */
  hasActivity: boolean;
  /** Optional stacked breakdown; values are relative to `value`. */
  segments?: { value: number; className: string; name: string }[];
  /** Per-bucket tooltip / screen-reader text, e.g. "34 questions · 71%". */
  detail?: string;
}

export interface TrendBarsProps {
  data: TrendBarDatum[];
  /** Accessible name for the whole chart, announced before the summary. */
  ariaLabel: string;
  /** Unit used in the summary sentence, e.g. "questions" or "minutes". */
  unit: string;
  className?: string;
  /** Visual height of the bar area. */
  heightClass?: string;
}

export function TrendBars({ data, ariaLabel, unit, className, heightClass = "h-28" }: TrendBarsProps) {
  const active = data.filter((d) => d.hasActivity);
  const max = Math.max(1, ...data.map((d) => d.value));
  const summary =
    active.length === 0
      ? `${ariaLabel}: no activity recorded.`
      : `${ariaLabel}: ${active.length} of ${data.length} buckets with activity, highest ${max} ${unit}.`;

  return (
    <figure className={cn("m-0", className)}>
      <div role="img" aria-label={summary} className={cn("flex w-full items-end gap-[2px]", heightClass)}>
        {data.map((d) => {
          const pct = Math.max(0, Math.min(100, (d.value / max) * 100));
          const tooltip = [d.label, d.detail ?? (d.hasActivity ? `${d.value} ${unit}` : "No activity")]
            .filter(Boolean)
            .join(" · ");
          return (
            <div
              key={d.key}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={tooltip}
            >
              {d.hasActivity && d.value > 0 ? (
                d.segments && d.segments.length > 0 ? (
                  <div className="flex w-full flex-col justify-end" style={{ height: `${pct}%` }}>
                    {d.segments.map((segment, index) => (
                      <div
                        key={segment.name}
                        className={cn("w-full", segment.className, index === 0 && "rounded-t-[2px]")}
                        style={{
                          height: `${d.value > 0 ? (segment.value / d.value) * 100 : 0}%`,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="w-full rounded-t-[2px] bg-primary/80" style={{ height: `${pct}%` }} />
                )
              ) : (
                <div className="h-[3px] w-full rounded-full bg-border/70" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
      <figcaption className="sr-only">
        <ul>
          {data.map((d) => (
            <li key={d.key}>
              {d.label}: {d.hasActivity ? d.detail ?? `${d.value} ${unit}` : "no activity"}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/**
 * Horizontal labelled bar for by-subject / section values — clearer than a
 * chart for a handful of named rows.
 */
export function LabeledBar({
  label,
  value,
  max,
  trailing,
  barClassName,
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  trailing?: React.ReactNode;
  barClassName?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-foreground">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-foreground-subtle">{trailing}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-tint">
        <div
          className={cn("h-full rounded-full bg-primary", barClassName)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
