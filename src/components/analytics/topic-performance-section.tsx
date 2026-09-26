"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared/section-header";
import { EmptyState } from "@/components/shared/empty-state";
import { NoDataPanel } from "./stat-tile";
import {
  filterAndSortTopicPerformance,
  TOPIC_SORT_OPTIONS,
  type TopicPerformanceAnalytics,
  type TopicSortKey,
  type TopicStatusFilterValue,
} from "@/domain/analytics";
import { formatAccuracy } from "@/domain/practice";
import { getTopicStatusLabel } from "@/domain/study";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import { formatRelativeDay } from "./format";

/** Topics shown before "Show all" expands the list. */
const TOPIC_DISPLAY_LIMIT = 25;

/**
 * Section 3 — Topic performance. Sortable, filterable topic rows built on
 * the analytics domain's filtering; no scores, only recorded metrics.
 */

export interface TopicPerformanceSectionProps {
  topics: TopicPerformanceAnalytics[];
  subjects: { id: string; name: string; slug: string }[];
  periodLabel: string;
  hasAnyPracticeInRange: boolean;
}

export function TopicPerformanceSection({
  topics,
  subjects,
  periodLabel,
  hasAnyPracticeInRange,
}: TopicPerformanceSectionProps) {
  const [subject, setSubject] = React.useState<string>("all");
  const [status, setStatus] = React.useState<TopicStatusFilterValue>("all");
  const [sort, setSort] = React.useState<TopicSortKey>("syllabus");
  const [showAll, setShowAll] = React.useState(false);

  const filtered = React.useMemo(
    () => filterAndSortTopicPerformance(topics, { subject, status, sort }),
    [topics, subject, status, sort]
  );

  React.useEffect(() => {
    setShowAll(false);
  }, [subject, status, sort]);

  const visible = showAll ? filtered : filtered.slice(0, TOPIC_DISPLAY_LIMIT);
  const hasFilters = subject !== "all" || status !== "all";

  return (
    <section aria-labelledby="topic-performance-heading">
      <SectionHeader
        title="Topic Performance"
        description={`Per-topic practice and status · ${periodLabel}`}
      />
      <span id="topic-performance-heading" className="sr-only">
        Topic performance
      </span>

      {/* Filters: subject, status, sort */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger aria-label="Filter topics by subject" className="min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">
              All Subjects
            </SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.slug} className="min-h-[44px]">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => setStatus(v as TopicStatusFilterValue)}
        >
          <SelectTrigger aria-label="Filter topics by status" className="min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">
              All Statuses
            </SelectItem>
            {(["not_started", "learning", "learned", "practiced", "revised", "mastered"] as const).map(
              (value) => (
                <SelectItem key={value} value={value} className="min-h-[44px]">
                  {getTopicStatusLabel(value)}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as TopicSortKey)}>
          <SelectTrigger aria-label="Sort topics" className="min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOPIC_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="min-h-[44px]">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3">
        {!hasAnyPracticeInRange ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
            title="No practice in this period"
            description={`Topic metrics appear once questions are attempted. Coverage still shows your all-time topic statuses below each subject.`}
          />
        ) : filtered.length === 0 ? (
          <NoDataPanel
            message={
              hasFilters
                ? "No topics match the selected filters."
                : "No topic data in this period yet."
            }
          />
        ) : (
          <>
            <ul className="space-y-2">
              {visible.map((topic) => (
                <TopicRow key={topic.topicId} topic={topic} />
              ))}
            </ul>
            {!showAll && filtered.length > TOPIC_DISPLAY_LIMIT && (
              <Button
                variant="outline"
                className="mt-3 min-h-[44px] w-full sm:w-auto"
                onClick={() => setShowAll(true)}
              >
                Show all {filtered.length} topics
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function TopicRow({ topic }: { topic: TopicPerformanceAnalytics }) {
  const statusLabel = getTopicStatusLabel(topic.status);
  return (
    <li>
      <Card className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/app/study/${encodeURIComponent(topic.topicId)}`}
            className="inline-flex items-center rounded text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {topic.topicName}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {topic.subjectName} · {topic.chapterName}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="neutral">{statusLabel}</Badge>
            {topic.isWeak && <Badge variant="warning">Below 60% accuracy</Badge>}
            {topic.revisionState === "overdue" && <Badge variant="destructive">Revision overdue</Badge>}
            {topic.revisionState === "due" && <Badge variant="info">Revision due</Badge>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:text-right">
          <div>
            <p className="text-xs text-foreground-subtle">Attempted</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {topic.hasData ? topic.questionsAttempted : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-foreground-subtle">Accuracy</p>
            <p
              className={cn(
                "text-sm font-semibold tabular-nums",
                topic.hasData ? "text-foreground" : "text-foreground-subtle"
              )}
            >
              {topic.hasData ? formatAccuracy(topic.accuracyBps) : "No data"}
            </p>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs text-foreground-subtle">Last practiced</p>
            <p className="text-sm tabular-nums text-foreground-subtle">
              {topic.lastPracticedAt ? formatRelativeDay(topic.lastPracticedAt) : "—"}
            </p>
          </div>
        </div>
      </Card>
    </li>
  );
}
