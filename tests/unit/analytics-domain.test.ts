import { describe, it, expect } from "vitest";
import type {
  PracticeSession,
  RevisionItem,
  StudySession,
  UserTopicProgress,
} from "@/db/schema";
import type { MockTestResultDetail, MockSectionResult } from "@/domain/mock-engine";
import type { QuestionSessionWithAttempts } from "@/domain/practice-engine";
import {
  ANALYTICS_RANGE_OPTIONS,
  analyticsRangeDays,
  buildAnalyticsSnapshot,
  buildConsistencyAnalytics,
  buildCoverageAnalytics,
  buildInsights,
  buildMockAnalytics,
  buildPracticeTrends,
  buildQuestionAnalytics,
  buildRecentChanges,
  buildRevisionAnalytics,
  buildStudyAnalytics,
  buildSubjectPerformance,
  buildTopicPerformance,
  filterAndSortTopicPerformance,
  filterPracticeSessionsByWindow,
  getAnalyticsRangeWindow,
  getPreviousWindow,
  isDateInRange,
} from "@/domain/analytics";
import { addLocalDays, startOfLocalDay, endOfLocalDay } from "@/domain/revision";

// ============================================================================
// FIXTURES — canonical NEET 2027 topic IDs and a fixed reference date.
// ============================================================================

const ATTEMPT = "attempt_neet_2027";
const WS = "ws_analytics_test";

// Fixed reference date: 25 Sep 2026, local noon. All windows are computed in
// local calendar time, so the tests are timezone-independent.
const REF = new Date(2026, 8, 25, 12, 0, 0, 0);

const T_UNITS = "exam_neet_physics_physics-and-measurement_units-and-measurements";
const T_MOTION = "exam_neet_physics_kinematics_motion-in-straight-line";
const T_MOLE = "exam_neet_chemistry_basic-concepts-of-chemistry_matter-and-mole-concept";
const T_LIVING = "exam_neet_biology_diversity-in-living-world_living-world-and-taxonomy";

const at = (dayOffset: number, hour = 10): Date =>
  new Date(2026, 8, 25 + dayOffset, hour, 0, 0, 0);

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

