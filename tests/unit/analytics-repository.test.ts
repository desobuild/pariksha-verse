import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./db-test-adapter";
import type { DatabaseInstance } from "@/db";
import { seedExam } from "@/db/seeds/seed-exam";
import { neetSeedData } from "@/db/seeds/data/neet";
import { users, userWorkspaces, mockTests, mockTestResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  topicProgressRepository,
  practiceRepository,
  revisionItemRepository,
} from "@/repositories";
import { studySessionRepository } from "@/repositories/study-session.repository";
import { mockTestRepository } from "@/repositories/mock-test.repository";
import { questionRepository } from "@/repositories/question.repository";
import {
  createGuestRepositories,
  GuestWorkspaceRepository,
} from "@/repositories/guest-repositories";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";
import type { DomainRepositories } from "@/repositories/interfaces";
import { loadAnalyticsSnapshot } from "@/domain/analytics";
import type { UserWorkspace } from "@/db/schema";

// ============================================================================
// Fixtures
// ============================================================================

const USER_A = "usr_analytics_a";
const USER_B = "usr_analytics_b";
const WS_A = "ws_analytics_a";
const WS_B = "ws_analytics_b";
const ATTEMPT = "attempt_neet_2027";

const T_UNITS = "exam_neet_physics_physics-and-measurement_units-and-measurements";
const T_MOTION = "exam_neet_physics_kinematics_motion-in-straight-line";
const T_MOLE = "exam_neet_chemistry_basic-concepts-of-chemistry_matter-and-mole-concept";

// Fixed local reference date.
const REF = new Date(2026, 8, 25, 12, 0, 0, 0);
const at = (dayOffset: number, hour = 10) =>
  new Date(2026, 8, 25 + dayOffset, hour, 0, 0, 0);

