"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck, Clock, ChevronRight, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconTile } from "@/components/shared/icon-tile";
import type { DashboardSnapshot } from "@/domain/dashboard";

export interface DashboardHeaderProps {
  examData: DashboardSnapshot["exam"];
}

export function DashboardHeader({ examData }: DashboardHeaderProps) {
  const formattedDate = examData.examDate
    ? new Date(examData.examDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <header className="mb-6 space-y-4">
      {/* Greeting */}
      <div>
        <h1 className="type-h1 text-foreground">Welcome back</h1>
        <p className="mt-1 type-body text-muted-foreground">Ready to make today count?</p>
      </div>

      {/* Active Exam Target Card */}
      <Card className="p-4 sm:p-5" variant="base">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <IconTile variant="strong" size="lg" className="shrink-0">
              <CalendarCheck className="h-6 w-6" aria-hidden="true" />
            </IconTile>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-foreground tracking-tight">
                  {examData.attemptLabel}
                </span>
                {examData.isProvisional && (
                  <Badge variant="primary">Provisional syllabus</Badge>
                )}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground-subtle">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {formattedDate ? `Exam on ${formattedDate} · ` : ""}
                <span className="font-medium text-foreground">{examData.countdown.label}</span>
              </p>
            </div>
          </div>

          <Link
            href="/exam/select"
            className="shrink-0 self-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Change target exam"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>

        {/* Compact stage and goal indicators */}
        {(examData.stageLabel !== "—" || examData.goalLabel !== "—") && (
          <div className="mt-4 pt-3.5 border-t border-border-subtle grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <IconTile variant="tint" size="sm" className="shrink-0">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              </IconTile>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight text-foreground truncate">
                  {examData.goalLabel}
                </p>
                <p className="text-[10px] text-foreground-subtle">Daily goal</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 min-w-0">
              <IconTile variant="tint" size="sm" className="shrink-0">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
              </IconTile>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight text-foreground truncate">
                  {examData.stageLabel}
                </p>
                <p className="text-[10px] text-foreground-subtle">Current stage</p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </header>
  );
}