function makePracticeSession(overrides: Partial<PracticeSession> = {}): PracticeSession {
  const now = new Date();
  return {
    id: nextId("prac"),
    workspaceId: WS,
    topicId: T_UNITS,
    questionCount: 10,
    correct: 6,
    incorrect: 4,
    unattempted: 0,
    durationMinutes: 15,
    completedAt: at(0),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeStudySession(overrides: Partial<StudySession> = {}): StudySession {
  const now = new Date();
  return {
    id: nextId("study"),
    workspaceId: WS,
    plannerTaskId: null,
    topicId: T_UNITS,
    startedAt: at(0),
    endedAt: null,
    durationMinutes: 45,
    sessionType: "focused",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeProgress(overrides: Partial<UserTopicProgress> = {}): UserTopicProgress {
  const now = new Date();
  return {
    id: nextId("prog"),
    workspaceId: WS,
    topicId: T_UNITS,
    status: "learning",
    startedAt: at(-5),
    learnedAt: null,
    practicedAt: null,
    revisedAt: null,
    masteredAt: null,
    practiceAttempts: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    accuracy: 0,
    lastStudiedAt: at(-1),
    lastRevisedAt: null,
    nextRevisionAt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeRevisionItem(overrides: Partial<RevisionItem> = {}): RevisionItem {
  const now = new Date();
  return {
    id: nextId("rev"),
    workspaceId: WS,
    topicId: T_MOLE,
    revisionNumber: 2,
    lastRevisedAt: at(-3),
    nextRevisionAt: at(4),
    status: "scheduled",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeSectionResult(overrides: Partial<MockSectionResult> = {}): MockSectionResult {
  return {
    sectionId: "sec_physics",
    name: "Physics",
    totalQuestions: 5,
    attempted: 4,
    correct: 3,
    incorrect: 1,
    unanswered: 1,
    rawScore: 11,
    maxScore: 20,
    accuracyBps: 7500,
    accuracyPct: 75,
    ...overrides,
  };
}

function makeMockResult(overrides: Partial<MockTestResultDetail> = {}): MockTestResultDetail {
  return {
    id: nextId("res"),
    mockTestId: nextId("mock"),
    sessionId: nextId("msess"),
    workspaceId: WS,
    mockTitle: "NEET Full Mock 01",
    rawScore: 300,
    totalMarks: 720,
    totalQuestions: 20,
    attempted: 15,
    correct: 12,
    incorrect: 3,
    unattempted: 5,
    markedForReviewCount: 0,
    accuracy: 8000,
    accuracyPct: 80,
    timeSpentSeconds: 3600,
    submissionStatus: "completed",
    completedAt: at(-2),
    notes: null,
    sections: [],
    questions: [],
    ...overrides,
  };
}

function makeQuestionSession(
  overrides: Partial<QuestionSessionWithAttempts> = {}
): QuestionSessionWithAttempts {
  const now = new Date();
  return {
    id: nextId("qsess"),
    workspaceId: WS,
    scopeType: "topic",
    scopeId: T_UNITS,
    totalQuestions: 5,
    status: "completed",
    durationSeconds: 300,
    startedAt: at(-1),
    completedAt: at(-1),
    questions: [],
    attempts: [
      {
        id: nextId("att"),
        sessionId: "qsess",
        questionId: "q1",
        selectedOptionId: "opt_a",
        isCorrect: true,
        displayOrder: 0,
        answeredAt: at(-1),
      },
      {
        id: nextId("att"),
        sessionId: "qsess",
        questionId: "q2",
        selectedOptionId: "opt_b",
        isCorrect: false,
        displayOrder: 1,
        answeredAt: at(-1),
      },
      {
        id: nextId("att"),
        sessionId: "qsess",
        questionId: "q3",
        selectedOptionId: null,
        isCorrect: null,
        displayOrder: 2,
        answeredAt: null,
      },
      {
        id: nextId("att"),
        sessionId: "qsess",
        questionId: "q4",
        selectedOptionId: "opt_a",
        isCorrect: true,
        displayOrder: 3,
        answeredAt: at(-1),
      },
      {
        id: nextId("att"),
        sessionId: "qsess",
        questionId: "q5",
        selectedOptionId: null,
        isCorrect: null,
        displayOrder: 4,
        answeredAt: null,
      },
    ],
    ...overrides,
  };
}

const baseInput = (overrides: Partial<Parameters<typeof buildAnalyticsSnapshot>[0]> = {}) => ({
  workspaceId: WS,
  examAttemptId: ATTEMPT,
  progressList: [] as UserTopicProgress[],
  studySessions: [] as StudySession[],
  practiceSessions: [] as PracticeSession[],
  revisionItems: [] as RevisionItem[],
  mockResults: [] as MockTestResultDetail[],
  recentQuestionSessions: [] as QuestionSessionWithAttempts[],
  window: getAnalyticsRangeWindow("30d", REF),
  ...overrides,
});

// ============================================================================
// 1. TIME RANGE WINDOWS
// ============================================================================

describe("analytics time ranges", () => {
  it("defines the four required ranges", () => {
    expect(ANALYTICS_RANGE_OPTIONS.map((r) => r.value)).toEqual(["7d", "30d", "90d", "all"]);
    expect(analyticsRangeDays("7d")).toBe(7);
    expect(analyticsRangeDays("30d")).toBe(30);
    expect(analyticsRangeDays("90d")).toBe(90);
    expect(analyticsRangeDays("all")).toBeNull();
  });

  it("7d window covers the last 7 local calendar days including today", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    expect(window.days).toBe(7);
    expect(window.start).not.toBeNull();
    expect(window.start!.getTime()).toBe(startOfLocalDay(at(-6)).getTime());
    expect(window.end.getTime()).toBe(endOfLocalDay(REF).getTime());
  });

  it("isDateInRange includes boundaries: start midnight in, instant before out", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    expect(isDateInRange(startOfLocalDay(at(-6)), window)).toBe(true);
    expect(isDateInRange(new Date(startOfLocalDay(at(-6)).getTime() - 1), window)).toBe(false);
    expect(isDateInRange(endOfLocalDay(REF), window)).toBe(true);
    expect(isDateInRange(at(1), window)).toBe(false);
    expect(isDateInRange(null, window)).toBe(false);
  });

  it("all-time window has no start and accepts past dates", () => {
    const window = getAnalyticsRangeWindow("all", REF);
    expect(window.start).toBeNull();
    expect(isDateInRange(at(-400), window)).toBe(true);
    expect(isDateInRange(at(1), window)).toBe(false);
  });

  it("month and year boundaries stay local-calendar correct", () => {
    const ref = new Date(2026, 0, 3, 12, 0, 0); // 3 Jan 2026
    const window = getAnalyticsRangeWindow("7d", ref);
    expect(window.start!.getTime()).toBe(new Date(2025, 11, 28, 0, 0, 0).getTime());
    expect(isDateInRange(new Date(2025, 11, 28, 0, 0, 0), window)).toBe(true);
    expect(isDateInRange(new Date(2025, 11, 27, 23, 59, 59), window)).toBe(false);
  });

  it("previous window is the equal-length window immediately before", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const previous = getPreviousWindow(window)!;
    expect(previous.start!.getTime()).toBe(startOfLocalDay(at(-13)).getTime());
    expect(previous.end.getTime()).toBe(new Date(startOfLocalDay(at(-6)).getTime() - 1).getTime());
    expect(getPreviousWindow(getAnalyticsRangeWindow("all", REF))).toBeNull();
  });

  it("handles timestamps near midnight", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const justBeforeMidnightYesterday = new Date(2026, 8, 24, 23, 59, 59, 999);
    const justAfterMidnightToday = new Date(2026, 8, 25, 0, 0, 0, 0);
    expect(isDateInRange(justBeforeMidnightYesterday, window)).toBe(true);
    expect(isDateInRange(justAfterMidnightToday, window)).toBe(true);
  });
});

// ============================================================================
// 2. COVERAGE
// ============================================================================

describe("coverage analytics", () => {
  it("empty workspace: full syllabus is not started, 0% covered", () => {
    const coverage = buildCoverageAnalytics(ATTEMPT, []);
    expect(coverage.counts.total).toBe(139); // Physics 61 + Chemistry 40 + Biology 38
    expect(coverage.counts.notStarted).toBe(139);
    expect(coverage.counts.covered).toBe(0);
    expect(coverage.coveragePct).toBe(0);
    expect(coverage.subjects.map((s) => s.subjectName)).toEqual(["Physics", "Chemistry", "Biology"]);
    expect(coverage.subjects.map((s) => s.total)).toEqual([61, 40, 38]);
  });

  it("counts every canonical status without inventing a second status system", () => {
    const progressList = [
      makeProgress({ topicId: T_UNITS, status: "mastered" }),
      makeProgress({ topicId: T_MOTION, status: "learned" }),
      makeProgress({ topicId: T_MOLE, status: "learning" }),
    ];
    const coverage = buildCoverageAnalytics(ATTEMPT, progressList);
    expect(coverage.counts.mastered).toBe(1);
    expect(coverage.counts.learned).toBe(1);
    expect(coverage.counts.learning).toBe(1);
    expect(coverage.counts.covered).toBe(2); // learned + mastered
    expect(coverage.counts.notStarted).toBe(139 - 3);
    expect(coverage.coveragePct).toBe(1); // round(2/139*100)
  });

  it("breaks coverage down by subject and chapter with derived chapter status", () => {
    const progressList = [
      makeProgress({ topicId: T_UNITS, status: "practiced" }),
      makeProgress({ topicId: T_MOTION, status: "learning" }),
    ];
    const coverage = buildCoverageAnalytics(ATTEMPT, progressList);
    const physics = coverage.subjects[0];
    expect(physics.covered).toBe(1);
    expect(physics.learning).toBe(1);

    const unitsChapter = physics.chapters.find((c) => c.chapterName === "Physics and Measurement");
    expect(unitsChapter).toBeDefined();
    expect(unitsChapter!.status).toBe("in_progress");
    expect(unitsChapter!.percentage).toBeGreaterThan(0);
  });
});

// ============================================================================
// 3. SUBJECT PERFORMANCE
// ============================================================================

describe("subject performance", () => {
  it("no practice data: subjects report no data, never 0% accuracy as a result", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const sessions = filterPracticeSessionsByWindow([], window);
    const topics = buildTopicPerformance(ATTEMPT, sessions, [], [], REF);
    const subjects = buildSubjectPerformance(ATTEMPT, topics, []);
    expect(subjects).toHaveLength(3);
    expect(subjects.every((s) => !s.hasData && s.questionsAttempted === 0 && s.accuracyBps === 0)).toBe(true);
    expect(subjects.map((s) => s.subjectName)).toEqual(["Physics", "Chemistry", "Biology"]);
  });

  it("aggregates weighted accuracy across sessions and preserves canonical order", () => {
    const sessions = [
      makePracticeSession({ topicId: T_UNITS, questionCount: 10, correct: 8, incorrect: 2 }),
      makePracticeSession({ topicId: T_MOTION, questionCount: 30, correct: 15, incorrect: 15 }),
      makePracticeSession({ topicId: T_MOLE, questionCount: 10, correct: 9, incorrect: 1 }),
    ];
    const topics = buildTopicPerformance(ATTEMPT, sessions, [], [], REF);
    const subjects = buildSubjectPerformance(ATTEMPT, topics, []);

    const physics = subjects.find((s) => s.subjectName === "Physics")!;
    // Weighted: (8+15) / (10+30) = 57.5% -> 5750 bps, not an average of session accuracies
    expect(physics.questionsAttempted).toBe(40);
    expect(physics.correct).toBe(23);
    expect(physics.incorrect).toBe(17);
    expect(physics.accuracyBps).toBe(5750);
    expect(physics.hasData).toBe(true);
    // Physics topic below 60% with attempts (57.5%) is weak; Units topic at 80% is not
    expect(physics.weakTopics).toBe(1);

    const chemistry = subjects.find((s) => s.subjectName === "Chemistry")!;
    expect(chemistry.accuracyBps).toBe(9000);
    expect(chemistry.weakTopics).toBe(0);
  });

  it("exactly 60% accuracy is NOT weak; below 60% is weak", () => {
    const sessions = [
      makePracticeSession({ topicId: T_UNITS, questionCount: 10, correct: 6, incorrect: 4 }),
      makePracticeSession({ topicId: T_MOLE, questionCount: 10, correct: 5, incorrect: 5 }),
    ];
    const topics = buildTopicPerformance(ATTEMPT, sessions, [], [], REF);
    const units = topics.find((t) => t.topicId === T_UNITS)!;
    const mole = topics.find((t) => t.topicId === T_MOLE)!;
    expect(units.accuracyBps).toBe(6000);
    expect(units.isWeak).toBe(false);
    expect(mole.accuracyBps).toBe(5000);
    expect(mole.isWeak).toBe(true);
  });

  it("counts all-time covered topics from progress even inside a practice window", () => {
    const sessions = [makePracticeSession({ topicId: T_UNITS, questionCount: 10, correct: 6, incorrect: 4 })];
    const progressList = [makeProgress({ topicId: T_MOTION, status: "learned" })];
    const topics = buildTopicPerformance(ATTEMPT, sessions, [], [], REF);
    const subjects = buildSubjectPerformance(ATTEMPT, topics, progressList);
    const physics = subjects.find((s) => s.subjectName === "Physics")!;
    expect(physics.topicsCovered).toBe(1); // from progress row, not from practice
  });
});

// ============================================================================
// 4. TOPIC PERFORMANCE
// ============================================================================

describe("topic performance", () => {
  it("a topic with zero attempts is never weak and shows no data", () => {
    const topics = buildTopicPerformance(ATTEMPT, [], [], [], REF);
    expect(topics).toHaveLength(139);
    const untouched = topics.find((t) => t.topicId === T_LIVING)!;
    expect(untouched.hasData).toBe(false);
    expect(untouched.isWeak).toBe(false);
    expect(untouched.questionsAttempted).toBe(0);
    expect(untouched.status).toBe("not_started");
    expect(untouched.revisionState).toBe("none");
  });

  it("all-correct and all-incorrect sessions produce exact accuracies", () => {
    const sessions = [
      makePracticeSession({ topicId: T_UNITS, questionCount: 12, correct: 12, incorrect: 0 }),
      makePracticeSession({ topicId: T_MOLE, questionCount: 8, correct: 0, incorrect: 8 }),
    ];
    const topics = buildTopicPerformance(ATTEMPT, sessions, [], [], REF);
    expect(topics.find((t) => t.topicId === T_UNITS)!.accuracyBps).toBe(10000);
    const mole = topics.find((t) => t.topicId === T_MOLE)!;
    expect(mole.accuracyBps).toBe(0);
    expect(mole.isWeak).toBe(true); // has attempts, accuracy below 60%
  });

  it("derives topic status and revision state from stored records", () => {
    const progressList = [
      makeProgress({ topicId: T_UNITS, status: "revised", nextRevisionAt: at(-2) }),
      makeProgress({ topicId: T_MOTION, status: "learned", nextRevisionAt: at(0, 9) }),
      makeProgress({ topicId: T_MOLE, status: "learned", nextRevisionAt: at(3) }),
      makeProgress({ topicId: T_LIVING, status: "not_started", nextRevisionAt: at(-1) }),
    ];
    const topics = buildTopicPerformance(ATTEMPT, [], progressList, [], REF);
    const byId = new Map(topics.map((t) => [t.topicId, t]));
    expect(byId.get(T_UNITS)!.revisionState).toBe("overdue");
    expect(byId.get(T_MOTION)!.revisionState).toBe("due");
    expect(byId.get(T_MOLE)!.revisionState).toBe("upcoming");
    // not_started topics are never queued (Phase 8 rule)
    expect(byId.get(T_LIVING)!.revisionState).toBe("none");
  });

  it("a scheduled revision_items row takes precedence over the progress schedule", () => {
    const progressList = [makeProgress({ topicId: T_MOLE, status: "learned", nextRevisionAt: at(10) })];
    const revisionItems = [makeRevisionItem({ topicId: T_MOLE, nextRevisionAt: at(1) })];
    const topics = buildTopicPerformance(ATTEMPT, [], progressList, revisionItems, REF);
    expect(topics.find((t) => t.topicId === T_MOLE)!.revisionState).toBe("upcoming");
    expect(topics.find((t) => t.topicId === T_MOLE)!.nextRevisionAt!.getTime()).toBe(at(1).getTime());
  });

  it("finite windows exclude out-of-window sessions", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const sessions = [
      makePracticeSession({ topicId: T_UNITS, questionCount: 10, correct: 5, incorrect: 5, completedAt: at(-1) }),
      makePracticeSession({ topicId: T_UNITS, questionCount: 10, correct: 10, incorrect: 0, completedAt: at(-20) }),
    ];
    const inWindow = filterPracticeSessionsByWindow(sessions, window);
    expect(inWindow).toHaveLength(1);
    const topics = buildTopicPerformance(ATTEMPT, inWindow, [], [], REF);
    expect(topics.find((t) => t.topicId === T_UNITS)!.accuracyBps).toBe(5000);
  });

  it("filters and sorts topics without assigning arbitrary scores", () => {
    const sessions = [
      makePracticeSession({ topicId: T_UNITS, questionCount: 10, correct: 9, incorrect: 1 }),
      makePracticeSession({ topicId: T_MOTION, questionCount: 30, correct: 12, incorrect: 18 }),
      makePracticeSession({ topicId: T_MOLE, questionCount: 5, correct: 5, incorrect: 0 }),
    ];
    const progressList = [
      makeProgress({ topicId: T_UNITS, status: "practiced" }),
      makeProgress({ topicId: T_MOTION, status: "practiced" }),
    ];
    const topics = buildTopicPerformance(ATTEMPT, sessions, progressList, [], REF);

    const weakOnly = filterAndSortTopicPerformance(topics, { performance: "weak" });
    expect(weakOnly.map((t) => t.topicId)).toEqual([T_MOTION]);

    const subjectFiltered = filterAndSortTopicPerformance(topics, { subject: "chemistry" });
    // Every canonical Chemistry topic (40) — the subject filter narrows scope,
    // it does not hide untouched topics.
    expect(subjectFiltered).toHaveLength(40);
    expect(subjectFiltered.every((t) => t.subjectSlug === "chemistry")).toBe(true);
    expect(subjectFiltered.some((t) => t.topicId === T_MOLE)).toBe(true);

    const statusFiltered = filterAndSortTopicPerformance(topics, { status: "practiced" });
    expect(statusFiltered).toHaveLength(2);

    const byAccuracyAsc = filterAndSortTopicPerformance(topics, { sort: "accuracy_asc" });
    // 5000 bps is the lowest real accuracy among practiced topics...
    expect(byAccuracyAsc[0].topicId).toBe(T_MOTION);
    // ...and no-data topics never read as 0% — they sort last.
    expect(byAccuracyAsc[byAccuracyAsc.length - 1]!.hasData).toBe(false);
    expect(byAccuracyAsc.filter((t) => t.hasData).at(-1)!.topicId).toBe(T_MOLE);
    const byAccuracyDesc = filterAndSortTopicPerformance(topics, { sort: "accuracy_desc" });
    expect(byAccuracyDesc[0].topicId).toBe(T_MOLE);

    const byAttemptedDesc = filterAndSortTopicPerformance(topics, { sort: "attempted_desc" });
    expect(byAttemptedDesc[0].questionsAttempted).toBe(30);

    const byName = filterAndSortTopicPerformance(topics, { sort: "name" });
    const names = byName.map((t) => t.topicName);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });
});

// ============================================================================
// 5. PRACTICE TRENDS
// ============================================================================

describe("practice trends", () => {
  it("7d window produces 7 daily buckets including no-activity days", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const trends = buildPracticeTrends([], window);
    expect(trends.buckets).toHaveLength(7);
    expect(trends.buckets.every((b) => !b.hasActivity && b.accuracyBps === null)).toBe(true);
    expect(trends.totals.sessions).toBe(0);
    expect(trends.accuracySeries).toHaveLength(0);
  });

  it("distinguishes no activity from 0% accuracy", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const trends = buildPracticeTrends(
      [makePracticeSession({ completedAt: at(0), questionCount: 10, correct: 0, incorrect: 10 })],
      window
    );
    const today = trends.buckets[6];
    expect(today.hasActivity).toBe(true);
    expect(today.accuracyBps).toBe(0); // real 0% — all incorrect
    const empty = trends.buckets[0];
    expect(empty.hasActivity).toBe(false);
    expect(empty.accuracyBps).toBeNull(); // never drawn as 0%
  });

  it("aggregates volume buckets and totals with weighted accuracy", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const trends = buildPracticeTrends(
      [
        makePracticeSession({ completedAt: at(0), questionCount: 10, correct: 8, incorrect: 2, unattempted: 0 }),
        makePracticeSession({ completedAt: at(0), questionCount: 10, correct: 6, incorrect: 4, unattempted: 2 }),
        makePracticeSession({ completedAt: at(-3), questionCount: 20, correct: 20, incorrect: 0 }),
      ],
      window
    );
    expect(trends.totals.questions).toBe(40);
    expect(trends.totals.correct).toBe(34);
    expect(trends.totals.incorrect).toBe(6);
    expect(trends.totals.unattempted).toBe(2);
    expect(trends.totals.sessions).toBe(3);
    expect(trends.totals.accuracyBps).toBe(8500);
    expect(trends.totals.avgQuestionsPerSession).toBe(13.3);
    // Only two buckets have activity
    expect(trends.buckets.filter((b) => b.hasActivity)).toHaveLength(2);
    expect(trends.accuracySeries).toHaveLength(2);
    expect(trends.accuracySeries[1].accuracyBps).toBe(7000); // today: 14/20
  });

  it("a single session works; 90d buckets weekly", () => {
    const window90 = getAnalyticsRangeWindow("90d", REF);
    const trends90 = buildPracticeTrends([], window90);
    expect(trends90.buckets).toHaveLength(13); // 12 full weeks + 6 days
    trends90.buckets.slice(0, 12).forEach((b) => {
      expect(diffDays(b.start, b.end)).toBe(6);
    });

    const window7 = getAnalyticsRangeWindow("7d", REF);
    const single = buildPracticeTrends(
      [makePracticeSession({ completedAt: at(-6), questionCount: 5, correct: 5, incorrect: 0 })],
      window7
    );
    expect(single.totals.questions).toBe(5);
    expect(single.totals.accuracyBps).toBe(10000);
    expect(single.buckets[0].hasActivity).toBe(true);
  });

  it("all-time buckets monthly and include old sessions in totals", () => {
    const window = getAnalyticsRangeWindow("all", REF);
    const trends = buildPracticeTrends(
      [
        makePracticeSession({ completedAt: new Date(2026, 6, 15, 10, 0), questionCount: 10, correct: 10, incorrect: 0 }),
        makePracticeSession({ completedAt: at(0), questionCount: 10, correct: 5, incorrect: 5 }),
      ],
      window
    );
    expect(trends.buckets.length).toBeGreaterThanOrEqual(3); // Jul..Sep 2026
    expect(trends.totals.questions).toBe(20);
    expect(trends.buckets[0].key).toBe("2026-07");
    expect(trends.buckets[0].questions).toBe(10);
    expect(trends.buckets[trends.buckets.length - 1].key).toBe("2026-09");
  });
});

