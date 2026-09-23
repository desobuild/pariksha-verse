"use client";

import * as React from "react";
import { BookOpen, Target, CheckCircle2, History, FileCheck2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/section-header";
import type { RecentActivityItem } from "@/domain/dashboard";

export interface RecentActivityProps {
  activities: RecentActivityItem[];
}

const TYPE_ICONS: Record<RecentActivityItem["type"], React.ElementType> = {
  study: BookOpen,
  practice: Target,
  revision: History,
  planner: CheckCircle2,
  mock: FileCheck2,
};

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <section>
      <SectionHeader
        title="Recent Activity"
        description="Your logged preparation milestones"
      />

      {activities.length === 0 ? (
        <Card className="p-5 text-center" variant="base">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-surface-tint text-muted-foreground">
            <History className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="mt-2 text-xs text-foreground-subtle max-w-xs mx-auto">
            Your study activity will appear here as you prepare.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {activities.map((item) => {
            const Icon = TYPE_ICONS[item.type] || History;

            return (
              <Card key={item.id} className="p-3 sm:p-3.5" variant="base">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-tint text-primary">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-foreground-subtle truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                    {item.timeLabel}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
