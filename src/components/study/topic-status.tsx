"use client";

import * as React from "react";
import {
  Award,
  BookCheck,
  BookOpen,
  ChevronDown,
  Circle,
  RotateCcw,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TopicStatus } from "@/domain/study";
import { TOPIC_STATUS_OPTIONS, getTopicStatusLabel } from "@/domain/study";
import { cn } from "@/lib/utils/cn";

type BadgeVariant = "neutral" | "info" | "primary" | "warning" | "secondary" | "success";

/**
 * Status presentation map. Every status pairs a distinct icon with its
 * text label so meaning never relies on color alone.
 */
export const TOPIC_STATUS_UI: Record<TopicStatus, { icon: LucideIcon; badgeVariant: BadgeVariant }> = {
  not_started: { icon: Circle, badgeVariant: "neutral" },
  learning: { icon: BookOpen, badgeVariant: "info" },
  learned: { icon: BookCheck, badgeVariant: "primary" },
  practiced: { icon: Target, badgeVariant: "warning" },
  revised: { icon: RotateCcw, badgeVariant: "secondary" },
  mastered: { icon: Award, badgeVariant: "success" },
};

export interface TopicStatusBadgeProps {
  status: TopicStatus;
  className?: string;
}

export function TopicStatusBadge({ status, className }: TopicStatusBadgeProps) {
  const { icon: Icon, badgeVariant } = TOPIC_STATUS_UI[status];
  return (
    <Badge variant={badgeVariant} className={cn("gap-1", className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">Status: </span>
      {getTopicStatusLabel(status)}
    </Badge>
  );
}

export interface StatusControlProps {
  value: TopicStatus;
  onChange: (status: TopicStatus) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Compact deliberate status control: a single button opening a menu of the
 * six preparation states instead of a wall of buttons.
 */
export function StatusControl({ value, onChange, disabled, className }: StatusControlProps) {
  const { icon: Icon } = TOPIC_STATUS_UI[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("min-h-[44px] gap-2 font-medium", className)}
          disabled={disabled}
          aria-label={`Topic status: ${getTopicStatusLabel(value)}. Change status`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {getTopicStatusLabel(value)}
          <ChevronDown className="h-4 w-4 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[16rem]">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as TopicStatus)}>
          {TOPIC_STATUS_OPTIONS.map((option) => {
            const { icon: OptionIcon } = TOPIC_STATUS_UI[option.value];
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="min-h-[44px] gap-2.5 py-2"
              >
                <OptionIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-medium">{option.label}</span>
                <span className="ml-auto pl-3 text-xs text-foreground-subtle">{option.hint}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