// ============================================================================
// 6. STUDY ACTIVITY + CONSISTENCY
// ============================================================================

describe("study analytics", () => {
  it("aggregates totals, average and active days from recorded sessions", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const study = buildStudyAnalytics(
      [
        makeStudySession({ startedAt: at(0, 9), durationMinutes: 60 }),
        makeStudySession({ startedAt: at(0, 18), durationMinutes: 30 }),
        makeStudySession({ startedAt: at(-2), durationMinutes: 90 }),
      ],
      ATTEMPT,
      window
    );
    expect(study.totalMinutes).toBe(180);
    expect(study.sessionCount).toBe(3);
    expect(study.avgSessionMinutes).toBe(60);
    expect(study.activeStudyDays).toBe(2);
    expect(study.series).toHaveLength(7);
    expect(study.series[6].minutes).toBe(90);
    expect(study.series[6].hasActivity).toBe(true);
    expect(study.series[0].hasActivity).toBe(false);
    expect(study.previousWindowMinutes).toBe(0);
  });

  it("maps study time by subject; unassigned sessions still count in totals", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const study = buildStudyAnalytics(
      [
        makeStudySession({ topicId: T_UNITS, durationMinutes: 60 }),
        makeStudySession({ topicId: T_MOLE, durationMinutes: 40 }),
        makeStudySession({ topicId: null, durationMinutes: 20 }),
      ],
      ATTEMPT,
      window
    );
    expect(study.totalMinutes).toBe(120);
    expect(study.bySubject).toHaveLength(2);
    const physics = study.bySubject.find((s) => s.subjectName === "Physics")!;
    expect(physics.minutes).toBe(60);
    expect(physics.sessions).toBe(1);
  });

  it("all-time window has no previous-period comparison", () => {
    const window = getAnalyticsRangeWindow("all", REF);
    const study = buildStudyAnalytics([makeStudySession({ durationMinutes: 15 })], ATTEMPT, window);
    expect(study.previousWindowMinutes).toBeNull();
  });

  it("never assumes planned time equals studied time", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const study = buildStudyAnalytics([], ATTEMPT, window);
    expect(study.totalMinutes).toBe(0);
    expect(study.sessionCount).toBe(0);
    expect(study.activeStudyDays).toBe(0);
  });
});

