"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, RotateCcw, Target, BookOpen, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/shared/icon-tile";
import type { TodaysFocusRecommendation, FocusActionType } from "@/domain/dashboard";

export interface TodaysFocusCardProps {
  focus: TodaysFocusRecommendation;
}

const ACTION_ICONS: Record<FocusActionType, React.ElementType> = {
  revision: RotateCcw,
  practice: Target,
  study: BookOpen,
  planner: Calendar,
  continue: Sparkles,
};

const BADGE_VARIANTS: Record<FocusActionType, "primary" | "warning" | "default" | "neutral"> = {
  revision: "primary",
  practice: "warning",
  study: "primary",
  planner: "default",
  continue: "neutral",
};

export function TodaysFocusCard({ focus }: TodaysFocusCardProps) {
  const IconComponent = ACTION_ICONS[focus.action] || Sparkles;
  const badgeVariant = BADGE_VARIANTS[focus.action] || "primary";

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-b from-surface via-surface to-surface-tint/20 p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={badgeVariant} className="px-2.5 py-0.5 font-semibold">
            {focus.badgeText}
          </Badge>
          {focus.subjectName && (
            <span className="text-xs font-medium text-foreground-subtle">
              {focus.subjectName}
            </span>
          )}
        </div>

        <IconTile variant="tint" size="sm" className="shrink-0 text-primary">
          <IconComponent className="h-4 w-4" aria-hidden="true" />
        </IconTile>
      </div>

      {/* Main Focus Title */}
      <div className="mt-3.5">
        <h3 className="type-h3 text-foreground tracking-tight leading-tight">
          {focus.title}
        </h3>
        {focus.subtitle && (
          <p className="mt-1 text-xs text-foreground-subtle font-medium">
            {focus.subtitle}
          </p>
        )}
      </div>

      {/* Explainable Reason Box */}
      <div className="mt-4 rounded-xl bg-surface-tint/60 border border-border-subtle/50 px-3.5 py-2.5 text-xs">
        <span className="font-semibold text-foreground">Why this today? </span>
        <span className="text-foreground-subtle">{focus.reason}</span>
      </div>

      {/* Action Button */}
      <div className="mt-5">
        <Button asChild size="lg" className="w-full sm:w-auto font-semibold gap-2">
          <Link href={focus.ctaHref}>
            <span>{focus.ctaLabel}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
