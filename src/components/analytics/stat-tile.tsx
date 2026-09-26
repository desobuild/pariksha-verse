"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

/**
 * Compact factual stat tile used across the analytics screen. Values may be
 * numbers or pre-formatted strings; nothing here computes metrics.
 */
export function StatTile({
  label,
  value,
  icon,
  tone,
  emphasized,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "warning" | "info";
  emphasized?: boolean;
  hint?: string;
}) {
  return (
    <Card
      variant="base"
      className={cn(
        "p-3.5",
        emphasized && "border-primary/30 bg-surface-tint/40",
        tone === "warning" && "border-warning/25"
      )}
    >
      <div className="flex items-center gap-1.5 text-foreground-subtle">
        {icon && (
          <span
            aria-hidden="true"
            className={cn(
              tone === "warning" ? "text-warning" : emphasized ? "text-primary" : undefined
            )}
          >
            {icon}
          </span>
        )}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p
        className={cn(
          "mt-1.5 text-2xl font-bold tabular-nums",
          tone === "warning" ? "text-warning" : emphasized ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-foreground-subtle">{hint}</p>}
    </Card>
  );
}

/**
 * Quiet inline panel for "not enough data yet" — sections without records
 * show this instead of zeros dressed up as insights.
 */
export function NoDataPanel({ message }: { message: string }) {
  return (
    <p
      className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-3.5 text-sm text-muted-foreground"
      role="note"
    >
      {message}
    </p>
  );
}
