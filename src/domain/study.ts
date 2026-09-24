import type {
  NewStudySession,
  NewUserTopicProgress,
  StudySession,
  UserTopicProgress,
} from "@/db/schema";
import { COVERED_STATUSES, getAllTopicsForAttempt } from "./dashboard";

/**
 * Study module domain logic (Phase 7).
 *
 * All syllabus navigation, progress calculation, search/filter and
 * study-session rules live here as pure functions so UI components
 * only render results and handle interactions.
 *
 * PROGRESS DEFINITION (documented, count-based):
 * A topic is "covered" when its status is one of COVERED_TOPIC_STATUSES
 * (learned / practiced / revised / mastered) — the exact set the Phase 6
 * dashboard already uses. Progress is always `covered topics ÷ total topics`.
 * There is no weighted scoring.
 */

export type TopicStatus = UserTopicProgress["status"];
export type TopicStatusFilter = TopicStatus | "all";

/**
 * Insert payloads for user-created rows. `id`, `createdAt` and `updatedAt`
 * are always optional: every repository generates them when absent, so
 * callers (domain, API) never need to fabricate identity fields.
 */
export type TopicProgressUpsertInput = Omit<
  NewUserTopicProgress,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type StudySessionCreateInput = Omit<
  NewStudySession,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

/** Covered preparation states — kept identical to the dashboard aggregation. */
export const COVERED_TOPIC_STATUSES = COVERED_STATUSES;

export function isTopicCovered(status: TopicStatus): boolean {
  return COVERED_TOPIC_STATUSES.has(status);
}

// ============================================================================
// 1. STATUS MODEL
// ============================================================================

export const TOPIC_STATUS_OPTIONS: { value: TopicStatus; label: string; hint: string }[] = [
  { value: "not_started", label: "Not Started", hint: "Reset preparation state" },
  { value: "learning", label: "Learning", hint: "Currently studying" },
  { value: "learned", label: "Learned", hint: "Concept understood" },
  { value: "practiced", label: "Practiced", hint: "Questions solved" },
  { value: "revised", label: "Revised", hint: "Revised at least once" },
  { value: "mastered", label: "Mastered", hint: "Fully confident" },
];

const STATUS_LABELS: Record<TopicStatus, string> = {
  not_started: "Not Started",
  learning: "Learning",
  learned: "Learned",
  practiced: "Practiced",
  revised: "Revised",
  mastered: "Mastered",
};

export function getTopicStatusLabel(status: TopicStatus): string {
  return STATUS_LABELS[status] ?? STATUS_LABELS.not_started;
}

// ============================================================================
// 2. SYLLABUS TREE (canonical seed taxonomy, no DB access)
// ============================================================================

export interface StudyTopicNode {
  topicId: string;
  name: string;
  slug: string;
}

export interface StudyChapterNode {
  chapterId: string;
  name: string;
  slug: string;
  topics: StudyTopicNode[];
}

export interface StudySubjectNode {
  subjectId: string;
  name: string;
  slug: string;
  chapters: StudyChapterNode[];
}

const syllabusTreeCache = new Map<string, StudySubjectNode[]>();

/**
 * Builds (and caches) the subject → chapter → topic tree for an exam attempt
 * from the canonical seed taxonomy — a single in-memory structure, never a
 * per-topic fetch.
 */
export function getSyllabusTree(examAttemptId: string): StudySubjectNode[] {
  const cached = syllabusTreeCache.get(examAttemptId);
  if (cached) return cached;

  const subjects: StudySubjectNode[] = [];
  for (const topic of getAllTopicsForAttempt(examAttemptId)) {
    let subject = subjects.find((s) => s.subjectId === topic.subjectId);
    if (!subject) {
      subject = { subjectId: topic.subjectId, name: topic.subjectName, slug: topic.subjectSlug, chapters: [] };
      subjects.push(subject);
    }
    let chapter = subject.chapters.find((c) => c.chapterId === topic.chapterId);
    if (!chapter) {
      // Canonical chapter IDs are `${subjectId}_${chapterSlug}` — recover the slug
      const chapterSlug = topic.chapterId.slice(subject.subjectId.length + 1);
      chapter = { chapterId: topic.chapterId, name: topic.chapterName, slug: chapterSlug, topics: [] };
      subject.chapters.push(chapter);
    }
    chapter.topics.push({ topicId: topic.topicId, name: topic.topicName, slug: topic.topicSlug });
  }

  syllabusTreeCache.set(examAttemptId, subjects);
  return subjects;
}

