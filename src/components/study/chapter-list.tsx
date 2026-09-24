"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronRight, CircleDot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TopicStatusBadge } from "@/components/study/topic-status";
import type {
  DerivedChapterStatus,
  FilteredChapter,
  ProgressIndex,
  StudySectionProgress,
} from "@/domain/study";
import { cn } from "@/lib/utils/cn";

const CHAPTER_STATUS_META: Record<
  DerivedChapterStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  not_started: {
    label: "Not Started",
    icon: CircleDot,
    className: "text-foreground-subtle",
  },
  in_progress: {
    label: "In Progress",
    icon: CircleDot,
    className: "text-info",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "text-success",
  },
};

export interface ChapterListProps {
  chapters: FilteredChapter[];
  progressIndex: ProgressIndex;
  /** True chapter-level stats keyed by chapterId (never filtered subsets). */
  statsByChapter: Map<string, StudySectionProgress>;
  expandedIds: ReadonlySet<string>;
  onToggleChapter: (chapterId: string) => void;
}

export function ChapterList({
  chapters,
  progressIndex,
  statsByChapter,
  expandedIds,
  onToggleChapter,
}: ChapterListProps) {
  return (
    <div className="space-y-3">
      {chapters.map((chapter, arrayIndex) => {
        const stats = statsByChapter.get(chapter.chapterId);
        const covered = stats?.covered ?? 0;
        const total = stats?.total ?? chapter.topics.length;
        const percentage = stats?.percentage ?? 0;
        const status = stats?.status ?? "not_started";
        const isExpanded = expandedIds.has(chapter.chapterId);
        const statusMeta = CHAPTER_STATUS_META[status];
        const StatusIcon = statusMeta.icon;
        const topicsId = `chapter-topics-${chapter.chapterId}`;

        return (
          <Card key={chapter.chapterId} variant="base" className="overflow-hidden">
            <button
              type="button"
              onClick={() => onToggleChapter(chapter.chapterId)}
              aria-expanded={isExpanded}
              aria-controls={topicsId}
              className="flex min-h-[44px] w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span
                className="w-7 shrink-0 text-center text-xs font-semibold tabular-nums text-foreground-subtle"
                aria-hidden="true"
              >
                {String(arrayIndex + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {chapter.name}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-foreground-subtle transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-subtle">
                  <span className="tabular-nums">
                    {covered} / {total} topics
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{percentage}%</span>
                  <span aria-hidden="true">·</span>
                  <span className={cn("inline-flex items-center gap-1 font-medium", statusMeta.className)}>
                    <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">Chapter status: </span>
                    {statusMeta.label}
                  </span>
                </span>
                <Progress
                  value={percentage}
                  className="mt-2.5 h-1.5"
                  aria-label={`${chapter.name}: ${covered} of ${total} topics covered`}
                />
              </span>
            </button>

            {isExpanded && (
              <ul
                id={topicsId}
                className="divide-y divide-border-subtle border-t border-border-subtle"
              >
                {chapter.topics.map((topic) => (
                  <li key={topic.topicId}>
                    <Link
                      href={`/app/study/${encodeURIComponent(topic.topicId)}`}
                      className="flex min-h-[44px] items-center gap-2 py-2.5 pl-14 pr-4 transition-colors hover:bg-surface-tint/40 focus-visible:outline-none focus-visible:bg-surface-tint/40"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {topic.name}
                      </span>
                      <TopicStatusBadge
                        status={progressIndex.get(topic.topicId)?.status ?? "not_started"}
                        className="shrink-0"
                      />
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-foreground-subtle"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
