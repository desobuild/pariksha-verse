"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, AlertCircle, Clock, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared/section-header";
import type { AttentionItem } from "@/domain/dashboard";

export interface AttentionNeededProps {
  items: AttentionItem[];
}

export function AttentionNeeded({ items }: AttentionNeededProps) {
  return (
    <section>
      <SectionHeader
        title="Attention Needed"
        description="Actionable items that keep your preparation aligned"
      />

      {items.length === 0 ? (
        <Card className="p-4 sm:p-5 flex items-center gap-3.5" variant="base">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">All caught up</p>
            <p className="text-xs text-foreground-subtle">
              No overdue revisions or urgent items pending today.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const badgeVariant =
              item.badgeVariant === "urgent"
                ? "destructive"
                : item.badgeVariant === "warning"
                ? "warning"
                : "neutral";

            return (
              <Card
                key={item.id}
                className="p-3.5 sm:p-4 hover:border-primary/40 transition-colors"
                variant="base"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0 text-muted-foreground">
                      {item.type === "revision_overdue" ? (
                        <RotateCcw className="h-4 w-4 text-destructive" aria-hidden="true" />
                      ) : item.type === "weak_practice" ? (
                        <AlertCircle className="h-4 w-4 text-warning" aria-hidden="true" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {item.title}
                        </p>
                        <Badge variant={badgeVariant} className="text-[10px] px-1.5 py-0">
                          {item.badgeLabel}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-foreground-subtle leading-normal">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={item.actionHref}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1"
                  >
                    <span>{item.actionLabel}</span>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