export type ProgressIndex = Map<string, UserTopicProgress>;

export function buildProgressIndex(progressList: UserTopicProgress[]): ProgressIndex {
  return new Map(progressList.map((p) => [p.topicId, p]));
}

/**
 * Effective status of a topic. Topics without a stored progress row are
 * implicitly "not_started" — the schema default.
 */
export function getEffectiveTopicStatus(index: ProgressIndex, topicId: string): TopicStatus {
  return index.get(topicId)?.status ?? "not_started";
}

// ============================================================================
// 3. PROGRESS CALCULATION (count-based, no weighting)
// ============================================================================

export interface TopicStatusCounts {
  total: number;
  notStarted: number;
  learning: number;
  learned: number;
  practiced: number;
  revised: number;
  mastered: number;
  /** Topics in a covered state (learned / practiced / revised / mastered). */
  covered: number;
}

export function getTopicStatusCounts(topicIds: string[], index: ProgressIndex): TopicStatusCounts {
  const counts: TopicStatusCounts = {
    total: topicIds.length,
    notStarted: 0,
    learning: 0,
    learned: 0,
    practiced: 0,
    revised: 0,
    mastered: 0,
    covered: 0,
  };

  for (const topicId of topicIds) {
    const status = getEffectiveTopicStatus(index, topicId);
    if (status === "not_started") counts.notStarted++;
    else if (status === "learning") counts.learning++;
    else if (status === "learned") counts.learned++;
    else if (status === "practiced") counts.practiced++;
    else if (status === "revised") counts.revised++;
    else if (status === "mastered") counts.mastered++;
    if (isTopicCovered(status)) counts.covered++;
  }

  return counts;
}

export type DerivedChapterStatus = "not_started" | "in_progress" | "completed";

/**
 * Deterministic chapter state derived purely from its topics:
 * - completed:  every topic is in a covered state
 * - in_progress: at least one topic is learning or covered
 * - not_started: no topic has any progress
 */
export function deriveChapterStatus(
  totalTopics: number,
  coveredTopics: number,
  learningTopics: number
): DerivedChapterStatus {
  if (totalTopics > 0 && coveredTopics === totalTopics) return "completed";
  if (coveredTopics > 0 || learningTopics > 0) return "in_progress";
  return "not_started";
}

export interface StudySectionProgress extends TopicStatusCounts {
  percentage: number;
  status: DerivedChapterStatus;
}

function computeSectionProgress(topicIds: string[], index: ProgressIndex): StudySectionProgress {
  const counts = getTopicStatusCounts(topicIds, index);
  const percentage = counts.total > 0 ? Math.round((counts.covered / counts.total) * 100) : 0;
  return {
    ...counts,
    percentage,
    status: deriveChapterStatus(counts.total, counts.covered, counts.learning),
  };
}

export function getChapterProgress(chapter: StudyChapterNode, index: ProgressIndex): StudySectionProgress {
  return computeSectionProgress(chapter.topics.map((t) => t.topicId), index);
}

export function getSubjectProgress(subject: StudySubjectNode, index: ProgressIndex): StudySectionProgress {
  const topicIds = subject.chapters.flatMap((c) => c.topics.map((t) => t.topicId));
  return computeSectionProgress(topicIds, index);
}

export interface StudyOverview {
  totalTopics: number;
  /** Topics in a covered state (learned / practiced / revised / mastered). */
  completedTopics: number;
  learningTopics: number;
  /** Topics still untouched (implicit or explicit not_started). */
  remainingTopics: number;
  percentage: number;
}

export function getStudyOverview(subjects: StudySubjectNode[], index: ProgressIndex): StudyOverview {
  const topicIds = subjects.flatMap((s) => s.chapters.flatMap((c) => c.topics.map((t) => t.topicId)));
  const counts = getTopicStatusCounts(topicIds, index);
  return {
    totalTopics: counts.total,
    completedTopics: counts.covered,
    learningTopics: counts.learning,
    remainingTopics: counts.notStarted,
    percentage: counts.total > 0 ? Math.round((counts.covered / counts.total) * 100) : 0,
  };
}

/**
 * Next suggested topic inside a subject: the first untouched topic in
 * canonical order, otherwise the first topic still being learned.
 */
export interface NextStudyTarget {
  topic: StudyTopicNode;
  chapterName: string;
  reason: "not_started" | "learning";
}

