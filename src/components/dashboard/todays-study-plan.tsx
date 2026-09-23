"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Clock, CalendarDays, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared/section-header";
import { cn } from "@/lib/utils/cn";
import type { PlannerTask } from "@/db/schema";
import { getTopicMetadata } from "@/domain/dashboard";

export interface TodaysStudyPlanProps {
  tasks: PlannerTask[];
  examAttemptId: string;
  onToggleComplete: (taskId: string, currentStatus: PlannerTask["status"]) => Promise<void>;
}

export function TodaysStudyPlan({ tasks, examAttemptId, onToggleComplete }: TodaysStudyPlanProps) {
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const handleToggle = async (taskId: string, currentStatus: PlannerTask["status"]) => {
    if (updatingId) return;
    setUpdatingId(taskId);
    try {
      await onToggleComplete(taskId, currentStatus);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section>
      <SectionHeader
        title="Today's Study Plan"
        description="Tasks scheduled on your agenda"
        action={
          <Button variant="ghost" size="sm" asChild className="text-xs h-8 text-primary">
            <Link href="/app/planner">
              Planner
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      {tasks.length === 0 ? (
        <Card className="p-6 text-center" variant="base">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-tint text-primary">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            No study tasks planned for today.
          </p>
          <p className="mt-1 text-xs text-foreground-subtle max-w-xs mx-auto">
            Schedule your study blocks and revisions to stay consistent.
          </p>
          <div className="mt-4">
            <Button size="sm" variant="outline" asChild>
              <Link href="/app/planner">Plan Today&apos;s Study</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const isCompleted = task.status === "completed";
            const meta = task.topicId ? getTopicMetadata(task.topicId, examAttemptId) : null;
            const isUpdating = updatingId === task.id;

            return (
              <Card
                key={task.id}
                className={cn(
                  "p-3.5 sm:p-4 transition-all",
                  isCompleted ? "opacity-70 bg-surface/50" : "bg-surface"
                )}
                variant="base"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggle(task.id, task.status)}
                    disabled={isUpdating}
                    className="mt-0.5 shrink-0 rounded text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring p-0.5"
                    aria-label={isCompleted ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-primary fill-surface-tint" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={cn(
                          "text-sm font-medium leading-snug text-foreground",
                          isCompleted && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </p>
                      {meta && (
                        <Badge variant="neutral" className="text-[10px] px-1.5 py-0 h-4">
                          {meta.subjectName}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-[11px] text-foreground-subtle">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {task.durationMinutes} min
                      </span>
                      {task.startTime && <span>{task.startTime}</span>}
                      {meta?.chapterName && (
                        <span className="truncate">{meta.chapterName}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
