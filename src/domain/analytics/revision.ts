import type { RevisionItem, UserTopicProgress } from "@/db/schema";
import {
  getRevisionQueue,
  toDate,
  type RecentlyRevisedEntry,
} from "@/domain/revision";
import type { AnalyticsRangeWindow } from "./types";
import { isDateInRange } from "./types";
import { generateBuckets, bucketIndexForDate } from "./trends";

/**
 * Revision activity (Section 8).
 *
 * Queue counts reuse the Phase 8 scheduling domain verbatim
 * (`getRevisionQueue`) — analytics never reclassifies due/overdue state or
 * touches the spaced-repetition algorithm. Completion counts come from the
 * recorded `lastRevisedAt` timestamps on `revision_items` (falling back to
 * progress rows for pre-Phase-8 data), deduplicated per topic.
 */

export interface RevisionActivityBucket {
  key: string;
  label: string;
  /** Topics with a revision completion recorded in this bucket. */
  topicsRevised: number;
  hasActivity: boolean;
}

export interface RevisionActivityAnalytics {
  dueToday: number;
  overdue: number;
  upcoming: number;
  /** Phase 8 "recently revised" window (7 days). */
  recentlyRevised: RecentlyRevisedEntry[];
  /** Distinct topics with a revision completed inside the selected window. */
  completionsInRange: number;
  /** Completed revisions per bucket across the window. */
  series: RevisionActivityBucket[];
}

export function buildRevisionAnalytics(
  examAttemptId: string,
  progressList: UserTopicProgress[],
  revisionItems: RevisionItem[],
  window: AnalyticsRangeWindow
): RevisionActivityAnalytics {
  const queue = getRevisionQueue({
    examAttemptId,
    progressList,
    revisionItems,
    referenceDate: window.referenceDate,
  });

  // Latest completion timestamp per topic: revision_items are the schedule
  // of record; progress rows cover topics revised before their first
  // revision_items row existed.
  const lastRevisedByTopic = new Map<string, Date>();
  for (const progress of progressList) {
    const date = toDate(progress.lastRevisedAt ?? progress.revisedAt ?? null);
    if (date) lastRevisedByTopic.set(progress.topicId, date);
  }
  for (const item of revisionItems) {
    const date = toDate(item.lastRevisedAt ?? null);
    if (date) lastRevisedByTopic.set(item.topicId, date);
  }

  const completions = [...lastRevisedByTopic.entries()].filter(([, date]) =>
    isDateInRange(date, window)
  );

  const baseBuckets = generateBuckets(
    window,
    completions.length > 0
      ? completions.reduce<Date | null>(
          (earliest, [, date]) => (earliest === null || date.getTime() < earliest.getTime() ? date : earliest),
          null
        )
      : null
  );

  const buckets: RevisionActivityBucket[] = baseBuckets.map((b) => ({
    key: b.key,
    label: b.label,
    topicsRevised: 0,
    hasActivity: false,
  }));

  for (const [, date] of completions) {
    const index = bucketIndexForDate(date, baseBuckets, window);
    if (index === -1) continue;
    buckets[index].topicsRevised += 1;
  }
  for (const bucket of buckets) {
    bucket.hasActivity = bucket.topicsRevised > 0;
  }

  return {
    dueToday: queue.summary.dueToday,
    overdue: queue.summary.overdue,
    upcoming: queue.summary.upcoming,
    recentlyRevised: queue.recentlyRevised,
    completionsInRange: completions.length,
    series: buckets,
  };
}