export function getNextStudyTarget(
  chapters: StudyChapterNode[],
  index: ProgressIndex
): NextStudyTarget | null {
  let firstLearning: NextStudyTarget | null = null;
  for (const chapter of chapters) {
    for (const topic of chapter.topics) {
      const status = getEffectiveTopicStatus(index, topic.topicId);
      if (status === "not_started") {
        return { topic, chapterName: chapter.name, reason: "not_started" };
      }
      if (status === "learning" && !firstLearning) {
        firstLearning = { topic, chapterName: chapter.name, reason: "learning" };
      }
    }
  }
  return firstLearning;
}

// ============================================================================
// 4. SEARCH + STATUS FILTER (client-side against loaded syllabus)
// ============================================================================

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export interface FilteredChapter extends StudyChapterNode {
  /** Effective status per topicId for convenient rendering. */
  topicStatuses: Map<string, TopicStatus>;
}

/**
 * Combined search + status filter over one subject.
 *
 * - Search is a case-insensitive substring match on topic OR chapter names.
 *   A chapter-name match keeps all of the chapter's topics visible.
 * - A status filter keeps only topics whose effective status matches
 *   ("all" keeps everything; "not_started" includes implicit rows).
 * - Chapters left with zero visible topics are dropped.
 */
export function searchAndFilterSubject(
  subject: StudySubjectNode,
  query: string,
  statusFilter: TopicStatusFilter,
  index: ProgressIndex
): FilteredChapter[] {
  const q = normalizeQuery(query);
  const filtering = q.length > 0 || statusFilter !== "all";

  if (!filtering) {
    return subject.chapters.map((chapter) => ({
      ...chapter,
      topicStatuses: new Map(chapter.topics.map((t) => [t.topicId, getEffectiveTopicStatus(index, t.topicId)])),
    }));
  }

  const result: FilteredChapter[] = [];
  for (const chapter of subject.chapters) {
    const chapterMatches = q.length > 0 && chapter.name.toLowerCase().includes(q);
    const matched = chapter.topics.filter((topic) => {
      const matchesQuery = q.length === 0 || chapterMatches || topic.name.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || getEffectiveTopicStatus(index, topic.topicId) === statusFilter;
      return matchesQuery && matchesStatus;
    });

    if (matched.length === 0) continue;
    result.push({
      ...chapter,
      topics: matched,
      topicStatuses: new Map(matched.map((t) => [t.topicId, getEffectiveTopicStatus(index, t.topicId)])),
    });
  }
  return result;
}

export function hasActiveStudyFilters(query: string, statusFilter: TopicStatusFilter): boolean {
  return normalizeQuery(query).length > 0 || statusFilter !== "all";
}

// ============================================================================
// 5. TOPIC STATUS UPDATES
// ============================================================================

export interface TopicStatusChangeInput {
  workspaceId: string;
  topicId: string;
  status: TopicStatus;
  existing?: UserTopicProgress | null;
}

/**
 * Produces the upsert payload for a status change, preserving untouched
 * fields from the existing row and stamping the milestone timestamps that
 * match the new status. Resetting to "not_started" clears preparation
 * timestamps but keeps factual practice statistics.
 */
export function applyTopicStatusChange(
  input: TopicStatusChangeInput,
  at: Date = new Date()
): TopicProgressUpsertInput {
  const { workspaceId, topicId, status, existing } = input;

  const base: TopicProgressUpsertInput = {
    id: existing?.id,
    workspaceId,
    topicId,
    status,
    startedAt: existing?.startedAt ?? null,
    learnedAt: existing?.learnedAt ?? null,
    practicedAt: existing?.practicedAt ?? null,
    revisedAt: existing?.revisedAt ?? null,
    masteredAt: existing?.masteredAt ?? null,
    practiceAttempts: existing?.practiceAttempts ?? 0,
    correctAnswers: existing?.correctAnswers ?? 0,
    incorrectAnswers: existing?.incorrectAnswers ?? 0,
    accuracy: existing?.accuracy ?? 0,
    lastStudiedAt: existing?.lastStudiedAt ?? null,
    lastRevisedAt: existing?.lastRevisedAt ?? null,
    nextRevisionAt: existing?.nextRevisionAt ?? null,
    notes: existing?.notes ?? null,
    createdAt: existing?.createdAt ?? at,
  };

  switch (status) {
    case "not_started":
      return {
        ...base,
        startedAt: null,
        learnedAt: null,
        practicedAt: null,
        revisedAt: null,
        masteredAt: null,
        lastStudiedAt: null,
        lastRevisedAt: null,
        nextRevisionAt: null,
      };
    case "learning":
      return { ...base, startedAt: base.startedAt ?? at, lastStudiedAt: at };
    case "learned":
      return { ...base, startedAt: base.startedAt ?? at, learnedAt: at, lastStudiedAt: at };
    case "practiced":
      return { ...base, startedAt: base.startedAt ?? at, practicedAt: at, lastStudiedAt: at };
    case "revised":
      return { ...base, startedAt: base.startedAt ?? at, revisedAt: at, lastRevisedAt: at };
    case "mastered":
      return { ...base, startedAt: base.startedAt ?? at, masteredAt: at, lastStudiedAt: at };
  }
}

