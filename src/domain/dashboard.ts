import { neetSeedData } from "@/db/seeds/data/neet";
import type { SeedExamData } from "@/db/seeds/data/neet";
import type {
  UserTopicProgress,
  PlannerTask,
  StudySession,
  RevisionItem,
  PracticeSession,
  MockTest,
  UserPreferences,
  UserWorkspace,
} from "@/db/schema";
import type { DomainRepositories } from "@/repositories/interfaces";
import type { MockTestDetail, MockTestResultDetail } from "./mock-engine/types";
import { getExamAttempt, getExamForAttempt } from "./exam-catalog";
import { formatStudyGoal, getPreparationStageLabel } from "./preparation";
import { PRACTICE_WEAK_ACCURACY_BPS } from "./practice";

const SEEDED_EXAM_DATASETS: SeedExamData[] = [neetSeedData];

// ============================================================================
// 1. EXAM COUNTDOWN
// ============================================================================

export interface ExamCountdown {
  daysRemaining: number | null;
  status: "future" | "today" | "past" | "tba";
  label: string;
}

/**
 * Calculates exam countdown without negative numbers for past exams.
 * Accurately compares calendar days based on local dates.
 */
export function calculateExamCountdown(
  examDate: Date | null | undefined,
  referenceDate: Date = new Date()
): ExamCountdown {
  if (!examDate) {
    return {
      daysRemaining: null,
      status: "tba",
      label: "Date to be announced",
    };
  }

  const dExam = examDate instanceof Date ? examDate : new Date(examDate);
  const dRef = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  if (isNaN(dExam.getTime()) || isNaN(dRef.getTime())) {
    return {
      daysRemaining: null,
      status: "tba",
      label: "Date to be announced",
    };
  }

  const refMidnight = new Date(dRef.getFullYear(), dRef.getMonth(), dRef.getDate()).getTime();
  const examMidnight = new Date(dExam.getFullYear(), dExam.getMonth(), dExam.getDate()).getTime();
  const diffDays = Math.round((examMidnight - refMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return {
      daysRemaining: diffDays,
      status: "future",
      label: `${diffDays} ${diffDays === 1 ? "day" : "days"} remaining`,
    };
  } else if (diffDays === 0) {
    return {
      daysRemaining: 0,
      status: "today",
      label: "Exam is today",
    };
  } else {
    return {
      daysRemaining: 0,
      status: "past",
      label: "Exam completed",
    };
  }
}

// ============================================================================
// 2. TAXONOMY RESOLUTION
// ============================================================================

/**
 * Phase 7 Study integration: topic-aware actions land directly on the
 * topic detail page; generic actions fall back to the syllabus navigator.
 */
function topicStudyHref(topicId?: string): string {
  return topicId ? `/app/study/${topicId}` : "/app/study";
}

export function topicPracticeHref(topicId?: string): string {
  return topicId ? `/app/practice?topicId=${encodeURIComponent(topicId)}` : "/app/practice";
}

export interface SubjectTaxonomyInfo {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  totalTopics: number;
  chaptersCount: number;
}

export interface TopicMetadata {
  topicId: string;
  topicName: string;
  topicSlug: string;
  chapterId: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
}

function findDatasetForAttempt(examAttemptId: string): SeedExamData | undefined {
  return SEEDED_EXAM_DATASETS.find(
    (d) => d.attempt.id === examAttemptId || d.attempt.slug === examAttemptId
  ) || SEEDED_EXAM_DATASETS[0];
}

/**
 * Returns dynamic subject topic counts from the verified curriculum dataset.
 * For NEET: Physics 61, Chemistry 40, Biology 38 = 139 total.
 */
export function getSubjectTaxonomySummary(examAttemptId: string): SubjectTaxonomyInfo[] {
  const dataset = findDatasetForAttempt(examAttemptId);
  if (!dataset) return [];

  return dataset.subjects.map((sub) => {
    const subjectId = `${dataset.exam.id}_${sub.slug}`;
    const totalTopics = sub.chapters.reduce((acc, c) => acc + c.topics.length, 0);
    return {
      id: subjectId,
      name: sub.name,
      slug: sub.slug,
      displayOrder: sub.displayOrder,
      totalTopics,
      chaptersCount: sub.chapters.length,
    };
  });
}

/**
 * Resolves full topic metadata (topic, chapter, subject) by topic ID.
 */
export function getTopicMetadata(
  topicId: string,
  examAttemptId?: string
): TopicMetadata | null {
  if (!topicId) return null;
  const dataset = examAttemptId ? findDatasetForAttempt(examAttemptId) : SEEDED_EXAM_DATASETS[0];
  if (!dataset) return null;

  for (const sub of dataset.subjects) {
    const subjectId = `${dataset.exam.id}_${sub.slug}`;
    for (const chap of sub.chapters) {
      const chapterId = `${subjectId}_${chap.slug}`;
      for (const top of chap.topics) {
        const topId = `${chapterId}_${top.slug}`;
        if (topId === topicId || top.slug === topicId) {
          return {
            topicId: topId,
            topicName: top.name,
            topicSlug: top.slug,
            chapterId,
            chapterName: chap.name,
            subjectId,
            subjectName: sub.name,
            subjectSlug: sub.slug,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Resolves all topics in canonical display order for an exam attempt.
 */
export function getAllTopicsForAttempt(examAttemptId: string): TopicMetadata[] {
  const dataset = findDatasetForAttempt(examAttemptId);
  if (!dataset) return [];

  const list: TopicMetadata[] = [];
  for (const sub of dataset.subjects) {
    const subjectId = `${dataset.exam.id}_${sub.slug}`;
    for (const chap of sub.chapters) {
      const chapterId = `${subjectId}_${chap.slug}`;
      for (const top of chap.topics) {
        list.push({
          topicId: `${chapterId}_${top.slug}`,
          topicName: top.name,
          topicSlug: top.slug,
          chapterId,
          chapterName: chap.name,
          subjectId,
          subjectName: sub.name,
          subjectSlug: sub.slug,
        });
      }
    }
  }
  return list;
}

// ============================================================================
// 3. TODAY'S FOCUS ENGINE (Deterministic Recommendation Engine)
// ============================================================================

export type FocusActionType = "revision" | "practice" | "study" | "planner" | "continue";

export interface TodaysFocusRecommendation {
  action: FocusActionType;
  badgeText: string;
  title: string;
  subtitle?: string;
  subjectName?: string;
  reason: string;
  ctaLabel: string;
  ctaHref: string;
  metadata?: {
    topicId?: string;
    taskId?: string;
    accuracyPercent?: number;
    scheduledDate?: string;
  };
}

export interface DashboardDataContext {
  workspace: UserWorkspace;
  progressList: UserTopicProgress[];
  plannerTasks: PlannerTask[];
  revisionItems: RevisionItem[];
  practiceSessions: PracticeSession[];
  studySessions: StudySession[];
  mockTests: (MockTest | MockTestDetail)[];
  /** Completed mock attempts with results — the only mock-derived user activity. */
  mockResults: MockTestResultDetail[];
  preferences: UserPreferences | null;
  referenceDate?: Date;
}

export function formatISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Evaluates Today's Focus recommendation deterministically using strict precedence:
 * 1. Revision due today (or overdue)
 * 2. Weak topic requiring practice (accuracy < 60%)
 * 3. Incomplete / currently-learning topic (status === "learning")
 * 4. Planned task for today
 * 5. Fallback continue next logical study activity
 */
export function getTodaysFocus(context: DashboardDataContext): TodaysFocusRecommendation {
  const refDate = context.referenceDate ? new Date(context.referenceDate) : new Date();
  const todayStr = formatISODate(refDate);
  const endOfToday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999).getTime();

  // 1. Revision due today or overdue
  // Check revision_items
  const dueRevisionItems = context.revisionItems
    .filter((r) => r.status === "scheduled" && r.nextRevisionAt && new Date(r.nextRevisionAt).getTime() <= endOfToday)
    .sort((a, b) => (new Date(a.nextRevisionAt!).getTime() - new Date(b.nextRevisionAt!).getTime()));

  if (dueRevisionItems.length > 0) {
    const item = dueRevisionItems[0];
    const meta = getTopicMetadata(item.topicId, context.workspace.examAttemptId);
    const itemDate = new Date(item.nextRevisionAt!);
    const isOverdue = itemDate.getTime() < new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
    const topicTitle = meta?.topicName || "Topic Revision";

    return {
      action: "revision",
      badgeText: isOverdue ? "Revision Overdue" : "Revision Due",
      title: topicTitle,
      subtitle: meta ? `${meta.subjectName} · ${meta.chapterName}` : undefined,
      subjectName: meta?.subjectName,
      reason: isOverdue ? "Revision is overdue." : "Revision is due today.",
      ctaLabel: "Start Revision",
      ctaHref: topicStudyHref(item.topicId),
      metadata: { topicId: item.topicId },
    };
  }

  // Also check topic progress for nextRevisionAt if no revision_items exist
  const dueProgressRevisions = context.progressList
    .filter((p) => p.nextRevisionAt && new Date(p.nextRevisionAt).getTime() <= endOfToday)
    .sort((a, b) => new Date(a.nextRevisionAt!).getTime() - new Date(b.nextRevisionAt!).getTime());

  if (dueProgressRevisions.length > 0) {
    const p = dueProgressRevisions[0];
    const meta = getTopicMetadata(p.topicId, context.workspace.examAttemptId);
    const pDate = new Date(p.nextRevisionAt!);
    const isOverdue = pDate.getTime() < new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
    const topicTitle = meta?.topicName || "Topic Revision";

    return {
      action: "revision",
      badgeText: isOverdue ? "Revision Overdue" : "Revision Due",
      title: topicTitle,
      subtitle: meta ? `${meta.subjectName} · ${meta.chapterName}` : undefined,
      subjectName: meta?.subjectName,
      reason: isOverdue ? "Revision is overdue." : "Revision is due today.",
      ctaLabel: "Start Revision",
      ctaHref: topicStudyHref(p.topicId),
      metadata: { topicId: p.topicId },
    };
  }

  // 2. Weak topic requiring practice
  // Derived from practice performance: practiceAttempts > 0 and accuracy < PRACTICE_WEAK_ACCURACY_BPS (< 60%)
  const weakTopics = context.progressList
    .filter((p) => p.practiceAttempts > 0 && p.accuracy < PRACTICE_WEAK_ACCURACY_BPS)
    .sort((a, b) => a.accuracy - b.accuracy);

  if (weakTopics.length > 0) {
    const weak = weakTopics[0];
    const meta = getTopicMetadata(weak.topicId, context.workspace.examAttemptId);
    const accuracyPct = Math.round(weak.accuracy / 100);
    const topicTitle = meta?.topicName || "Targeted Practice";

    return {
      action: "practice",
      badgeText: "Practice Needed",
      title: topicTitle,
      subtitle: meta ? `${meta.subjectName} · ${meta.chapterName}` : undefined,
      subjectName: meta?.subjectName,
      reason: `Recent practice accuracy is ${accuracyPct}% (target: 60%+).`,
      ctaLabel: "Practice Topic",
      ctaHref: topicPracticeHref(weak.topicId),
      metadata: { topicId: weak.topicId, accuracyPercent: accuracyPct },
    };
  }

  // Also check if any practice sessions exist with < 60% accuracy for a topic
  const practiceByTopic = new Map<string, { total: number; correct: number }>();
  for (const sess of context.practiceSessions) {
    if (sess.topicId && sess.questionCount > 0) {
      const current = practiceByTopic.get(sess.topicId) || { total: 0, correct: 0 };
      current.total += sess.questionCount;
      current.correct += sess.correct;
      practiceByTopic.set(sess.topicId, current);
    }
  }

  for (const [topicId, data] of practiceByTopic.entries()) {
    if (data.total >= 5) {
      const accuracy = (data.correct / data.total) * 100;
      if (accuracy < 60) {
        const meta = getTopicMetadata(topicId, context.workspace.examAttemptId);
        return {
          action: "practice",
          badgeText: "Practice Needed",
          title: meta?.topicName || "Targeted Practice",
          subtitle: meta ? `${meta.subjectName} · ${meta.chapterName}` : undefined,
          subjectName: meta?.subjectName,
          reason: `Recent practice accuracy is ${Math.round(accuracy)}% (target: 60%+).`,
          ctaLabel: "Practice Topic",
          ctaHref: topicPracticeHref(topicId),
          metadata: { topicId, accuracyPercent: Math.round(accuracy) },
        };
      }
    }
  }

  // 3. Incomplete / currently-learning topic
  const learningTopics = context.progressList
    .filter((p) => p.status === "learning")
    .sort((a, b) => {
      const aTime = a.lastStudiedAt ? new Date(a.lastStudiedAt).getTime() : 0;
      const bTime = b.lastStudiedAt ? new Date(b.lastStudiedAt).getTime() : 0;
      return bTime - aTime;
    });

  if (learningTopics.length > 0) {
    const learning = learningTopics[0];
    const meta = getTopicMetadata(learning.topicId, context.workspace.examAttemptId);
    const topicTitle = meta?.topicName || "Active Concept";

    return {
      action: "study",
      badgeText: "Currently Learning",
      title: topicTitle,
      subtitle: meta ? `${meta.subjectName} · ${meta.chapterName}` : undefined,
      subjectName: meta?.subjectName,
      reason: "Pick up where you left off in your active topic.",
      ctaLabel: "Continue Study",
      ctaHref: topicStudyHref(learning.topicId),
      metadata: { topicId: learning.topicId },
    };
  }

  // 4. Planned task for today
  const todayTasks = context.plannerTasks.filter(
    (t) => t.scheduledDate === todayStr && t.status !== "completed" && t.status !== "skipped"
  );

  if (todayTasks.length > 0) {
    const task = todayTasks[0];
    const meta = task.topicId ? getTopicMetadata(task.topicId, context.workspace.examAttemptId) : null;

    return {
      action: "planner",
      badgeText: "Today's Plan",
      title: task.title,
      subtitle: meta ? `${meta.subjectName} · ${task.durationMinutes} min` : `${task.durationMinutes} min`,
      subjectName: meta?.subjectName,
      reason: "Scheduled on your study plan for today.",
      ctaLabel: "Open Planner",
      ctaHref: "/app/planner",
      metadata: { taskId: task.id, scheduledDate: task.scheduledDate },
    };
  }

  // 5. Otherwise, suggest continuing next logical study activity
  const allTopics = getAllTopicsForAttempt(context.workspace.examAttemptId);
  const coveredTopicIds = new Set(
    context.progressList
      .filter((p) => p.status !== "not_started")
      .map((p) => p.topicId)
  );

  const nextTopic = allTopics.find((t) => !coveredTopicIds.has(t.topicId)) || allTopics[0];

  if (nextTopic) {
    return {
      action: "continue",
      badgeText: "Next in Syllabus",
      title: nextTopic.topicName,
      subtitle: `${nextTopic.subjectName} · ${nextTopic.chapterName}`,
      subjectName: nextTopic.subjectName,
      reason: "Begin with the next concept in your preparation sequence.",
      ctaLabel: "Start Studying",
      ctaHref: topicStudyHref(nextTopic.topicId),
      metadata: { topicId: nextTopic.topicId },
    };
  }

  return {
    action: "continue",
    badgeText: "Start Preparation",
    title: "Explore Your Syllabus",
    subtitle: "Physics, Chemistry & Biology",
    reason: "Pick a subject to begin your study journey.",
    ctaLabel: "Browse Subjects",
    ctaHref: "/app/study",
  };
}

// ============================================================================
// 4. PROGRESS SNAPSHOT AGGREGATION
// ============================================================================

export interface SubjectProgress {
  subjectId: string;
  name: string;
  slug: string;
  coveredTopics: number;
  totalTopics: number;
  percentage: number;
}

export interface PreparationProgressSnapshot {
  overallCovered: number;
  overallTotal: number;
  overallPercentage: number;
  subjects: SubjectProgress[];
  breakdown: {
    mastered: number;
    revised: number;
    practiced: number;
    learning: number;
    notStarted: number;
  };
}

/** Covered preparation states — the single source shared by dashboard and study aggregation. */
export const COVERED_STATUSES = new Set(["learned", "practiced", "revised", "mastered"]);

export function aggregateProgressSnapshot(
  taxonomySummary: SubjectTaxonomyInfo[],
  progressList: UserTopicProgress[]
): PreparationProgressSnapshot {
  const overallTotal = taxonomySummary.reduce((acc, s) => acc + s.totalTopics, 0);

  const breakdown = {
    mastered: 0,
    revised: 0,
    practiced: 0,
    learning: 0,
    notStarted: 0,
  };

  for (const p of progressList) {
    if (p.status === "mastered") breakdown.mastered++;
    else if (p.status === "revised") breakdown.revised++;
    else if (p.status === "practiced") breakdown.practiced++;
    else if (p.status === "learning") breakdown.learning++;
    else breakdown.notStarted++;
  }

  // Subject-level calculations
  const subjects: SubjectProgress[] = taxonomySummary.map((sub) => {
    let covered = 0;
    for (const p of progressList) {
      if (
        (p.topicId.startsWith(sub.id) || p.topicId.includes(`_${sub.slug}_`)) &&
        COVERED_STATUSES.has(p.status)
      ) {
        covered++;
      }
    }

    const percentage = sub.totalTopics > 0 ? Math.round((covered / sub.totalTopics) * 100) : 0;
    return {
      subjectId: sub.id,
      name: sub.name,
      slug: sub.slug,
      coveredTopics: covered,
      totalTopics: sub.totalTopics,
      percentage,
    };
  });

  const overallCovered = subjects.reduce((acc, s) => acc + s.coveredTopics, 0);
  const overallPercentage = overallTotal > 0 ? Math.round((overallCovered / overallTotal) * 100) : 0;
  breakdown.notStarted = Math.max(0, overallTotal - (breakdown.mastered + breakdown.revised + breakdown.practiced + breakdown.learning));

  return {
    overallCovered,
    overallTotal,
    overallPercentage,
    subjects,
    breakdown,
  };
}

// ============================================================================
// 5. ATTENTION NEEDED GENERATOR
// ============================================================================

export interface AttentionItem {
  id: string;
  type: "revision_overdue" | "revision_due" | "weak_practice" | "incomplete_tasks" | "inactivity";
  title: string;
  description: string;
  badgeLabel: string;
  badgeVariant: "urgent" | "warning" | "neutral";
  actionLabel: string;
  actionHref: string;
}

export function generateAttentionItems(context: DashboardDataContext): AttentionItem[] {
  const items: AttentionItem[] = [];
  const refDate = context.referenceDate ? new Date(context.referenceDate) : new Date();
  const todayMidnight = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
  const endOfToday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999).getTime();
  const todayStr = formatISODate(refDate);

  // Union of revision schedules per topic: revision_items are authoritative;
  // progress.nextRevisionAt covers topics scheduled before their first
  // completion (Phase 8 emergent scheduling from marking a topic covered).
  const scheduleByTopic = new Map<string, number>();
  for (const p of context.progressList) {
    if (p.nextRevisionAt) {
      const t = new Date(p.nextRevisionAt).getTime();
      if (!isNaN(t)) scheduleByTopic.set(p.topicId, t);
    }
  }
  for (const r of context.revisionItems) {
    if (r.status === "scheduled" && r.nextRevisionAt) {
      const t = new Date(r.nextRevisionAt).getTime();
      if (!isNaN(t)) scheduleByTopic.set(r.topicId, t);
    } else {
      scheduleByTopic.delete(r.topicId);
    }
  }
  const scheduledTimes = [...scheduleByTopic.values()];

  // 1. Revision Overdue
  const overdueCount = scheduledTimes.filter((t) => t < todayMidnight).length;

  if (overdueCount > 0) {
    items.push({
      id: "attn_rev_overdue",
      type: "revision_overdue",
      title: "Revision overdue",
      description: `${overdueCount} ${overdueCount === 1 ? "topic is" : "topics are"} waiting for revision`,
      badgeLabel: `${overdueCount} overdue`,
      badgeVariant: "urgent",
      actionLabel: "Revise",
      actionHref: "/app/revision",
    });
  }

  // 2. Revision Due Today (if not already overdue)
  const dueTodayCount = scheduledTimes.filter(
    (t) => t >= todayMidnight && t <= endOfToday
  ).length;

  if (dueTodayCount > 0) {
    items.push({
      id: "attn_rev_due_today",
      type: "revision_due",
      title: "Revision due today",
      description: `${dueTodayCount} ${dueTodayCount === 1 ? "topic is" : "topics are"} scheduled for review`,
      badgeLabel: `${dueTodayCount} due`,
      badgeVariant: "warning",
      actionLabel: "Review",
      actionHref: "/app/revision",
    });
  }

  // 3. Weak Practice Performance
  const weakTopics = context.progressList
    .filter((p) => p.practiceAttempts > 0 && p.accuracy < PRACTICE_WEAK_ACCURACY_BPS)
    .sort((a, b) => a.accuracy - b.accuracy);

  if (weakTopics.length > 0) {
    const weak = weakTopics[0];
    const meta = getTopicMetadata(weak.topicId, context.workspace.examAttemptId);
    const accPct = Math.round(weak.accuracy / 100);
    items.push({
      id: `attn_weak_${weak.topicId}`,
      type: "weak_practice",
      title: "Targeted practice needed",
      description: `${meta?.topicName || "Topic"} — ${accPct}% accuracy`,
      badgeLabel: `${accPct}% acc`,
      badgeVariant: "warning",
      actionLabel: "Practice",
      actionHref: topicPracticeHref(weak.topicId),
    });
  }

  // 4. Incomplete Planned Tasks from previous days
  const overdueTasksCount = context.plannerTasks.filter(
    (t) => t.scheduledDate < todayStr && t.status !== "completed" && t.status !== "skipped"
  ).length;

  if (overdueTasksCount > 0) {
    items.push({
      id: "attn_tasks_overdue",
      type: "incomplete_tasks",
      title: "Incomplete planned tasks",
      description: `${overdueTasksCount} planned ${overdueTasksCount === 1 ? "task was" : "tasks were"} not completed`,
      badgeLabel: `${overdueTasksCount} pending`,
      badgeVariant: "neutral",
      actionLabel: "View Planner",
      actionHref: "/app/planner",
    });
  }

  // 5. Inactivity check (workspace active > 3 days, no session in last 3 days)
  const threeDaysAgo = todayMidnight - 3 * 24 * 60 * 60 * 1000;
  const wsCreated = new Date(context.workspace.createdAt).getTime();
  const hasRecentSession = context.studySessions.some(
    (s) => new Date(s.startedAt).getTime() >= threeDaysAgo
  );

  if (wsCreated < threeDaysAgo && !hasRecentSession && context.studySessions.length > 0) {
    items.push({
      id: "attn_inactivity",
      type: "inactivity",
      title: "Study momentum",
      description: "No study sessions recorded in the last 3 days.",
      badgeLabel: "Paused",
      badgeVariant: "neutral",
      actionLabel: "Start Studying",
      actionHref: "/app/study",
    });
  }

  return items;
}

// ============================================================================
// 6. RECENT ACTIVITY COMPILER
// ============================================================================

export interface RecentActivityItem {
  id: string;
  type: "study" | "practice" | "revision" | "planner" | "mock";
  title: string;
  subtitle: string;
  timestamp: Date;
  timeLabel: string;
}

function formatRelativeTime(date: Date, refDate: Date = new Date()): string {
  const dRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
  const dTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((dRef - dTarget) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function compileRecentActivity(context: DashboardDataContext): RecentActivityItem[] {
  const items: RecentActivityItem[] = [];
  const refDate = context.referenceDate ? new Date(context.referenceDate) : new Date();

  // Study sessions
  for (const s of context.studySessions) {
    const meta = s.topicId ? getTopicMetadata(s.topicId, context.workspace.examAttemptId) : null;
    const date = new Date(s.startedAt);
    items.push({
      id: `act_study_${s.id}`,
      type: "study",
      title: meta ? `Studied ${meta.topicName}` : "Study session completed",
      subtitle: `${s.durationMinutes} min · ${s.sessionType}`,
      timestamp: date,
      timeLabel: formatRelativeTime(date, refDate),
    });
  }

  // Practice sessions
  for (const p of context.practiceSessions) {
    const meta = p.topicId ? getTopicMetadata(p.topicId, context.workspace.examAttemptId) : null;
    const date = new Date(p.completedAt);
    const accPct = p.questionCount > 0 ? Math.round((p.correct / p.questionCount) * 100) : 0;
    items.push({
      id: `act_practice_${p.id}`,
      type: "practice",
      title: meta ? `Practiced ${meta.topicName}` : "Practice completed",
      subtitle: `${p.questionCount} ${p.questionCount === 1 ? "question" : "questions"} · ${accPct}% accuracy`,
      timestamp: date,
      timeLabel: formatRelativeTime(date, refDate),
    });
  }

  // Completed planner tasks
  for (const t of context.plannerTasks) {
    if (t.status === "completed") {
      const date = new Date(t.updatedAt || t.createdAt);
      items.push({
        id: `act_task_${t.id}`,
        type: "planner",
        title: `Completed ${t.title}`,
        subtitle: `${t.durationMinutes} min task`,
        timestamp: date,
        timeLabel: formatRelativeTime(date, refDate),
      });
    }
  }

  // Completed mock attempts. Available catalog/fixture mock definitions
  // (context.mockTests) are not user activity — only results are, and each
  // result is stamped with its own completion time, not the catalog createdAt.
  const mockById = new Map(context.mockTests.map((m) => [m.id, m]));
  for (const r of context.mockResults) {
    const mock = mockById.get(r.mockTestId);
    const date = new Date(r.completedAt);
    items.push({
      id: `act_mock_${r.id}`,
      type: "mock",
      title: `Mock test: ${r.mockTitle || mock?.title || "Mock Test"}`,
      subtitle: mock
        ? `${mock.durationMinutes} min · ${mock.type}`
        : `Score ${r.rawScore}/${r.totalMarks} · ${r.accuracyPct}% accuracy`,
      timestamp: date,
      timeLabel: formatRelativeTime(date, refDate),
    });
  }

  // Sort descending by timestamp, take top 6
  return items
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 6);
}

// ============================================================================
// 7. DASHBOARD DATA LOADER
// ============================================================================

export interface DashboardSnapshot {
  exam: {
    name: string;
    attemptLabel: string;
    examDate: Date | null;
    isProvisional: boolean;
    countdown: ExamCountdown;
    stageLabel: string;
    goalLabel: string;
  };
  todaysFocus: TodaysFocusRecommendation;
  todaysTasks: PlannerTask[];
  progress: PreparationProgressSnapshot;
  attentionItems: AttentionItem[];
  recentActivity: RecentActivityItem[];
}

export async function loadDashboardData(
  repos: DomainRepositories,
  workspace: UserWorkspace,
  referenceDate: Date = new Date()
): Promise<DashboardSnapshot> {
  const attempt = getExamAttempt(workspace.examAttemptId);
  const exam = getExamForAttempt(workspace.examAttemptId);

  // Fetch all domain data in parallel
  const [
    progressList,
    plannerTasks,
    revisionItems,
    practiceSessions,
    studySessions,
    mockTests,
    mockResults,
    preferences,
  ] = await Promise.all([
    repos.progress.getAllProgressForWorkspace(workspace.id).catch(() => []),
    repos.planner.getTasksForWorkspace(workspace.id).catch(() => []),
    repos.revision.getRevisionItems(workspace.id).catch(() => []),
    repos.practice.getPracticeSessions(workspace.id).catch(() => []),
    repos.studySession.getSessionsForWorkspace(workspace.id).catch(() => []),
    repos.mock.getMockTests(workspace.id).catch(() => []),
    repos.mock.getAllResultsForWorkspace(workspace.id).catch(() => []),
    repos.preferences.getUserPreferences().catch(() => null),
  ]);

  const context: DashboardDataContext = {
    workspace,
    progressList,
    plannerTasks,
    revisionItems,
    practiceSessions,
    studySessions,
    mockTests,
    mockResults,
    preferences,
    referenceDate,
  };

  const taxonomySummary = getSubjectTaxonomySummary(workspace.examAttemptId);
  const countdown = calculateExamCountdown(attempt?.examDate, referenceDate);
  const todaysFocus = getTodaysFocus(context);
  const progress = aggregateProgressSnapshot(taxonomySummary, progressList);
  const attentionItems = generateAttentionItems(context);
  const recentActivity = compileRecentActivity(context);

  const todayStr = formatISODate(referenceDate);
  const todaysTasks = plannerTasks
    .filter((t) => t.scheduledDate === todayStr)
    .sort((a, b) => {
      // Incomplete first
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      return 0;
    });

  return {
    exam: {
      name: exam?.name || "Competitive Exam",
      attemptLabel: attempt?.label || "Target Exam",
      examDate: attempt?.examDate || null,
      isProvisional: attempt?.isProvisional ?? false,
      countdown,
      stageLabel: getPreparationStageLabel(preferences?.preparationStage),
      goalLabel: formatStudyGoal(preferences?.dailyStudyGoalMinutes),
    },
    todaysFocus,
    todaysTasks,
    progress,
    attentionItems,
    recentActivity,
  };
}
