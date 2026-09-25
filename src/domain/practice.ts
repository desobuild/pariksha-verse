import { z } from "zod";
import type {
  PracticeSession,
  NewPracticeSession,
  UserTopicProgress,
} from "@/db/schema";
import type { DomainRepositories } from "@/repositories/interfaces";
import type { TopicProgressUpsertInput } from "./study";
import {
  getSubjectTaxonomySummary,
  getAllTopicsForAttempt,
  type TopicMetadata,
} from "./dashboard";

// ============================================================================
// 1. CONSTANTS & DOMAIN TYPES
// ============================================================================

/**
 * Accuracy threshold below which a topic is classified as "weak" and in need
 * of practice. Represented in basis points: 6000 bps = 60.00%.
 * Topics with exactly 6000 bps (60%) are NOT weak.
 */
export const PRACTICE_WEAK_ACCURACY_BPS = 6000;

export const PRACTICE_TYPES = ["focused", "revision", "mixed"] as const;
export type PracticeType = (typeof PRACTICE_TYPES)[number];

export type PracticeSessionCreateInput = Omit<
  NewPracticeSession,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export interface TopicPracticePerformance {
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  totalQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number; // Basis points (0 - 10000)
  sessionCount: number;
  lastPracticedAt: Date | null;
  isWeak: boolean;
}

export interface SubjectPracticePerformance {
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  displayOrder: number;
  totalQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number; // Basis points (0 - 10000)
  sessionCount: number;
}

export interface OverallPracticeSnapshot {
  totalQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number; // Basis points (0 - 10000)
  sessionCount: number;
}

export interface WeakTopicInfo {
  topicId: string;
  topicName: string;
  topicSlug: string;
  chapterId: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number; // Basis points (0 - 10000)
  lastPracticedAt: Date | null;
}

export interface RecordPracticeInput {
  workspaceId: string;
  topicId: string;
  questionsAttempted: number;
  correctAnswers: number;
  durationMinutes?: number;
  sessionType?: PracticeType;
  completedAt?: Date;
}

export interface RecordPracticeResult {
  session: PracticeSession;
  progressPatch: TopicProgressUpsertInput;
  accuracyBps: number;
  accuracyPct: number;
}

// ============================================================================
// 2. ACCURACY & FORMATTING UTILITIES
// ============================================================================

/**
 * Calculates accuracy in basis points (0 - 10000).
 * Basis points avoid floating-point drift in storage and comparisons.
 */
export function calculateAccuracyBps(correct: number, attempted: number): number {
  if (attempted <= 0) return 0;
  return Math.round((correct / attempted) * 10000);
}

/**
 * Formats basis points into human-readable percentage.
 * E.g. 6970 bps -> "69.7%", 7000 bps -> "70%"
 */
export function formatAccuracy(bps: number): string {
  if (bps <= 0) return "0%";
  const pct = bps / 100;
  if (bps % 100 === 0) {
    return `${pct.toFixed(0)}%`;
  }
  return `${pct.toFixed(1)}%`;
}

/**
 * A topic is practice-weak when:
 * 1. totalQuestions > 0
 * 2. aggregate accuracy < 6000 bps (60%)
 *
 * Exactly 6000 bps is NOT weak.
 * No practice data (0 questions) is NOT weak.
 */
export function isTopicPracticeWeak(totalQuestions: number, accuracyBps: number): boolean {
  return totalQuestions > 0 && accuracyBps < PRACTICE_WEAK_ACCURACY_BPS;
}

// ============================================================================
// 3. VALIDATION
// ============================================================================

export const practiceSessionInputSchema = z
  .object({
    workspaceId: z.string().min(1, "Workspace ID is required"),
    topicId: z.string().min(1, "Topic ID is required"),
    questionsAttempted: z
      .number({ invalid_type_error: "Questions attempted must be a number" })
      .int("Questions attempted must be an integer")
      .min(1, "Questions attempted must be at least 1"),
    correctAnswers: z
      .number({ invalid_type_error: "Correct answers must be a number" })
      .int("Correct answers must be an integer")
      .min(0, "Correct answers cannot be negative"),
    durationMinutes: z
      .number({ invalid_type_error: "Duration must be a number" })
      .int("Duration must be an integer")
      .min(0, "Duration cannot be negative")
      .max(24 * 60, "Duration cannot exceed 24 hours")
      .optional()
      .default(0),
    sessionType: z.enum(PRACTICE_TYPES).optional().default("focused"),
    completedAt: z.coerce.date().optional(),
  })
  .refine((data) => data.correctAnswers <= data.questionsAttempted, {
    message: "Correct answers cannot exceed questions attempted",
    path: ["correctAnswers"],
  });