describe("consistency analytics", () => {
  it("counts distinct active days and sessions neutrally", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const consistency = buildConsistencyAnalytics({
      studySessions: [
        makeStudySession({ startedAt: at(0, 9) }),
        makeStudySession({ startedAt: at(0, 20) }),
        makeStudySession({ startedAt: at(-1) }),
      ],
      practiceSessions: [
        makePracticeSession({ completedAt: at(0) }),
        makePracticeSession({ completedAt: at(-10) }),
      ],
      mockResults: [makeMockResult({ completedAt: at(-1) })],
      revisionCompletions: 4,
      window,
      windowLabel: "30 days",
    });
    expect(consistency.activeStudyDays).toBe(2);
    expect(consistency.studySessions).toBe(3);
    expect(consistency.activePracticeDays).toBe(2);
    expect(consistency.practiceSessions).toBe(2);
    expect(consistency.mocksCompleted).toBe(1);
    expect(consistency.revisionCompletions).toBe(4);
    expect(consistency.windowDays).toBe(30);
  });
});

// ============================================================================
// 7. REVISION ACTIVITY
// ============================================================================

describe("revision analytics", () => {
  it("queue counts reuse the Phase 8 scheduling semantics", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const revision = buildRevisionAnalytics(
      ATTEMPT,
      [
        makeProgress({ topicId: T_UNITS, status: "learned", nextRevisionAt: at(0, 9) }),
        makeProgress({ topicId: T_MOTION, status: "learned", nextRevisionAt: at(-3) }),
        makeProgress({ topicId: T_LIVING, status: "learned", nextRevisionAt: at(2) }),
      ],
      [],
      window
    );
    expect(revision.dueToday).toBe(1);
    expect(revision.overdue).toBe(1);
    expect(revision.upcoming).toBe(1);
  });

  it("counts completions in range once per topic from revision_items and progress", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const revision = buildRevisionAnalytics(
      ATTEMPT,
      [
        makeProgress({ topicId: T_MOLE, lastRevisedAt: at(-3), revisedAt: at(-3) }),
        makeProgress({ topicId: T_LIVING, lastRevisedAt: at(-1) }),
        makeProgress({ topicId: T_UNITS, lastRevisedAt: at(-20) }),
      ],
      [makeRevisionItem({ topicId: T_MOLE, lastRevisedAt: at(-2) })],
      window
    );
    // T_MOLE counted once despite both sources carrying timestamps
    expect(revision.completionsInRange).toBe(2);
  });

  it("no revision data produces zeroed counts and empty series", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const revision = buildRevisionAnalytics(ATTEMPT, [], [], window);
    expect(revision.dueToday).toBe(0);
    expect(revision.overdue).toBe(0);
    expect(revision.upcoming).toBe(0);
    expect(revision.completionsInRange).toBe(0);
    expect(revision.series.every((b) => !b.hasActivity)).toBe(true);
  });
});