async function seedUserAndWorkspace(
  db: DatabaseInstance,
  workspaceId: string,
  userId: string
): Promise<UserWorkspace> {
  const now = new Date();
  await db.insert(users).values({
    id: userId,
    email: `${userId}@example.com`,
    createdAt: now,
    updatedAt: now,
  });
  const [workspace] = await db
    .insert(userWorkspaces)
    .values({
      id: workspaceId,
      userId,
      examAttemptId: ATTEMPT,
      isActive: true,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return workspace;
}

/**
 * Binds the server-side D1 repositories into the DomainRepositories shape
 * that `loadAnalyticsSnapshot` consumes — the same binding the API routes
 * perform per request. Unused ports mirror the authenticated repository's
 * server-side stubs.
 */
function createServerRepositories(db: DatabaseInstance): DomainRepositories {
  return {
    workspace: {
      getWorkspaceById: async (id) => {
        const rows = await db
          .select()
          .from(userWorkspaces)
          .where(eq(userWorkspaces.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      getWorkspaces: async () => {
        throw new Error("not implemented in test adapter");
      },
      getActiveWorkspace: async () => null,
      getWorkspaceForAttempt: async () => null,
      ensureWorkspaceForAttempt: async () => {
        throw new Error("not implemented in test adapter");
      },
      createWorkspace: async () => {
        throw new Error("not implemented in test adapter");
      },
      setActiveWorkspace: async () => undefined,
    },
    progress: {
      getProgress: (workspaceId, topicId) =>
        topicProgressRepository.getTopicProgress(db, workspaceId, topicId),
      getAllProgressForWorkspace: (workspaceId) =>
        topicProgressRepository.getProgressByWorkspaceId(db, workspaceId),
      upsertProgress: (data) => topicProgressRepository.upsertTopicProgress(db, data),
    },
    planner: {
      getTasksForWorkspace: async () => [],
      createTask: async () => {
        throw new Error("planner is server-stubbed");
      },
      updateTaskStatus: async () => undefined,
      deleteTask: async () => undefined,
    },
    studySession: {
      getSessionsForWorkspace: (workspaceId) =>
        studySessionRepository.getSessionsForWorkspaceId(db, workspaceId),
      createSession: (data) => studySessionRepository.createStudySession(db, data),
    },
    revision: {
      getRevisionItems: (workspaceId) =>
        revisionItemRepository.getRevisionItemsForWorkspace(db, workspaceId),
      upsertRevisionItem: (data) => revisionItemRepository.upsertRevisionItem(db, data),
    },
    practice: {
      getPracticeSessions: (workspaceId) =>
        practiceRepository.getSessionsForWorkspaceId(db, workspaceId),
      createPracticeSession: (data) => practiceRepository.createPracticeSession(db, data),
    },
    resource: {
      getSavedResources: async () => [],
      saveResource: async () => {
        throw new Error("not implemented in test adapter");
      },
      removeSavedResource: async () => undefined,
    },
    mock: {
      getMockTests: (workspaceId) => mockTestRepository.getMockTests(db, workspaceId),
      getMockTestById: (id, workspaceId) =>
        mockTestRepository.getMockTestById(db, id, workspaceId),
      createMockTest: async () => {
        throw new Error("not implemented in test adapter");
      },
      createSession: async () => {
        throw new Error("not implemented in test adapter");
      },
      getSession: async () => null,
      updateSessionAnswer: async () => undefined,
      submitSession: async () => {
        throw new Error("not implemented in test adapter");
      },
      saveResult: async () => {
        throw new Error("not implemented in test adapter");
      },
      getResult: async () => null,
      getResultBySessionId: (sessionId, workspaceId) =>
        mockTestRepository.getResultBySessionId(db, sessionId, workspaceId),
      getAllResultsForWorkspace: (workspaceId) =>
        mockTestRepository.getAllResultsForWorkspace(db, workspaceId),
    },
    preferences: {
      getUserPreferences: async () => null,
      saveUserPreferences: async () => {
        throw new Error("not implemented in test adapter");
      },
      getNotificationPreferences: async () => null,
      saveNotificationPreferences: async () => {
        throw new Error("not implemented in test adapter");
      },
    },
    question: {
      getQuestionById: (id) => questionRepository.getQuestionById(db, id),
      getQuestionsForScope: (params) => questionRepository.getQuestionsForScope(db, params),
      countQuestionsForScope: (params) => questionRepository.countQuestionsForScope(db, params),
      getAllQuestions: () => questionRepository.getAllQuestions(db),
    },
    questionSession: {
      createSession: async () => {
        throw new Error("not implemented in test adapter");
      },
      getSession: async () => null,
      recordAnswer: async () => undefined,
      submitSession: async () => {
        throw new Error("not implemented in test adapter");
      },
      getRecentQuestionSessions: (workspaceId) =>
        questionRepository.getRecentQuestionSessions(db, workspaceId),
    },
  };
}

async function seedWorkspaceData(db: DatabaseInstance, workspaceId: string) {
  const now = new Date();
  await topicProgressRepository.upsertTopicProgress(db, {
    workspaceId,
    topicId: T_UNITS,
    status: "practiced",
    practiceAttempts: 20,
    correctAnswers: 8,
    incorrectAnswers: 12,
    accuracy: 4000,
    practicedAt: at(-1),
  });
  await practiceRepository.createPracticeSession(db, {
    workspaceId,
    topicId: T_UNITS,
    questionCount: 20,
    correct: 8,
    incorrect: 12,
    unattempted: 0,
    durationMinutes: 10,
    completedAt: at(-1),
  });
  await studySessionRepository.createStudySession(db, {
    workspaceId,
    topicId: T_UNITS,
    startedAt: at(-1, 9),
    durationMinutes: 45,
    sessionType: "focused",
    createdAt: now,
    updatedAt: now,
  });
  await revisionItemRepository.upsertRevisionItem(db, {
    workspaceId,
    topicId: T_MOLE,
    revisionNumber: 1,
    nextRevisionAt: at(0, 9),
    status: "scheduled",
  });
  // The Phase 8 queue only surfaces topics whose progress status is
  // revision-eligible, so give T_MOLE a learned progress row.
  await topicProgressRepository.upsertTopicProgress(db, {
    workspaceId,
    topicId: T_MOLE,
    status: "learned",
    nextRevisionAt: at(0, 9),
    startedAt: at(-3),
    learnedAt: at(-3),
  });
}

async function seedMockResult(db: DatabaseInstance, workspaceId: string, rawScore: number) {
  const now = new Date();
  const mockId = `mock_${workspaceId}`;
  await db.insert(mockTests).values({
    id: mockId,
    workspaceId,
    title: `Mock for ${workspaceId}`,
    type: "full_syllabus",
    durationMinutes: 200,
    totalQuestions: 5,
    markingScheme: JSON.stringify({ correctMarks: 4, incorrectPenalty: 1, unansweredMarks: 0 }),
    sections: JSON.stringify([]),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(mockTestResults).values({
    id: `res_${workspaceId}`,
    mockTestId: mockId,
    score: rawScore,
    totalMarks: 720,
    correct: 12,
    incorrect: 3,
    unattempted: 5,
    accuracy: 8000,
    timeSpentSeconds: 3600,
    submissionStatus: "completed",
    completedAt: at(-2),
    createdAt: now,
    updatedAt: now,
  });
}

// ============================================================================
// Guest analytics (IndexedDB repositories)
// ============================================================================

describe("guest analytics (Phase 12)", () => {
  it("empty guest workspace yields a zeroed snapshot with no fabricated data", async () => {
    const repos = createGuestRepositories(new MemoryStorageAdapter());
    const workspace = await repos.workspace.ensureWorkspaceForAttempt(ATTEMPT);
    const snapshot = await loadAnalyticsSnapshot(repos, workspace, {
      range: "30d",
      referenceDate: REF,
    });

    expect(snapshot.hasAnyActivity).toBe(false);
    expect(snapshot.coverage.counts.total).toBe(139);
    expect(snapshot.coverage.counts.covered).toBe(0);
    expect(snapshot.practice.totals.sessions).toBe(0);
    expect(snapshot.study.totalMinutes).toBe(0);
    expect(snapshot.mocks.completed).toBe(0);
    expect(snapshot.subjects.every((s) => !s.hasData)).toBe(true);
  });

  it("derives analytics from guest IndexedDB data", async () => {
    const repos = createGuestRepositories(new MemoryStorageAdapter());
    const workspace = await repos.workspace.ensureWorkspaceForAttempt(ATTEMPT);

    await repos.practice.createPracticeSession({
      workspaceId: workspace.id,
      topicId: T_UNITS,
      questionCount: 10,
      correct: 4,
      incorrect: 6,
      unattempted: 0,
      durationMinutes: 10,
      completedAt: at(-1),
    });
    await repos.progress.upsertProgress({
      workspaceId: workspace.id,
      topicId: T_UNITS,
      status: "practiced",
      practiceAttempts: 10,
      correctAnswers: 4,
      incorrectAnswers: 6,
      accuracy: 4000,
      practicedAt: at(-1),
    });
    await repos.studySession.createSession({
      workspaceId: workspace.id,
      topicId: T_UNITS,
      startedAt: at(-1, 9),
      endedAt: at(-1, 10),
      durationMinutes: 60,
      sessionType: "focused",
    });

    const snapshot = await loadAnalyticsSnapshot(repos, workspace, {
      range: "7d",
      referenceDate: REF,
    });

    expect(snapshot.hasAnyActivity).toBe(true);
    expect(snapshot.practice.totals.questions).toBe(10);
    expect(snapshot.practice.totals.accuracyBps).toBe(4000);
    expect(snapshot.study.totalMinutes).toBe(60);
    const physics = snapshot.subjects.find((s) => s.subjectName === "Physics")!;
    expect(physics.accuracyBps).toBe(4000);
    expect(physics.weakTopics).toBe(1);
    expect(snapshot.insights.some((i) => i.id.startsWith("weak_"))).toBe(true);
  });

  it("separate guest storages never leak data between guests", async () => {
    const reposA = createGuestRepositories(new MemoryStorageAdapter());
    const reposB = createGuestRepositories(new MemoryStorageAdapter());
    const wsA = await reposA.workspace.ensureWorkspaceForAttempt(ATTEMPT);
    const wsB = await reposB.workspace.ensureWorkspaceForAttempt(ATTEMPT);

    await reposA.practice.createPracticeSession({
      workspaceId: wsA.id,
      topicId: T_UNITS,
      questionCount: 10,
      correct: 10,
      incorrect: 0,
      unattempted: 0,
      durationMinutes: 5,
      completedAt: at(0),
    });

    const snapshotA = await loadAnalyticsSnapshot(reposA, wsA, { range: "7d", referenceDate: REF });
    const snapshotB = await loadAnalyticsSnapshot(reposB, wsB, { range: "7d", referenceDate: REF });
    expect(snapshotA.practice.totals.questions).toBe(10);
    expect(snapshotB.practice.totals.questions).toBe(0);
  });
});

// ============================================================================
// Authenticated analytics (D1 repositories, workspace isolation)
// ============================================================================

describe("authenticated analytics (Phase 12)", () => {
  let db: DatabaseInstance;
  let serverRepos: DomainRepositories;
  let workspaceA: UserWorkspace;
  let workspaceB: UserWorkspace;

  beforeEach(async () => {
    db = createTestDb();
    await seedExam(db, neetSeedData);
    workspaceA = await seedUserAndWorkspace(db, WS_A, USER_A);
    workspaceB = await seedUserAndWorkspace(db, WS_B, USER_B);
    serverRepos = createServerRepositories(db);
  });

  it("empty authenticated workspace yields a zeroed snapshot", async () => {
    const snapshot = await loadAnalyticsSnapshot(serverRepos, workspaceA, {
      range: "30d",
      referenceDate: REF,
    });
    expect(snapshot.hasAnyActivity).toBe(false);
    expect(snapshot.workspaceId).toBe(WS_A);
    expect(snapshot.coverage.counts.covered).toBe(0);
    expect(snapshot.practice.totals.sessions).toBe(0);
  });

  it("derives the full analytics snapshot from D1-backed repositories", async () => {
    await seedWorkspaceData(db, WS_A);
    await seedMockResult(db, WS_A, 300);

    const snapshot = await loadAnalyticsSnapshot(serverRepos, workspaceA, {
      range: "30d",
      referenceDate: REF,
    });

    expect(snapshot.hasAnyActivity).toBe(true);
    // Coverage from user_topic_progress
    expect(snapshot.coverage.counts.covered).toBe(2);
    // Practice from practice_sessions
    expect(snapshot.practice.totals.questions).toBe(20);
    expect(snapshot.practice.totals.accuracyBps).toBe(4000);
    // Study from study_sessions
    expect(snapshot.study.totalMinutes).toBe(45);
    expect(snapshot.study.sessionCount).toBe(1);
    // Revision queue from the Phase 8 domain
    expect(snapshot.revision.dueToday + snapshot.revision.overdue).toBe(1);
    // Mocks from mock_test_results
    expect(snapshot.mocks.completed).toBe(1);
    expect(snapshot.mocks.history[0].rawScore).toBe(300);
    expect(snapshot.mocks.history[0].totalMarks).toBe(720);
    // Insights stay factual
    const weak = snapshot.insights.find((i) => i.id.startsWith("weak_"));
    expect(weak?.detail).toContain("40% accuracy across 20 questions");
  });

  it("never leaks data between workspaces — even with rows for both", async () => {
    await seedWorkspaceData(db, WS_A);
    await seedWorkspaceData(db, WS_B);
    await seedMockResult(db, WS_B, 250);

    const snapshotA = await loadAnalyticsSnapshot(serverRepos, workspaceA, {
      range: "30d",
      referenceDate: REF,
    });
    expect(snapshotA.workspaceId).toBe(WS_A);
    expect(snapshotA.practice.totals.questions).toBe(20);
    expect(snapshotA.coverage.counts.covered).toBe(2);
    expect(snapshotA.study.totalMinutes).toBe(45);
    expect(snapshotA.mocks.completed).toBe(0); // B's mock must not appear
    expect(snapshotA.mocks.history).toHaveLength(0);

    const snapshotB = await loadAnalyticsSnapshot(serverRepos, workspaceB, {
      range: "30d",
      referenceDate: REF,
    });
    expect(snapshotB.workspaceId).toBe(WS_B);
    expect(snapshotB.practice.totals.questions).toBe(20);
    expect(snapshotB.mocks.completed).toBe(1);
    expect(snapshotB.mocks.history[0].rawScore).toBe(250);
    expect(snapshotB.coverage.counts.covered).toBe(2);

    // The underlying repository layer scopes by workspaceId itself.
    const progressA = await topicProgressRepository.getProgressByWorkspaceId(db, WS_A);
    expect(progressA.every((p) => p.workspaceId === WS_A)).toBe(true);
    expect(progressA).toHaveLength(2);
    const sessionsA = await practiceRepository.getSessionsForWorkspaceId(db, WS_A);
    expect(sessionsA.every((s) => s.workspaceId === WS_A)).toBe(true);
    expect(sessionsA).toHaveLength(1);
    const resultsA = await mockTestRepository.getAllResultsForWorkspace(db, WS_A);
    expect(resultsA).toHaveLength(0);
    const resultsB = await mockTestRepository.getAllResultsForWorkspace(db, WS_B);
    expect(resultsB).toHaveLength(1);
  });

  it("honors time-range filtering on the authenticated path", async () => {
    await practiceRepository.createPracticeSession(db, {
      workspaceId: WS_A,
      topicId: T_UNITS,
      questionCount: 10,
      correct: 10,
      incorrect: 0,
      unattempted: 0,
      durationMinutes: 5,
      completedAt: at(-40), // outside 30d
    });
    await practiceRepository.createPracticeSession(db, {
      workspaceId: WS_A,
      topicId: T_UNITS,
      questionCount: 5,
      correct: 5,
      incorrect: 0,
      unattempted: 0,
      durationMinutes: 5,
      completedAt: at(-1), // inside 30d
    });

    const last30 = await loadAnalyticsSnapshot(serverRepos, workspaceA, {
      range: "30d",
      referenceDate: REF,
    });
    expect(last30.practice.totals.questions).toBe(5);
    expect(last30.practice.totals.accuracyBps).toBe(10000);

    const all = await loadAnalyticsSnapshot(serverRepos, workspaceA, {
      range: "all",
      referenceDate: REF,
    });
    expect(all.practice.totals.questions).toBe(15);
    expect(all.practice.totals.accuracyBps).toBe(10000); // (15/15)
  });
});

// Reassurance that the guest workspace factory participates in the same
// contract (used above through createGuestRepositories).
describe("guest workspace repository", () => {
  it("ensureWorkspaceForAttempt reuses the workspace for the attempt", async () => {
    const repos = createGuestRepositories(new MemoryStorageAdapter());
    const first = await repos.workspace.ensureWorkspaceForAttempt(ATTEMPT);
    const second = await repos.workspace.ensureWorkspaceForAttempt(ATTEMPT);
    expect(second.id).toBe(first.id);
    expect(first).toBeInstanceOf(Object);
    expect(GuestWorkspaceRepository).toBeDefined();
  });
});