export function validatePracticeInput(data: unknown) {
  return practiceSessionInputSchema.safeParse(data);
}

// ============================================================================
// 4. AGGREGATION & REPORTING
// ============================================================================

/**
 * Calculates weighted topic performance from all recorded practice sessions.
 * Never averages session percentages blindly.
 */
export function aggregateTopicPerformance(
  topicId: string,
  sessions: PracticeSession[],
  meta?: TopicMetadata | null
): TopicPracticePerformance {
  const topicSessions = sessions.filter((s) => s.topicId === topicId);
  let totalQuestions = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;
  let lastPracticedAt: Date | null = null;

  for (const s of topicSessions) {
    totalQuestions += s.questionCount;
    totalCorrect += s.correct;
    totalIncorrect += s.incorrect;
    const comp = s.completedAt ? new Date(s.completedAt) : null;
    if (comp && (!lastPracticedAt || comp.getTime() > lastPracticedAt.getTime())) {
      lastPracticedAt = comp;
    }
  }

  const accuracy = calculateAccuracyBps(totalCorrect, totalQuestions);
  const isWeak = isTopicPracticeWeak(totalQuestions, accuracy);

  return {
    topicId,
    topicName: meta?.topicName || "Topic",
    chapterId: meta?.chapterId || "",
    chapterName: meta?.chapterName || "",
    subjectId: meta?.subjectId || "",
    subjectName: meta?.subjectName || "",
    subjectSlug: meta?.subjectSlug || "",
    totalQuestions,
    totalCorrect,
    totalIncorrect,
    accuracy,
    sessionCount: topicSessions.length,
    lastPracticedAt,
    isWeak,
  };
}

/**
 * Aggregates performance across all topics for an exam attempt.
 * Preserves canonical hierarchy and incorporates topic progress fallback if needed.
 */
export function aggregateAllTopicsPerformance(
  examAttemptId: string,
  sessions: PracticeSession[],
  progressList: UserTopicProgress[] = []
): Map<string, TopicPracticePerformance> {
  const allTopics = getAllTopicsForAttempt(examAttemptId);
  const result = new Map<string, TopicPracticePerformance>();

  // Group sessions by topic
  const sessionsByTopic = new Map<string, PracticeSession[]>();
  for (const sess of sessions) {
    if (sess.topicId) {
      const list = sessionsByTopic.get(sess.topicId) || [];
      list.push(sess);
      sessionsByTopic.set(sess.topicId, list);
    }
  }

  // Map progress by topic
  const progressByTopic = new Map<string, UserTopicProgress>();
  for (const prog of progressList) {
    progressByTopic.set(prog.topicId, prog);
  }

  for (const topic of allTopics) {
    const topicSessions = sessionsByTopic.get(topic.topicId) || [];
    if (topicSessions.length > 0) {
      result.set(topic.topicId, aggregateTopicPerformance(topic.topicId, topicSessions, topic));
    } else {
      // Check fallback from user_topic_progress if practice attempts were recorded
      const prog = progressByTopic.get(topic.topicId);
      if (prog && prog.practiceAttempts > 0) {
        const accuracy = prog.accuracy;
        result.set(topic.topicId, {
          topicId: topic.topicId,
          topicName: topic.topicName,
          chapterId: topic.chapterId,
          chapterName: topic.chapterName,
          subjectId: topic.subjectId,
          subjectName: topic.subjectName,
          subjectSlug: topic.subjectSlug,
          totalQuestions: prog.practiceAttempts,
          totalCorrect: prog.correctAnswers,
          totalIncorrect: prog.incorrectAnswers,
          accuracy,
          sessionCount: 1,
          lastPracticedAt: prog.practicedAt ? new Date(prog.practicedAt) : null,
          isWeak: isTopicPracticeWeak(prog.practiceAttempts, accuracy),
        });
      } else {
        // No practice yet
        result.set(topic.topicId, {
          topicId: topic.topicId,
          topicName: topic.topicName,
          chapterId: topic.chapterId,
          chapterName: topic.chapterName,
          subjectId: topic.subjectId,
          subjectName: topic.subjectName,
          subjectSlug: topic.subjectSlug,
          totalQuestions: 0,
          totalCorrect: 0,
          totalIncorrect: 0,
          accuracy: 0,
          sessionCount: 0,
          lastPracticedAt: null,
          isWeak: false,
        });
      }
    }
  }

  return result;
}

/**
 * Calculates Subject Performance sorted strictly in canonical syllabus order
 * (e.g. Physics, Chemistry, Biology). Does not visually rank subjects as winners/losers.
 */