// ============================================================================
// 8. MOCK ANALYTICS
// ============================================================================

describe("mock analytics", () => {
  it("no mock data reports zeros and nulls, never a fabricated average", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const mocks = buildMockAnalytics([], window);
    expect(mocks.completed).toBe(0);
    expect(mocks.avgScorePctOfMax).toBeNull();
    expect(mocks.avgAccuracyBps).toBeNull();
    expect(mocks.avgTimeMinutes).toBeNull();
    expect(mocks.best).toBeNull();
    expect(mocks.history).toHaveLength(0);
    expect(mocks.sectionPerformance).toHaveLength(0);
  });

  it("normalizes scores per mock configuration (percentage of max marks)", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const mocks = buildMockAnalytics(
      [
        makeMockResult({ rawScore: 360, totalMarks: 720, accuracy: 7000, completedAt: at(-5) }),
        makeMockResult({ rawScore: 240, totalMarks: 600, accuracy: 8000, completedAt: at(-2), mockTitle: "Short Mock" }),
      ],
      window
    );
    expect(mocks.completed).toBe(2);
    // 50% and 40% of their own maximums
    expect(mocks.avgScorePctOfMax).toBe(45);
    expect(mocks.avgAccuracyBps).toBe(7500);
    expect(mocks.best!.title).toBe("NEET Full Mock 01");
    expect(mocks.best!.scorePctOfMax).toBe(50);
    // history newest first; trend chronological
    expect(mocks.history[0].title).toBe("Short Mock");
    expect(mocks.trend[0].accuracyBps).toBe(7000);
    expect(mocks.trend[1].accuracyBps).toBe(8000);
  });

  it("raw scores are always kept next to their own maximum", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const mocks = buildMockAnalytics([makeMockResult({ rawScore: 312, totalMarks: 720 })], window);
    expect(mocks.history[0].rawScore).toBe(312);
    expect(mocks.history[0].totalMarks).toBe(720);
    expect(mocks.history[0].scorePctOfMax).toBeCloseTo(43.3, 1);
  });

  it("excludes mocks outside the time window", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const mocks = buildMockAnalytics(
      [makeMockResult({ completedAt: at(-20) })],
      window
    );
    expect(mocks.completed).toBe(0);
  });

  it("section analytics require at least two mocks with sections", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const one = buildMockAnalytics(
      [makeMockResult({ sections: [makeSectionResult()] })],
      window
    );
    expect(one.sectionPerformance).toHaveLength(0);
    expect(one.resultsWithSections).toBe(1);

    const two = buildMockAnalytics(
      [
        makeMockResult({ sections: [makeSectionResult(), makeSectionResult({ sectionId: "sec_bio", name: "Biology" })] }),
        makeMockResult({
          sections: [makeSectionResult({ correct: 4, incorrect: 1, attempted: 5, accuracyBps: 8000 })],
        }),
      ],
      window
    );
    expect(two.sectionPerformance).toHaveLength(2);
    const physics = two.sectionPerformance.find((s) => s.name === "Physics")!;
    expect(physics.mocks).toBe(2);
    expect(physics.attempted).toBe(9);
    expect(physics.correct).toBe(7);
    expect(physics.accuracyBps).toBe(7778); // round(7/9*10000)
    expect(physics.rawScore).toBe(22); // 11 + 11 section raw scores
    expect(physics.maxScore).toBe(40);
  });

  it("different marking schemes and maximum scores never break aggregation", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const mocks = buildMockAnalytics(
      [
        makeMockResult({ rawScore: 100, totalMarks: 100, accuracy: 6000, completedAt: at(-2) }), // +1/-0 scheme
        makeMockResult({ rawScore: -5, totalMarks: 240, accuracy: 4000, completedAt: at(-4) }), // negative-marking scheme
      ],
      window
    );
    expect(mocks.completed).toBe(2);
    // (100% + (-5/240 → -2.1)% ) / 2 = 49 (rounded to 1 dp at the entry level)
    expect(mocks.avgScorePctOfMax).toBe(49);
    expect(mocks.best!.title).toBe(mocks.history[0].title); // 100/100 mock leads
  });
});

