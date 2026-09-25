import type { NewRevisionItem, RevisionItem, UserTopicProgress } from "@/db/schema";
import type { TopicProgressUpsertInput, TopicStatus } from "./study";
import { getAllTopicsForAttempt } from "./dashboard";

/**
 * Revision domain (Phase 8): spaced review queue, deterministic scheduling
 * and revision completion — pure functions only, no repository access.
 *
 * SCHEDULING MODEL (documented):
 * - The schedule of record for a topic is `revision_items.nextRevisionAt`
 *   falling back to `user_topic_progress.nextRevisionAt` — the same
 *   precedence the Phase 7 topic detail page already uses.
 * - The first revision is scheduled (+1 day) when a topic first enters a
 *   covered preparation status (learned / practiced / revised / mastered).
 *   Until the first completion that schedule lives only on the progress row;
 *   `revision_items` rows are created/updated by completion and carry the
 *   authoritative `revisionNumber`.
 * - Untouched (not_started) topics are never queued: revision emerges from
 *   studying, not from the existence of this page.
 */

// ============================================================================
// 1. SPACED REVIEW INTERVALS (the single source of interval values)
// ============================================================================

/** Days after which revision #N is due. Revisions past the table repeat at 30 days. */
export const REVISION_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;

/** Topics shown per upcoming date group before "Show more" expands the list. */
export const UPCOMING_DISPLAY_LIMIT = 6;

/** Revision history window: completions newer than this stay "recent". */
export const RECENTLY_REVISED_WINDOW_DAYS = 7;

/** Maximum recently revised entries rendered. */
export const RECENTLY_REVISED_DISPLAY_LIMIT = 6;

/**
 * Days until the given revision is due. Deterministic:
 * revision #1 → 1d, #2 → 3d, #3 → 7d, #4 → 14d, #5+ → 30d.
 */
export function getRevisionIntervalDays(revisionNumber: number): number {
  const index = Math.max(1, Math.floor(revisionNumber)) - 1;
  return REVISION_INTERVALS_DAYS[Math.min(index, REVISION_INTERVALS_DAYS.length - 1)];
}

// ============================================================================
// 2. LOCAL DATE HELPERS (calendar-day arithmetic, no timezone abstractions)
// ============================================================================

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function addLocalDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