export function getSubjectPracticePerformance(
  examAttemptId: string,
  sessions: PracticeSession[],
  topicPerformances?: Map<string, TopicPracticePerformance>
): SubjectPracticePerformance[] {
  const subjects = getSubjectTaxonomySummary(examAttemptId);
  const perfs = topicPerformances ?? aggregateAllTopicsPerformance(examAttemptId, sessions);

  return subjects.map((sub) => {
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let sessionCount = 0;

    for (const perf of perfs.values()) {
      if (perf.subjectSlug === sub.slug || perf.subjectId === sub.id) {
        totalQuestions += perf.totalQuestions;
        totalCorrect += perf.totalCorrect;
        totalIncorrect += perf.totalIncorrect;
        sessionCount += perf.sessionCount;
      }
    }

    const accuracy = calculateAccuracyBps(totalCorrect, totalQuestions);

    return {
      subjectId: sub.id,
      subjectName: sub.name,
      subjectSlug: sub.slug,
      displayOrder: sub.displayOrder,
      totalQuestions,
      totalCorrect,
      totalIncorrect,
      accuracy,
      sessionCount,
    };
  });
}

/**
 * Calculates Overall Workspace Practice Snapshot from recorded sessions or aggregated topics.
 */
export function getOverallPracticeSnapshot(
  sessions: PracticeSession[],
  topicPerformances?: Map<string, TopicPracticePerformance>
): OverallPracticeSnapshot {
  if (topicPerformances) {
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let sessionCount = 0;

    for (const perf of topicPerformances.values()) {
      totalQuestions += perf.totalQuestions;
      totalCorrect += perf.totalCorrect;
      totalIncorrect += perf.totalIncorrect;
      sessionCount += perf.sessionCount;
    }

    const accuracy = calculateAccuracyBps(totalCorrect, totalQuestions);

    return {
      totalQuestions,
      totalCorrect,
      totalIncorrect,
      accuracy,
      sessionCount,
    };
  }

  let totalQuestions = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;

  for (const s of sessions) {
    totalQuestions += s.questionCount;
    totalCorrect += s.correct;
    totalIncorrect += s.incorrect;
  }

  const accuracy = calculateAccuracyBps(totalCorrect, totalQuestions);

  return {
    totalQuestions,
    totalCorrect,
    totalIncorrect,
    accuracy,
    sessionCount: sessions.length,
  };
}

/**
 * Identifies topics needing practice (weak topics).
 * Deterministically sorted: lowest accuracy first, then newest lastPracticedAt, then alphabetical.
 */
export function getWeakTopics(
  examAttemptId: string,
  sessions: PracticeSession[],
  topicPerformances?: Map<string, TopicPracticePerformance>
): WeakTopicInfo[] {
  const perfs = topicPerformances ?? aggregateAllTopicsPerformance(examAttemptId, sessions);
  const weakList: WeakTopicInfo[] = [];

  for (const p of perfs.values()) {
    if (p.isWeak) {
      weakList.push({
        topicId: p.topicId,
        topicName: p.topicName,
        topicSlug: p.topicName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        chapterId: p.chapterId,
        chapterName: p.chapterName,
        subjectId: p.subjectId,
        subjectName: p.subjectName,
        subjectSlug: p.subjectSlug,
        totalQuestions: p.totalQuestions,
        totalCorrect: p.totalCorrect,
        accuracy: p.accuracy,
        lastPracticedAt: p.lastPracticedAt,
      });
    }
  }

  return weakList.sort((a, b) => {
    if (a.accuracy !== b.accuracy) {
      return a.accuracy - b.accuracy;
    }
    const timeA = a.lastPracticedAt ? a.lastPracticedAt.getTime() : 0;
    const timeB = b.lastPracticedAt ? b.lastPracticedAt.getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return a.topicName.localeCompare(b.topicName);
  });
}

/**
 * Sorts recent practice sessions newest first, with stable secondary sort on session ID.
 */
export function sortRecentPracticeSessions(sessions: PracticeSession[]): PracticeSession[] {
  return [...sessions].sort((a, b) => {
    const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return a.id.localeCompare(b.id);
  });
}

// ============================================================================
// 5. FILTERING
// ============================================================================

export type PracticeSubjectFilter = "all" | string;
export type PracticePerformanceFilter = "all" | "weak" | "practiced";

export function filterTopicPerformances(
  performances: TopicPracticePerformance[],
  subjectFilter: PracticeSubjectFilter = "all",
  perfFilter: PracticePerformanceFilter = "all"
): TopicPracticePerformance[] {
  return performances.filter((item) => {
    // Subject filter
    if (subjectFilter !== "all") {
      const matchSubject =
        item.subjectSlug.toLowerCase() === subjectFilter.toLowerCase() ||
        item.subjectId.toLowerCase() === subjectFilter.toLowerCase() ||
        item.subjectName.toLowerCase() === subjectFilter.toLowerCase();
      if (!matchSubject) return false;
    }

    // Performance filter
    if (perfFilter === "weak") {
      return item.isWeak;
    }
    if (perfFilter === "practiced") {
      return item.totalQuestions > 0;
    }

    return true;
  });
}