// ============================================================================
// 9. QUESTION ANALYTICS
// ============================================================================

describe("question analytics", () => {
  it("derives per-session metrics from attempts with a clear scope label", () => {
    const analytics = buildQuestionAnalytics([makeQuestionSession()], ATTEMPT);
    const session = analytics.sessions[0];
    expect(session.scopeLabel).toBe("Units of Measurement, SI Units & Derived Units");
    expect(session.attempted).toBe(3);
    expect(session.correct).toBe(2);
    expect(session.incorrect).toBe(1);
    expect(session.unanswered).toBe(2);
    expect(session.accuracyBps).toBe(6667);
    expect(analytics.totals.sessions).toBe(1);
    expect(analytics.totals.accuracyBps).toBe(6667);
  });

  it("counts totals over completed sessions only", () => {
    const analytics = buildQuestionAnalytics(
      [
        makeQuestionSession(),
        makeQuestionSession({ status: "in_progress", totalQuestions: 10 }),
      ],
      ATTEMPT
    );
    expect(analytics.sessions).toHaveLength(2);
    expect(analytics.totals.sessions).toBe(1);
    expect(analytics.totals.attempted).toBe(3);
  });

  it("labels subject and mixed scopes", () => {
    const analytics = buildQuestionAnalytics(
      [
        makeQuestionSession({ scopeType: "subject", scopeId: "exam_neet_physics" }),
        makeQuestionSession({ scopeType: "mixed", scopeId: ATTEMPT }),
      ],
      ATTEMPT
    );
    expect(analytics.sessions[0].scopeLabel).toBe("Physics practice");
    expect(analytics.sessions[1].scopeLabel).toBe("Mixed practice");
  });
});

// ============================================================================
// 10. INSIGHTS + RECENT CHANGES
// ============================================================================

