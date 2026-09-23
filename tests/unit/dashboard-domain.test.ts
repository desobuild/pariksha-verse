import { describe, it, expect } from "vitest";
import {
  calculateExamCountdown,
  getSubjectTaxonomySummary,
  getTopicMetadata,
  getAllTopicsForAttempt,
  getTodaysFocus,
  aggregateProgressSnapshot,
  generateAttentionItems,
  compileRecentActivity,
  type DashboardDataContext,
} from "@/domain/dashboard";
import type {
  UserWorkspace,
  UserTopicProgress,
  PlannerTask,
  RevisionItem,
  PracticeSession,
  StudySession,
  MockTest,
} from "@/db/schema";

const MOCK_WORKSPACE: UserWorkspace = {
  id: "ws_test_123",
  userId: "user_test",
  examAttemptId: "attempt_neet_2027",
  isActive: true,
  startedAt: new Date("2026-09-01"),
  createdAt: new Date("2026-09-01"),
  updatedAt: new Date("2026-09-01"),
};

function createBaseContext(referenceDate: Date = new Date("2026-10-01T10:00:00Z")): DashboardDataContext {
  return {
    workspace: MOCK_WORKSPACE,
    progressList: [],
    plannerTasks: [],
    revisionItems: [],
    practiceSessions: [],
    studySessions: [],
    mockTests: [],
    preferences: null,
    referenceDate,
  };
}

describe("Dashboard Domain — Exam Countdown", () => {
  const refDate = new Date("2026-10-01T08:00:00Z");

  it("calculates positive days remaining for future exams", () => {
    const examDate = new Date("2026-10-15T08:00:00Z");
    const result = calculateExamCountdown(examDate, refDate);
    expect(result.status).toBe("future");
    expect(result.daysRemaining).toBe(14);
    expect(result.label).toBe("14 days remaining");
  });

  it("handles 1 day remaining singular label", () => {
    const examDate = new Date("2026-10-02T08:00:00Z");
    const result = calculateExamCountdown(examDate, refDate);
    expect(result.status).toBe("future");
    expect(result.daysRemaining).toBe(1);
    expect(result.label).toBe("1 day remaining");
  });

  it("identifies exam today when date matches", () => {
    const examDate = new Date("2026-10-01T14:00:00Z");
    const result = calculateExamCountdown(examDate, refDate);
    expect(result.status).toBe("today");
    expect(result.daysRemaining).toBe(0);
    expect(result.label).toBe("Exam is today");
  });

  it("never returns negative days for past exams", () => {
    const examDate = new Date("2026-09-20T08:00:00Z");
    const result = calculateExamCountdown(examDate, refDate);
    expect(result.status).toBe("past");
    expect(result.daysRemaining).toBe(0);
    expect(result.label).toBe("Exam completed");
  });

  it("handles null and undefined dates gracefully", () => {
    expect(calculateExamCountdown(null).status).toBe("tba");
    expect(calculateExamCountdown(null).label).toBe("Date to be announced");
    expect(calculateExamCountdown(undefined).status).toBe("tba");
  });
});

describe("Dashboard Domain — Taxonomy Resolution", () => {
  it("resolves canonical NEET taxonomy with exact 139 topics", () => {
    const summary = getSubjectTaxonomySummary("attempt_neet_2027");
    expect(summary).toHaveLength(3);

    const physics = summary.find((s) => s.slug === "physics");
    const chemistry = summary.find((s) => s.slug === "chemistry");
    const biology = summary.find((s) => s.slug === "biology");

    expect(physics).toBeDefined();
    expect(chemistry).toBeDefined();
    expect(biology).toBeDefined();

    expect(physics!.totalTopics).toBe(61);
    expect(chemistry!.totalTopics).toBe(40);
    expect(biology!.totalTopics).toBe(38);

    const total = summary.reduce((acc, s) => acc + s.totalTopics, 0);
    expect(total).toBe(139);
  });

  it("resolves topic metadata by ID", () => {
    const allTopics = getAllTopicsForAttempt("attempt_neet_2027");
    expect(allTopics.length).toBe(139);

    const first = allTopics[0];
    const meta = getTopicMetadata(first.topicId, "attempt_neet_2027");
    expect(meta).toBeDefined();
    expect(meta?.topicName).toBe(first.topicName);
    expect(meta?.subjectName).toBe(first.subjectName);
    expect(meta?.chapterName).toBe(first.chapterName);
  });
});

