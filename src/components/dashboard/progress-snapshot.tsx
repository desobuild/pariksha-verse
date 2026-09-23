"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared/section-header";
import type { PreparationProgressSnapshot } from "@/domain/dashboard";

export interface ProgressSnapshotProps {
  progress: PreparationProgressSnapshot;
}

export function ProgressSnapshot({ progress }: ProgressSnapshotProps) {
  return (
    <section>
      <SectionHeader
        title="Preparation Progress"
        description="Curriculum coverage from verified syllabus"
        action={
          <Button variant="ghost" size="sm" asChild className="text-xs h-8 text-primary">
            <Link href="/app/progress">
              Details
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <Card className="p-4 sm:p-5 space-y-5" variant="base">
        {/* Overall progress summary */}
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="text-sm font-semibold text-foreground">Overall</span>
            <span className="text-xs font-medium text-foreground-subtle">
              <span className="font-bold text-foreground">{progress.overallCovered}</span> / {progress.overallTotal} topics covered ({progress.overallPercentage}%)
            </span>
          </div>
          <Progress value={progress.overallPercentage} className="h-2" />
        </div>

        {/* Subject-level breakdown */}
        <div className="space-y-3 pt-1 border-t border-border-subtle">
          {progress.subjects.map((sub) => (
            <div key={sub.subjectId} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{sub.name}</span>
                <span className="text-foreground-subtle">
                  <span className="font-semibold text-foreground">{sub.coveredTopics}</span> / {sub.totalTopics}
                </span>
              </div>
              <Progress value={sub.percentage} className="h-1.5 bg-surface-tint" />
            </div>
          ))}
        </div>

        {/* Topic status breakdown pills */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border-subtle text-center">
          <div className="rounded-lg bg-surface-tint/50 p-2">
            <p className="text-sm font-bold text-foreground">{progress.breakdown.mastered}</p>
            <p className="text-[10px] text-foreground-subtle font-medium">Mastered</p>
          </div>
          <div className="rounded-lg bg-surface-tint/50 p-2">
            <p className="text-sm font-bold text-foreground">{progress.breakdown.revised}</p>
            <p className="text-[10px] text-foreground-subtle font-medium">Revised</p>
          </div>
          <div className="rounded-lg bg-surface-tint/50 p-2">
            <p className="text-sm font-bold text-foreground">{progress.breakdown.practiced}</p>
            <p className="text-[10px] text-foreground-subtle font-medium">Practiced</p>
          </div>
          <div className="rounded-lg bg-surface-tint/50 p-2">
            <p className="text-sm font-bold text-foreground">{progress.breakdown.learning}</p>
            <p className="text-[10px] text-foreground-subtle font-medium">Learning</p>
          </div>
        </div>
      </Card>
    </section>
  );
}
