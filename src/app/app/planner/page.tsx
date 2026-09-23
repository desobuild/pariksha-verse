"use client";

import * as React from "react";
import { CalendarDays, Plus } from "lucide-react";
import { PageContainer } from "@/components/navigation/page-container";
import { SectionHeader } from "@/components/shared/section-header";
import { IconTile } from "@/components/shared/icon-tile";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** Real current-week strip; selection is visual until the planner engine ships. */
function WeekStrip() {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div className="mb-6 grid grid-cols-7 gap-1.5" role="group" aria-label="Current week">
      {days.map((d, i) => {
        const isToday = d.toDateString() === today.toDateString();
        return (
          <div
            key={d.toISOString()}
            className={cn(
              "flex min-h-[44px] flex-col items-center justify-center rounded-2xl py-2 text-center",
              isToday ? "bg-primary text-primary-foreground shadow-subtle" : "bg-surface-tint/60 text-muted-foreground"
            )}
            aria-current={isToday ? "date" : undefined}
          >
            <span className="text-[10px] font-medium leading-none opacity-80">{DAY_LABELS[i]}</span>
            <span className={cn("mt-1 text-sm leading-none", isToday && "font-bold")}>
              {d.getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function PlannerPage() {
  return (
    <PageContainer>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="type-h1">Study Planner</h1>
          <p className="mt-1 type-body text-muted-foreground">
            Shape your week around what matters most.
          </p>
        </div>
        <span
          className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-subtle"
          aria-hidden="true"
        >
          <Plus className="h-5 w-5" />
        </span>
      </div>

      <WeekStrip />

      <SectionHeader title="Today" description="Scheduled tasks for the day" />
      <Card className="p-5">
        <div className="flex items-center gap-3.5">
          <IconTile variant="tint" size="md">
            <CalendarDays className="h-5 w-5" />
          </IconTile>
          <div>
            <p className="text-sm font-semibold text-foreground">No tasks scheduled</p>
            <p className="mt-0.5 text-xs leading-relaxed text-foreground-subtle">
              Daily agendas and revision scheduling arrive with the planner engine.
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-8">
        <SectionHeader title="This Week" />
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your weekly overview will summarize planned study blocks, revision slots, and mock
            test days once scheduling is live.
          </p>
        </Card>
      </div>
    </PageContainer>
  );
}