describe("Dashboard Domain — Today's Focus Deterministic Engine", () => {
  const refDate = new Date("2026-10-01T10:00:00Z");

  it("Priority 1: Recommends revision when revision is due today", () => {
    const ctx = createBaseContext(refDate);
    const revItem: RevisionItem = {
      id: "rev_1",
      workspaceId: MOCK_WORKSPACE.id,
      topicId: "exam_neet_physics_kinematics_motion-in-straight-line",
      revisionNumber: 1,
      nextRevisionAt: new Date("2026-10-01T08:00:00Z"),
      lastRevisedAt: null,
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    ctx.revisionItems = [revItem];

    const focus = getTodaysFocus(ctx);
    expect(focus.action).toBe("revision");
    expect(focus.badgeText).toBe("Revision Due");
    expect(focus.reason).toBe("Revision is due today.");
    expect(focus.ctaLabel).toBe("Start Revision");
  });

  it("Priority 1: Recommends revision when revision is overdue", () => {
    const ctx = createBaseContext(refDate);
    const revItem: RevisionItem = {
      id: "rev_overdue",
      workspaceId: MOCK_WORKSPACE.id,
      topicId: "exam_neet_physics_kinematics_motion-in-straight-line",
      revisionNumber: 1,
      nextRevisionAt: new Date("2026-09-28T08:00:00Z"),
      lastRevisedAt: null,
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    ctx.revisionItems = [revItem];

    const focus = getTodaysFocus(ctx);
    expect(focus.action).toBe("revision");
    expect(focus.badgeText).toBe("Revision Overdue");
    expect(focus.reason).toBe("Revision is overdue.");
  });

  it("Priority 2: Recommends weak topic practice when accuracy is below 60%", () => {
    const ctx = createBaseContext(refDate);
    // Topic progress with low accuracy: 4800 bps = 48%
    const weakProgress: UserTopicProgress = {
      id: "prog_weak",
      workspaceId: MOCK_WORKSPACE.id,
      topicId: "exam_neet_physics_thermodynamics_thermal-properties",
      status: "practiced",
      startedAt: new Date("2026-09-20"),
      learnedAt: new Date("2026-09-22"),
      practicedAt: new Date("2026-09-25"),
      revisedAt: null,
      masteredAt: null,
      practiceAttempts: 25,
      correctAnswers: 12,
      incorrectAnswers: 13,
      accuracy: 4800, // 48%
      lastStudiedAt: new Date("2026-09-25"),
      lastRevisedAt: null,
      nextRevisionAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    ctx.progressList = [weakProgress];

    const focus = getTodaysFocus(ctx);
    expect(focus.action).toBe("practice");
    expect(focus.badgeText).toBe("Practice Needed");
    expect(focus.reason).toContain("48%");
    expect(focus.ctaLabel).toBe("Practice Topic");
  });

  it("Priority 3: Recommends in-progress learning topic when no due revision or weak topic", () => {
    const ctx = createBaseContext(refDate);
    const learningProgress: UserTopicProgress = {
      id: "prog_learning",
      workspaceId: MOCK_WORKSPACE.id,
      topicId: "exam_neet_biology_cell-biology_cell-structure",
      status: "learning",
      startedAt: new Date("2026-09-30"),
      learnedAt: null,
      practicedAt: null,
      revisedAt: null,
      masteredAt: null,
      practiceAttempts: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      accuracy: 0,
      lastStudiedAt: new Date("2026-09-30"),
      lastRevisedAt: null,
      nextRevisionAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    ctx.progressList = [learningProgress];

    const focus = getTodaysFocus(ctx);
    expect(focus.action).toBe("study");
    expect(focus.badgeText).toBe("Currently Learning");
    expect(focus.reason).toBe("Pick up where you left off in your active topic.");
    expect(focus.ctaLabel).toBe("Continue Study");
  });

  it("Priority 4: Recommends today's planned task when no learning topic", () => {
    const ctx = createBaseContext(refDate);
    const task: PlannerTask = {
      id: "task_today",
      workspaceId: MOCK_WORKSPACE.id,
      type: "study",
      title: "Electrostatics problem solving",
      subjectId: "exam_neet_physics",
      chapterId: null,
      topicId: null,
      scheduledDate: "2026-10-01",
      startTime: "16:00",
      durationMinutes: 60,
      status: "upcoming",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    ctx.plannerTasks = [task];

    const focus = getTodaysFocus(ctx);
    expect(focus.action).toBe("planner");
    expect(focus.badgeText).toBe("Today's Plan");
    expect(focus.title).toBe("Electrostatics problem solving");
    expect(focus.ctaLabel).toBe("Open Planner");
  });

  it("Priority 5: Fallback suggests next unstarted concept for a fresh workspace", () => {
    const ctx = createBaseContext(refDate);
    const focus = getTodaysFocus(ctx);
    expect(focus.action).toBe("continue");
    expect(focus.badgeText).toBe("Next in Syllabus");
    expect(focus.ctaLabel).toBe("Start Studying");
    expect(focus.title.length).toBeGreaterThan(0);
  });
});

describe("Dashboard Domain — Progress Snapshot Aggregation", () => {
  it("accurately computes overall coverage and subject percentages", () => {
    const summary = getSubjectTaxonomySummary("attempt_neet_2027");

    // Mock: 2 Physics topics, 1 Chemistry topic, 1 Biology topic
    const progressList: UserTopicProgress[] = [
      {
        id: "p1",
        workspaceId: MOCK_WORKSPACE.id,
        topicId: "exam_neet_physics_units_dimensions",
        status: "mastered",
        startedAt: new Date(),
        learnedAt: new Date(),
        practicedAt: new Date(),
        revisedAt: new Date(),
        masteredAt: new Date(),
        practiceAttempts: 10,
        correctAnswers: 9,
        incorrectAnswers: 1,
        accuracy: 9000,
        lastStudiedAt: new Date(),
        lastRevisedAt: new Date(),
        nextRevisionAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "p2",
        workspaceId: MOCK_WORKSPACE.id,
        topicId: "exam_neet_physics_kinematics_motion-in-straight-line",
        status: "practiced",
        startedAt: new Date(),
        learnedAt: new Date(),
        practicedAt: new Date(),
        revisedAt: null,
        masteredAt: null,
        practiceAttempts: 15,
        correctAnswers: 12,
        incorrectAnswers: 3,
        accuracy: 8000,
        lastStudiedAt: new Date(),
        lastRevisedAt: null,
        nextRevisionAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "p3",
        workspaceId: MOCK_WORKSPACE.id,
        topicId: "exam_neet_chemistry_some-basic-concepts_mole-concept",
        status: "revised",
        startedAt: new Date(),
        learnedAt: new Date(),
        practicedAt: new Date(),
        revisedAt: new Date(),
        masteredAt: null,
        practiceAttempts: 8,
        correctAnswers: 7,
        incorrectAnswers: 1,
        accuracy: 8750,
        lastStudiedAt: new Date(),
        lastRevisedAt: new Date(),
        nextRevisionAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "p4",
        workspaceId: MOCK_WORKSPACE.id,
        topicId: "exam_neet_biology_diversity-living-world_biological-classification",
        status: "learning",
        startedAt: new Date(),
        learnedAt: null,
        practicedAt: null,
        revisedAt: null,
        masteredAt: null,
        practiceAttempts: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        accuracy: 0,
        lastStudiedAt: new Date(),
        lastRevisedAt: null,
        nextRevisionAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const snapshot = aggregateProgressSnapshot(summary, progressList);

    expect(snapshot.overallTotal).toBe(139);
    // 3 covered topics (mastered, practiced, revised) - learning is not covered
    expect(snapshot.overallCovered).toBe(3);
    expect(snapshot.breakdown.mastered).toBe(1);
    expect(snapshot.breakdown.practiced).toBe(1);
    expect(snapshot.breakdown.revised).toBe(1);
    expect(snapshot.breakdown.learning).toBe(1);

    const physics = snapshot.subjects.find((s) => s.slug === "physics");
    expect(physics?.coveredTopics).toBe(2);
    expect(physics?.totalTopics).toBe(61);

    const chemistry = snapshot.subjects.find((s) => s.slug === "chemistry");
    expect(chemistry?.coveredTopics).toBe(1);
    expect(chemistry?.totalTopics).toBe(40);

    const biology = snapshot.subjects.find((s) => s.slug === "biology");
    expect(biology?.coveredTopics).toBe(0);
    expect(biology?.totalTopics).toBe(38);
  });
});

describe("Dashboard Domain — Attention Items & Activity", () => {
  const refDate = new Date("2026-10-01T10:00:00Z");

  it("generates calm attention items for overdue items and weak topics", () => {
    const ctx = createBaseContext(refDate);

    ctx.revisionItems = [
      {
        id: "rev_overdue",
        workspaceId: MOCK_WORKSPACE.id,
        topicId: "exam_neet_physics_kinematics_motion-in-straight-line",
        revisionNumber: 1,
        nextRevisionAt: new Date("2026-09-25T00:00:00Z"),
        lastRevisedAt: null,
        status: "scheduled",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    ctx.progressList = [
      {
        id: "prog_weak",
        workspaceId: MOCK_WORKSPACE.id,
        topicId: "exam_neet_chemistry_some-basic-concepts_mole-concept",
        status: "practiced",
        startedAt: new Date(),
        learnedAt: new Date(),
        practicedAt: new Date(),
        revisedAt: null,
        masteredAt: null,
        practiceAttempts: 20,
        correctAnswers: 8,
        incorrectAnswers: 12,
        accuracy: 4000,
        lastStudiedAt: new Date(),
        lastRevisedAt: null,
        nextRevisionAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const items = generateAttentionItems(ctx);
    expect(items.length).toBeGreaterThanOrEqual(2);

    const revItem = items.find((i) => i.type === "revision_overdue");
    expect(revItem).toBeDefined();
    expect(revItem?.description).toContain("waiting for revision");

    const weakItem = items.find((i) => i.type === "weak_practice");
    expect(weakItem).toBeDefined();
    expect(weakItem?.description).toContain("40% accuracy");
  });

  it("returns empty attention items when preparation is on track", () => {
    const ctx = createBaseContext(refDate);
    const items = generateAttentionItems(ctx);
    expect(items).toEqual([]);
  });

  it("compiles recent activity chronologically", () => {
    const ctx = createBaseContext(refDate);

    ctx.studySessions = [
      {
        id: "s1",
        workspaceId: MOCK_WORKSPACE.id,
        plannerTaskId: null,
        topicId: "exam_neet_physics_units_dimensions",
        startedAt: new Date("2026-10-01T08:00:00Z"),
        endedAt: new Date("2026-10-01T08:45:00Z"),
        durationMinutes: 45,
        sessionType: "focused",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    ctx.practiceSessions = [
      {
        id: "p1",
        workspaceId: MOCK_WORKSPACE.id,
        topicId: "exam_neet_chemistry_some-basic-concepts_mole-concept",
        questionCount: 30,
        correct: 24,
        incorrect: 6,
        unattempted: 0,
        durationMinutes: 40,
        completedAt: new Date("2026-09-30T15:00:00Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const activities = compileRecentActivity(ctx);
    expect(activities).toHaveLength(2);
    expect(activities[0].type).toBe("study");
    expect(activities[0].timeLabel).toBe("Today");
    expect(activities[1].type).toBe("practice");
    expect(activities[1].timeLabel).toBe("Yesterday");
  });
});