// ============================================================================
// 6. RECORDING & PROGRESS SYNCHRONIZATION
// ============================================================================

/**
 * Creates the updated `user_topic_progress` payload after a practice session.
 * Preserves all revision timestamps, revision schedule, and status semantics.
 * Weighted accuracy is calculated from all sessions for that topic.
 */
export function applyPracticeSessionToProgress(input: {
  workspaceId: string;
  topicId: string;
  existingProgress?: UserTopicProgress | null;
  sessions: PracticeSession[];
  completedAt?: Date;
}): TopicProgressUpsertInput {
  const { workspaceId, topicId, existingProgress, sessions } = input;
  const completedAt = input.completedAt ?? new Date();

  // Aggregate stats across all sessions for this topic
  let totalAttempted = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;

  for (const s of sessions) {
    totalAttempted += s.questionCount;
    totalCorrect += s.correct;
    totalIncorrect += s.incorrect;
  }

  const accuracy = calculateAccuracyBps(totalCorrect, totalAttempted);

  // Status semantics: If existing status is not_started, upgrade to practiced.
  // Otherwise preserve existing status (learned, practiced, revised, mastered).
  const currentStatus = existingProgress?.status ?? "not_started";
  const newStatus = currentStatus === "not_started" ? "practiced" : currentStatus;

  return {
    id: existingProgress?.id,
    workspaceId,
    topicId,
    status: newStatus,
    startedAt: existingProgress?.startedAt ?? completedAt,
    learnedAt: existingProgress?.learnedAt ?? null,
    practicedAt: completedAt,
    revisedAt: existingProgress?.revisedAt ?? null,
    masteredAt: existingProgress?.masteredAt ?? null,
    practiceAttempts: totalAttempted,
    correctAnswers: totalCorrect,
    incorrectAnswers: totalIncorrect,
    accuracy,
    lastStudiedAt: existingProgress?.lastStudiedAt ?? completedAt,
    lastRevisedAt: existingProgress?.lastRevisedAt ?? null,
    nextRevisionAt: existingProgress?.nextRevisionAt ?? null,
    notes: existingProgress?.notes ?? null,
    createdAt: existingProgress?.createdAt ?? completedAt,
  };
}

/**
 * Domain-level practice session recording orchestration:
 * 1. Validates input
 * 2. Calculates session accuracy
 * 3. Creates practice session in repository
 * 4. Updates topic-level aggregate performance in user_topic_progress
 * 5. Preserves existing progress fields & revision state
 * 6. Returns the updated practice result
 */
export async function recordPracticeSession(
  repos: DomainRepositories,
  input: RecordPracticeInput
): Promise<RecordPracticeResult> {
  const parsed = validatePracticeInput(input);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join(", ");
    throw new Error(`Validation failed: ${message}`);
  }

  const valid = parsed.data;
  const completedAt = valid.completedAt ?? new Date();
  const incorrect = valid.questionsAttempted - valid.correctAnswers;
  const sessionAccuracy = calculateAccuracyBps(valid.correctAnswers, valid.questionsAttempted);

  // 1. Create practice session
  const newSession = await repos.practice.createPracticeSession({
    workspaceId: valid.workspaceId,
    topicId: valid.topicId,
    questionCount: valid.questionsAttempted,
    correct: valid.correctAnswers,
    incorrect,
    unattempted: 0,
    durationMinutes: valid.durationMinutes,
    completedAt,
  });

  // 2. Query existing state to calculate weighted aggregates
  const [existingProgress, allSessions] = await Promise.all([
    repos.progress.getProgress(valid.workspaceId, valid.topicId),
    repos.practice.getPracticeSessions(valid.workspaceId),
  ]);

  // Filter sessions for this topic (ensure newSession is included)
  const topicSessions = allSessions.filter((s) => s.topicId === valid.topicId);
  if (!topicSessions.some((s) => s.id === newSession.id)) {
    topicSessions.push(newSession);
  }

  // 3. Update topic-level aggregate performance
  const progressPatch = applyPracticeSessionToProgress({
    workspaceId: valid.workspaceId,
    topicId: valid.topicId,
    existingProgress,
    sessions: topicSessions,
    completedAt,
  });

  await repos.progress.upsertProgress(progressPatch);

  return {
    session: newSession,
    progressPatch,
    accuracyBps: sessionAccuracy,
    accuracyPct: Math.round(sessionAccuracy / 100),
  };
}