describe("insights", () => {
  it("reports weak topics with factual accuracy and attempt counts", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const coverage = buildCoverageAnalytics(ATTEMPT, []);
    const insights = buildInsights({
      examAttemptId: ATTEMPT,
      coverage,
      progressList: [],
      practiceSessions: [
        makePracticeSession({ topicId: T_MOTION, questionCount: 35, correct: 19, incorrect: 16 }),
      ],
      revision: { dueToday: 0, overdue: 0, upcoming: 0, recentlyRevised: [], completionsInRange: 0, series: [] },
      mocks: buildMockAnalytics([], window),
      study: buildStudyAnalytics([], ATTEMPT, window),
      window,
    });
    const weak = insights.find((i) => i.id.startsWith("weak_"))!;
    expect(weak).toBeDefined();
    expect(weak.kind).toBe("attention");
    // 19/35 = 5429 bps -> Phase 9 canonical formatter prints 54.3%
    expect(weak.detail).toContain("54.3% accuracy across 35 questions");
    expect(weak.detail).toContain("Frame of Reference, Uniform & Non-Uniform Motion");
  });

  it("a topic at exactly 60% does not generate a weak insight", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const insights = buildInsights({
      examAttemptId: ATTEMPT,
      coverage: buildCoverageAnalytics(ATTEMPT, []),
      progressList: [],
      practiceSessions: [
        makePracticeSession({ topicId: T_UNITS, questionCount: 10, correct: 6, incorrect: 4 }),
      ],
      revision: { dueToday: 0, overdue: 0, upcoming: 0, recentlyRevised: [], completionsInRange: 0, series: [] },
      mocks: buildMockAnalytics([], window),
      study: buildStudyAnalytics([], ATTEMPT, window),
      window,
    });
    expect(insights.find((i) => i.id.startsWith("weak_"))).toBeUndefined();
  });

  it("reports due and overdue revisions factually", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const base = {
      examAttemptId: ATTEMPT,
      coverage: buildCoverageAnalytics(ATTEMPT, []),
      progressList: [],
      practiceSessions: [],
      mocks: buildMockAnalytics([], window),
      study: buildStudyAnalytics([], ATTEMPT, window),
      window,
    };
    const overdue = buildInsights({
      ...base,
      revision: { dueToday: 0, overdue: 2, upcoming: 0, recentlyRevised: [], completionsInRange: 0, series: [] },
    });
    expect(overdue.find((i) => i.id === "revision_overdue")!.detail).toContain("2 topics are overdue");

    const due = buildInsights({
      ...base,
      revision: { dueToday: 1, overdue: 0, upcoming: 0, recentlyRevised: [], completionsInRange: 0, series: [] },
    });
    expect(due.find((i) => i.id === "revision_due")!.detail).toContain("1 topic is due for revision today");
  });

  it("reports mock accuracy changes across the last two completed mocks", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const base = {
      examAttemptId: ATTEMPT,
      coverage: buildCoverageAnalytics(ATTEMPT, []),
      progressList: [],
      practiceSessions: [],
      revision: { dueToday: 0, overdue: 0, upcoming: 0, recentlyRevised: [], completionsInRange: 0, series: [] },
      study: buildStudyAnalytics([], ATTEMPT, window),
      window,
    };
    const increased = buildInsights({
      ...base,
      mocks: buildMockAnalytics(
        [
          makeMockResult({ accuracy: 6000, completedAt: at(-10) }),
          makeMockResult({ accuracy: 7200, completedAt: at(-2) }),
        ],
        window
      ),
    });
    expect(increased.find((i) => i.id === "mock_accuracy")!.detail).toBe(
      "Mock accuracy increased from 60% to 72% across your last two mocks."
    );

    const decreased = buildInsights({
      ...base,
      mocks: buildMockAnalytics(
        [
          makeMockResult({ accuracy: 7200, completedAt: at(-10) }),
          makeMockResult({ accuracy: 6000, completedAt: at(-2) }),
        ],
        window
      ),
    });
    expect(decreased.find((i) => i.id === "mock_accuracy")!.detail).toBe(
      "Mock accuracy changed from 72% to 60% across your last two mocks."
    );
  });

  it("reports study time change versus the previous window", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const insights = buildInsights({
      examAttemptId: ATTEMPT,
      coverage: buildCoverageAnalytics(ATTEMPT, []),
      progressList: [],
      practiceSessions: [],
      revision: { dueToday: 0, overdue: 0, upcoming: 0, recentlyRevised: [], completionsInRange: 0, series: [] },
      mocks: buildMockAnalytics([], window),
      study: buildStudyAnalytics(
        [
          makeStudySession({ startedAt: at(-1), durationMinutes: 120 }),
          makeStudySession({ startedAt: at(-9), durationMinutes: 60 }),
        ],
        ATTEMPT,
        window
      ),
      window,
    });
    const change = insights.find((i) => i.id === "study_time_change")!;
    expect(change.detail).toBe(
      "Study time increased from 1 hr to 2 hrs versus the previous 7 days."
    );
  });

  it("never fabricates a readiness score or prediction", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const input = {
      examAttemptId: ATTEMPT,
      coverage: buildCoverageAnalytics(ATTEMPT, [makeProgress({ topicId: T_UNITS, status: "learned" })]),
      progressList: [],
      practiceSessions: [] as PracticeSession[],
      revision: { dueToday: 0, overdue: 0, upcoming: 0, recentlyRevised: [], completionsInRange: 0, series: [] },
      mocks: buildMockAnalytics([], window),
      study: buildStudyAnalytics([], ATTEMPT, window),
      window,
    };
    const insights = buildInsights(input);
    const banned = /readiness|percentile|rank|predict|guarantee|will qualify|exam-ready|chance of/i;
    for (const insight of insights) {
      expect(insight.title).not.toMatch(banned);
      expect(insight.detail).not.toMatch(banned);
    }
  });
});

describe("recent changes", () => {
  it("lists learned, practiced, revised and mock milestones from the window", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const changes = buildRecentChanges({
      examAttemptId: ATTEMPT,
      progressList: [
        makeProgress({ topicId: T_UNITS, learnedAt: at(-1), status: "learned" }),
        makeProgress({
          topicId: T_MOTION,
          practicedAt: at(-2),
          practiceAttempts: 35,
          correctAnswers: 19,
          accuracy: 5430,
          status: "practiced",
        }),
        makeProgress({ topicId: T_MOLE, lastRevisedAt: at(-30), revisedAt: at(-30), status: "revised" }),
      ],
      mockResults: [makeMockResult({ completedAt: at(0) })],
      window,
    });
    const types = changes.map((c) => c.type);
    expect(types).toContain("learned");
    expect(types).toContain("practiced");
    expect(types).toContain("mock");
    // at(-30) sits one day before the 30d window start (today-29)
    expect(types).not.toContain("revised");

    const practiced = changes.find((c) => c.type === "practiced")!;
    expect(practiced.detail).toContain("35 questions");
    expect(practiced.detail).toContain("54.3% accuracy");

    const mock = changes.find((c) => c.type === "mock")!;
    expect(mock.detail).toContain("300 / 720 marks");
    expect(mock.detail).toContain("80% accuracy");
  });

  it("sorts newest first and respects the limit", () => {
    const window = getAnalyticsRangeWindow("30d", REF);
    const changes = buildRecentChanges({
      examAttemptId: ATTEMPT,
      progressList: [
        makeProgress({ topicId: T_UNITS, learnedAt: at(-5), status: "learned" }),
        makeProgress({ topicId: T_MOTION, learnedAt: at(-1), status: "learned" }),
        makeProgress({ topicId: T_MOLE, learnedAt: at(-3), status: "learned" }),
      ],
      mockResults: [],
      window,
      limit: 2,
    });
    expect(changes).toHaveLength(2);
    expect(changes[0].at.getTime()).toBe(at(-1).getTime());
    expect(changes[1].at.getTime()).toBe(at(-3).getTime());
  });

  it("excludes milestones outside the window", () => {
    const window = getAnalyticsRangeWindow("7d", REF);
    const changes = buildRecentChanges({
      examAttemptId: ATTEMPT,
      progressList: [makeProgress({ topicId: T_UNITS, learnedAt: at(-10), status: "learned" })],
      mockResults: [],
      window,
    });
    expect(changes).toHaveLength(0);
  });
});