// ============================================================================
// 6. STUDY SESSIONS
// ============================================================================

export const SESSION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "focused", label: "Focused study" },
  { value: "revision", label: "Revision" },
  { value: "practice", label: "Practice" },
];

/**
 * Duration of a recorded session in whole minutes. Sub-minute sessions
 * still count as one minute so short reviews are never lost.
 */
export function computeSessionDurationMinutes(startedAt: Date, endedAt: Date): number {
  const ms = endedAt.getTime() - startedAt.getTime();
  if (ms <= 0) return 1;
  return Math.max(1, Math.round(ms / 60000));
}

export function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = hours === 1 ? "hr" : "hrs";
  return rest > 0 ? `${hours} ${hourLabel} ${rest} min` : `${hours} ${hourLabel}`;
}

/** Live timer display as HH:MM:SS. */
export function formatTimerDuration(elapsedSeconds: number): string {
  const safe = Math.max(0, Math.floor(elapsedSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

export interface StudyDaySummary {
  /** ISO calendar day (yyyy-mm-dd). */
  key: string;
  label: string;
  minutes: number;
  sessions: number;
}

function formatDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(d: Date, refDate: Date): string {
  const refKey = formatDayKey(refDate);
  const dayKey = formatDayKey(d);
  if (dayKey === refKey) return "Today";
  const yesterday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 1);
  if (dayKey === formatDayKey(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Groups a topic's study sessions by calendar day, most recent first.
 */
export function summarizeRecentStudy(
  sessions: StudySession[],
  referenceDate: Date = new Date(),
  dayLimit: number = 7
): StudyDaySummary[] {
  const byDay = new Map<string, { date: Date; minutes: number; sessions: number }>();
  for (const session of sessions) {
    const date = session.startedAt instanceof Date ? session.startedAt : new Date(session.startedAt);
    if (isNaN(date.getTime())) continue;
    const key = formatDayKey(date);
    const entry = byDay.get(key) ?? { date, minutes: 0, sessions: 0 };
    entry.minutes += session.durationMinutes || 0;
    entry.sessions += 1;
    byDay.set(key, entry);
  }

  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, dayLimit)
    .map(([key, entry]) => ({
      key,
      label: formatDayLabel(entry.date, referenceDate),
      minutes: entry.minutes,
      sessions: entry.sessions,
    }));
}

/**
 * Progress patch after a recorded study session: refreshes lastStudiedAt
 * (and startedAt when this is the first activity) without ever changing
 * the topic's preparation status.
 */
export function applyStudySessionToProgress(
  input: { workspaceId: string; topicId: string; existing?: UserTopicProgress | null },
  at: Date = new Date()
): TopicProgressUpsertInput {
  const { workspaceId, topicId, existing } = input;
  return {
    id: existing?.id,
    workspaceId,
    topicId,
    status: existing?.status ?? "not_started",
    startedAt: existing?.startedAt ?? at,
    learnedAt: existing?.learnedAt ?? null,
    practicedAt: existing?.practicedAt ?? null,
    revisedAt: existing?.revisedAt ?? null,
    masteredAt: existing?.masteredAt ?? null,
    practiceAttempts: existing?.practiceAttempts ?? 0,
    correctAnswers: existing?.correctAnswers ?? 0,
    incorrectAnswers: existing?.incorrectAnswers ?? 0,
    accuracy: existing?.accuracy ?? 0,
    lastStudiedAt: at,
    lastRevisedAt: existing?.lastRevisedAt ?? null,
    nextRevisionAt: existing?.nextRevisionAt ?? null,
    notes: existing?.notes ?? null,
    createdAt: existing?.createdAt ?? at,
  };
}