/** Whole calendar days from `from` to `to` in local time (positive = future). */
export function diffLocalDays(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(to).getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * Coerces persisted timestamps (Date | epoch | ISO string) to Date.
 * Returns null for null/undefined/invalid values so callers never compare
 * raw ISO strings against local dates.
 */
export function toDate(value: Date | number | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ============================================================================
// 3. DUE CLASSIFICATION
// ============================================================================

/** A revision is due when its scheduled time is at or before the end of today. */
export function isRevisionDue(nextRevisionAt: Date, referenceDate: Date = new Date()): boolean {
  const due = toDate(nextRevisionAt);
  return due !== null && due.getTime() <= endOfLocalDay(referenceDate).getTime();
}

/** A revision is overdue when its scheduled time is before the start of today. */
export function isRevisionOverdue(nextRevisionAt: Date, referenceDate: Date = new Date()): boolean {
  const due = toDate(nextRevisionAt);
  return due !== null && due.getTime() < startOfLocalDay(referenceDate).getTime();
}

export type RevisionBucket = "overdue" | "due" | "upcoming";

/** Mutually exclusive bucket for an eligible revision (overdue wins over due). */
export function classifyRevision(nextRevisionAt: Date, referenceDate: Date = new Date()): RevisionBucket {
  const due = toDate(nextRevisionAt)!;
  if (due.getTime() < startOfLocalDay(referenceDate).getTime()) return "overdue";
  if (due.getTime() <= endOfLocalDay(referenceDate).getTime()) return "due";
  return "upcoming";
}

// ============================================================================
// 4. SCHEDULING
// ============================================================================

/**
 * Next revision date for a topic whose revision #`completedNumber` was just
 * completed at `at`. Anchored to local midnight so due dates are clean
 * calendar days regardless of the time of day the revision happened.
 */
export function calculateNextRevisionDate(completedRevisionNumber: number, at: Date = new Date()): Date {
  const nextNumber = completedRevisionNumber + 1;
  return addLocalDays(startOfLocalDay(at), getRevisionIntervalDays(nextNumber));
}

/** First-revision date for a topic that just entered a covered status. */
export function scheduleFirstRevisionDate(at: Date = new Date()): Date {
  return addLocalDays(startOfLocalDay(at), getRevisionIntervalDays(1));
}

// ============================================================================
// 5. ELIGIBILITY
// ============================================================================

/** Preparation states from which spaced review emerges naturally. */
const REVISION_ELIGIBLE_STATUSES = new Set<TopicStatus>([
  "learning",
  "learned",
  "practiced",
  "revised",
  "mastered",
]);

export function isRevisionEligible(
  status: TopicStatus,
  nextRevisionAt: Date | null,
  revisionItem?: RevisionItem | null
): boolean {
  if (!REVISION_ELIGIBLE_STATUSES.has(status)) return false;
  if (!nextRevisionAt) return false;
  if (revisionItem && revisionItem.status !== "scheduled") return false;
  return true;
}

// ============================================================================
// 6. REVISION QUEUE
// ============================================================================

export interface RevisionQueueEntry {
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  status: TopicStatus;
  bucket: RevisionBucket;
  nextRevisionAt: Date;
  /** Currently scheduled revision number (1 = first revision). */
  revisionNumber: number;
  /** Calendar days the schedule is in the past; 0 for due-today items. */
  overdueDays: number;
  /** Calendar days until the schedule is due; 0 for today. */
  dueInDays: number;
  lastRevisedAt: Date | null;
  lastStudiedAt: Date | null;
}

export interface RecentlyRevisedEntry {
  topicId: string;
  topicName: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  lastRevisedAt: Date;
  /** Number of revisions completed (item revisionNumber - 1 when known). */
  completedRevisions: number | null;
}

export interface RevisionSummary {
  dueToday: number;
  overdue: number;
  upcoming: number;
  recentlyRevised: number;
}

export interface RevisionQueue {
  dueToday: RevisionQueueEntry[];
  overdue: RevisionQueueEntry[];
  upcoming: RevisionQueueEntry[];
  recentlyRevised: RecentlyRevisedEntry[];
  summary: RevisionSummary;
}

export interface RevisionQueueInput {
  examAttemptId: string;
  progressList: UserTopicProgress[];
  revisionItems: RevisionItem[];
  referenceDate?: Date;
}

/**
 * Builds the full revision queue in one pass over the canonical syllabus —
 * never per-topic queries, never database row order. Sorting is
 * deterministic: date first, canonical syllabus order as the tiebreaker.
 */
export function getRevisionQueue(input: RevisionQueueInput): RevisionQueue {
  const referenceDate = input.referenceDate ?? new Date();
  const canonical = getAllTopicsForAttempt(input.examAttemptId);
  const canonicalIndex = new Map<string, number>(canonical.map((t, i) => [t.topicId, i]));
  const progressByTopic = new Map(input.progressList.map((p) => [p.topicId, p]));
  const revisionByTopic = new Map(input.revisionItems.map((r) => [r.topicId, r]));

  const dueToday: RevisionQueueEntry[] = [];
  const overdue: RevisionQueueEntry[] = [];
  const upcoming: RevisionQueueEntry[] = [];
  const recentlyRevised: RecentlyRevisedEntry[] = [];

  const recentCutoff = addLocalDays(startOfLocalDay(referenceDate), -RECENTLY_REVISED_WINDOW_DAYS).getTime();

  for (const meta of canonical) {
    const progress = progressByTopic.get(meta.topicId);
    const item = revisionByTopic.get(meta.topicId);
    const status: TopicStatus = progress?.status ?? "not_started";

    const nextRevisionAt = toDate(item?.nextRevisionAt ?? progress?.nextRevisionAt ?? null);
    if (isRevisionEligible(status, nextRevisionAt, item ?? null) && nextRevisionAt) {
      const bucket = classifyRevision(nextRevisionAt, referenceDate);
      const entry: RevisionQueueEntry = {
        topicId: meta.topicId,
        topicName: meta.topicName,
        chapterId: meta.chapterId,
        chapterName: meta.chapterName,
        subjectId: meta.subjectId,
        subjectName: meta.subjectName,
        subjectSlug: meta.subjectSlug,
        status,
        bucket,
        nextRevisionAt,
        revisionNumber: item?.revisionNumber ?? 1,
        overdueDays: Math.max(0, diffLocalDays(nextRevisionAt, referenceDate)),
        dueInDays: Math.max(0, diffLocalDays(referenceDate, nextRevisionAt)),
        lastRevisedAt: toDate(item?.lastRevisedAt ?? progress?.lastRevisedAt ?? null),
        lastStudiedAt: toDate(progress?.lastStudiedAt ?? null),
      };
      if (bucket === "overdue") overdue.push(entry);
      else if (bucket === "due") dueToday.push(entry);
      else upcoming.push(entry);
    }

    const lastRevisedAt = toDate(item?.lastRevisedAt ?? progress?.lastRevisedAt ?? null);
    if (lastRevisedAt && lastRevisedAt.getTime() >= recentCutoff) {
      recentlyRevised.push({
        topicId: meta.topicId,
        topicName: meta.topicName,
        chapterName: meta.chapterName,
        subjectId: meta.subjectId,
        subjectName: meta.subjectName,
        subjectSlug: meta.subjectSlug,
        lastRevisedAt,
        completedRevisions: item ? Math.max(0, item.revisionNumber - 1) : null,
      });
    }
  }

  const byDateAscending = (a: RevisionQueueEntry, b: RevisionQueueEntry) =>
    a.nextRevisionAt.getTime() - b.nextRevisionAt.getTime() ||
    (canonicalIndex.get(a.topicId) ?? 0) - (canonicalIndex.get(b.topicId) ?? 0);

  dueToday.sort(byDateAscending);
  // Oldest schedule first: the most-overdue topic leads.
  overdue.sort(byDateAscending);
  // Nearest date first.
  upcoming.sort(byDateAscending);
  recentlyRevised.sort(
    (a, b) =>
      b.lastRevisedAt.getTime() - a.lastRevisedAt.getTime() ||
      (canonicalIndex.get(a.topicId) ?? 0) - (canonicalIndex.get(b.topicId) ?? 0)
  );

  return {
    dueToday,
    overdue,
    upcoming,
    recentlyRevised,
    summary: {
      dueToday: dueToday.length,
      overdue: overdue.length,
      upcoming: upcoming.length,
      recentlyRevised: recentlyRevised.length,
    },
  };
}

/** Convenience subsets matching the queue buckets. */
export function getDueRevisions(input: RevisionQueueInput): RevisionQueueEntry[] {
  return getRevisionQueue(input).dueToday;
}

export function getOverdueRevisions(input: RevisionQueueInput): RevisionQueueEntry[] {
  return getRevisionQueue(input).overdue;
}

export function getUpcomingRevisions(input: RevisionQueueInput): RevisionQueueEntry[] {
  return getRevisionQueue(input).upcoming;
}

export function getRecentlyRevised(input: RevisionQueueInput): RecentlyRevisedEntry[] {
  return getRevisionQueue(input).recentlyRevised;
}

export function getRevisionSummary(input: RevisionQueueInput): RevisionSummary {
  return getRevisionQueue(input).summary;
}

// ============================================================================
// 7. QUEUE FILTERS
// ============================================================================

export type RevisionStatusFilter = "all" | "due" | "overdue" | "upcoming";
export type RevisionSubjectFilter = "all" | string; // "all" or a subject slug

export interface RevisionQueueFilters {
  status?: RevisionStatusFilter;
  /** Canonical subject slug ("physics" / "chemistry" / "biology"). */
  subject?: RevisionSubjectFilter;
}

function matchesSubject(entry: { subjectSlug: string }, subject: RevisionSubjectFilter): boolean {
  return subject === "all" || entry.subjectSlug === subject;
}

/** Combined status + subject filtering over an already-built queue. */
export function filterRevisionQueue(
  queue: RevisionQueue,
  filters: RevisionQueueFilters
): RevisionQueue {
  const status = filters.status ?? "all";
  const subject = filters.subject ?? "all";
  if (status === "all" && subject === "all") return queue;

  const keep = status === "all";
  const filterEntries = <T extends { subjectSlug: string }>(entries: T[]): T[] =>
    entries.filter((e) => matchesSubject(e, subject));

  return {
    dueToday: keep || status === "due" ? filterEntries(queue.dueToday) : [],
    overdue: keep || status === "overdue" ? filterEntries(queue.overdue) : [],
    upcoming: keep || status === "upcoming" ? filterEntries(queue.upcoming) : [],
    recentlyRevised: filterEntries(queue.recentlyRevised),
    summary: queue.summary,
  };
}

// ============================================================================
// 8. REVISION COMPLETION
// ============================================================================

export type RevisionItemUpsertInput = Omit<NewRevisionItem, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export interface RevisionCompletionInput {
  workspaceId: string;
  topicId: string;
  existingProgress: UserTopicProgress | null;
  existingRevisionItem: RevisionItem | null;
  at?: Date;
}

export interface RevisionCompletionResult {
  progress: TopicProgressUpsertInput;
  revisionItem: RevisionItemUpsertInput;
  /** Number of the revision that was completed. */
  completedRevisionNumber: number;
  /** Number now scheduled. */
  nextRevisionNumber: number;
  nextRevisionAt: Date;
  /** Days until the next review — used for success feedback copy. */
  nextIntervalDays: number;
}

/**
 * Deterministic fallback when no revision_items row exists to carry the
 * historical count: a recorded revision timestamp means at least one earlier
 * revision happened, so the one being completed is #2; otherwise #1.
 * Limitation (accepted): pre-Phase-8 progress-only data cannot express more
 * than two revisions; from the first Phase 8 completion onward the count is
 * exact because it lives in `revision_items.revisionNumber`.
 */
export function resolveCompletedRevisionNumber(
  existingRevisionItem: RevisionItem | null,
  existingProgress: UserTopicProgress | null
): number {
  if (existingRevisionItem) return Math.max(1, existingRevisionItem.revisionNumber);
  const hasPriorRevision = Boolean(
    toDate(existingProgress?.lastRevisedAt) || toDate(existingProgress?.revisedAt)
  );
  return hasPriorRevision ? 2 : 1;
}

// Preparation states can only move forward when a revision completes:
// mastered stays mastered, everything below "revised" becomes "revised".
const STATUS_RANK: Record<TopicStatus, number> = {
  not_started: 0,
  learning: 1,
  learned: 2,
  practiced: 3,
  revised: 4,
  mastered: 5,
};

/**
 * Produces both persistence payloads for "Mark as Revised":
 * - progress: revision timestamps stamped, next revision date persisted,
 *   status advanced to "revised" without ever demoting stronger states.
 * - revisionItem: revisionNumber advanced, lastRevisedAt stamped, the next
 *   revision scheduled, kept in "scheduled" state.
 */
export function applyRevisionCompletion(
  input: RevisionCompletionInput,
  at: Date = new Date()
): RevisionCompletionResult {
  const { workspaceId, topicId, existingProgress, existingRevisionItem } = input;

  const completedRevisionNumber = resolveCompletedRevisionNumber(existingRevisionItem, existingProgress);
  const nextRevisionNumber = completedRevisionNumber + 1;
  const nextIntervalDays = getRevisionIntervalDays(nextRevisionNumber);
  const nextRevisionAt = addLocalDays(startOfLocalDay(at), nextIntervalDays);

  const currentStatus: TopicStatus = existingProgress?.status ?? "not_started";
  const nextStatus: TopicStatus =
    STATUS_RANK[currentStatus] >= STATUS_RANK.revised ? currentStatus : "revised";

  const progress: TopicProgressUpsertInput = {
    id: existingProgress?.id,
    workspaceId,
    topicId,
    status: nextStatus,
    startedAt: existingProgress?.startedAt ?? at,
    learnedAt: existingProgress?.learnedAt ?? null,
    practicedAt: existingProgress?.practicedAt ?? null,
    revisedAt: at,
    masteredAt: existingProgress?.masteredAt ?? null,
    practiceAttempts: existingProgress?.practiceAttempts ?? 0,
    correctAnswers: existingProgress?.correctAnswers ?? 0,
    incorrectAnswers: existingProgress?.incorrectAnswers ?? 0,
    accuracy: existingProgress?.accuracy ?? 0,
    lastStudiedAt: existingProgress?.lastStudiedAt ?? null,
    lastRevisedAt: at,
    nextRevisionAt,
    notes: existingProgress?.notes ?? null,
    createdAt: existingProgress?.createdAt ?? at,
  };

  const revisionItem: RevisionItemUpsertInput = {
    id: existingRevisionItem?.id,
    workspaceId,
    topicId,
    revisionNumber: nextRevisionNumber,
    lastRevisedAt: at,
    nextRevisionAt,
    status: "scheduled",
    createdAt: existingRevisionItem?.createdAt ?? at,
  };

  return {
    progress,
    revisionItem,
    completedRevisionNumber,
    nextRevisionNumber,
    nextRevisionAt,
    nextIntervalDays,
  };
}

// ============================================================================
// 9. STATUS-CHANGE SCHEDULING (hook used by the Phase 7 status model)
// ============================================================================

/**
 * Next revision date implied by a preparation status change:
 * - entering a covered status schedules revision #1 (+1 day) when no
 *   schedule exists yet; an existing schedule is preserved, never doubled;
 * - picking "revised" is an explicit revision act: it schedules the next
 *   interval (deterministic baseline when no revision_items row exists);
 * - reset to not_started clears the schedule (existing Phase 7 behaviour).
 */
export function scheduleRevisionForStatusChange(
  nextStatus: TopicStatus,
  existingNextRevisionAt: Date | null,
  hasPriorRevision: boolean,
  at: Date = new Date()
): Date | null {
  switch (nextStatus) {
    case "not_started":
      return null;
    case "revised": {
      // An explicit revision act always advances the schedule; preserving a
      // stale date would keep a just-revised topic stuck in the queue.
      const completed = hasPriorRevision ? 2 : 1;
      return calculateNextRevisionDate(completed, at);
    }
    case "learned":
    case "practiced":
    case "mastered":
      return existingNextRevisionAt ?? scheduleFirstRevisionDate(at);
    default:
      return existingNextRevisionAt;
  }
}