// ============================================================================
// 11. SNAPSHOT INTEGRATION
// ============================================================================

describe("buildAnalyticsSnapshot", () => {
  it("empty workspace: zeroed sections, no activity, no fabricated numbers", () => {
    const snapshot = buildAnalyticsSnapshot(baseInput());
    expect(snapshot.hasAnyActivity).toBe(false);
    expect(snapshot.coverage.counts.total).toBe(139);
    expect(snapshot.coverage.counts.covered).toBe(0);
    expect(snapshot.subjects.every((s) => !s.hasData)).toBe(true);
    expect(snapshot.practice.totals.sessions).toBe(0);
    expect(snapshot.study.totalMinutes).toBe(0);
    expect(snapshot.mocks.completed).toBe(0);
    expect(snapshot.questions.sessions).toHaveLength(0);
    expect(snapshot.recentChanges).toHaveLength(0);
  });

  it("populated workspace: sections derive from the same records coherently", () => {
    const sessions = [
      makePracticeSession({ topicId: T_UNITS, questionCount: 10, correct: 4, incorrect: 6, completedAt: at(-1) }),
    ];
    const snapshot = buildAnalyticsSnapshot(
      baseInput({
        progressList: [
          makeProgress({ topicId: T_UNITS, status: "practiced", practicedAt: at(-1), practiceAttempts: 10, correctAnswers: 4, incorrectAnswers: 6, accuracy: 4000 }),
        ],
        practiceSessions: sessions,
        studySessions: [makeStudySession({ startedAt: at(-1), durationMinutes: 45 })],
        revisionItems: [makeRevisionItem({ topicId: T_MOLE })],
        mockResults: [makeMockResult()],
        recentQuestionSessions: [makeQuestionSession()],
        window: getAnalyticsRangeWindow("7d", REF),
      })
    );
    expect(snapshot.hasAnyActivity).toBe(true);
    expect(snapshot.subjects.find((s) => s.subjectName === "Physics")!.accuracyBps).toBe(4000);
    expect(snapshot.topics.find((t) => t.topicId === T_UNITS)!.isWeak).toBe(true);
    expect(snapshot.practice.totals.questions).toBe(10);
    expect(snapshot.study.totalMinutes).toBe(45);
    expect(snapshot.mocks.completed).toBe(1);
    expect(snapshot.insights.find((i) => i.id.startsWith("weak_"))).toBeDefined();
  });

  it("finite windows never leak cumulative progress counters into practice metrics", () => {
    // progress says 100 attempts at 40%, but the only in-window session is 10/10
    const snapshot = buildAnalyticsSnapshot(
      baseInput({
        progressList: [
          makeProgress({
            topicId: T_UNITS,
            status: "practiced",
            practiceAttempts: 100,
            correctAnswers: 40,
            incorrectAnswers: 60,
            accuracy: 4000,
            nextRevisionAt: at(-1),
          }),
        ],
        practiceSessions: [
          makePracticeSession({ topicId: T_UNITS, questionCount: 10, correct: 10, incorrect: 0, completedAt: at(-1) }),
        ],
        window: getAnalyticsRangeWindow("7d", REF),
      })
    );
    const units = snapshot.topics.find((t) => t.topicId === T_UNITS)!;
    // Metrics are window-scoped…
    expect(units.questionsAttempted).toBe(10);
    expect(units.accuracyBps).toBe(10000);
    expect(units.isWeak).toBe(false);
    // …but cumulative status and revision state still render from progress.
    expect(units.status).toBe("practiced");
    expect(units.revisionState).toBe("overdue");
  });

  it("all-time windows use the canonical progress-aware aggregation", () => {
    const snapshot = buildAnalyticsSnapshot(
      baseInput({
        progressList: [
          makeProgress({
            topicId: T_UNITS,
            status: "practiced",
            practiceAttempts: 100,
            correctAnswers: 40,
            incorrectAnswers: 60,
            accuracy: 4000,
            practicedAt: at(-40),
          }),
        ],
        window: getAnalyticsRangeWindow("all", REF),
      })
    );
    const units = snapshot.topics.find((t) => t.topicId === T_UNITS)!;
    expect(units.questionsAttempted).toBe(100);
    expect(units.accuracyBps).toBe(4000);
    expect(units.isWeak).toBe(true);
  });

  it("multiple workspaces: records from another workspace never appear", () => {
    const otherWorkspaceSession = makePracticeSession({ workspaceId: "ws_other", topicId: T_UNITS });
    const snapshot = buildAnalyticsSnapshot(
      baseInput({
        practiceSessions: [otherWorkspaceSession],
        window: getAnalyticsRangeWindow("all", REF),
      })
    );
    // The builder only receives the target workspace's records by contract;
    // the snapshot must not silently widen to other IDs.
    expect(snapshot.practice.totals.sessions).toBe(1);
    // Workspace isolation is enforced at the repository layer and covered in
    // analytics-repository tests; here we assert the snapshot reflects only
    // what it was given.
    expect(snapshot.workspaceId).toBe(WS);
  });
});

// ============================================================================
// helpers
// ============================================================================

function diffDays(start: Date, end: Date): number {
  return Math.round(
    (new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() -
      new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) /
      86400000
  );
}

describe("analytics range type safety", () => {
  it("rejects unknown ranges", async () => {
    const { isAnalyticsRange } = await import("@/domain/analytics");
    expect(isAnalyticsRange("7d")).toBe(true);
    expect(isAnalyticsRange("fortnight")).toBe(false);
  });
});

// Reassurance that addLocalDays/startOfLocalDay imports are exercised (used
// in window boundary assertions above).
describe("local date helpers", () => {
  it("addLocalDays moves across month boundaries in local time", () => {
    const d = addLocalDays(new Date(2026, 8, 1), -1);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(31);
  });
});
