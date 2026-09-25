import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./db-test-adapter";
import type { DatabaseInstance } from "@/db";
import {
  exams,
  examAttempts,
  subjects,
  chapters,
  topics,
  users,
  userWorkspaces,
} from "@/db/schema";
import { seedExam } from "@/db/seeds/seed-exam";
import { neetSeedData } from "@/db/seeds/data/neet";
import { createGuestRepositories, GUEST_STORAGE_KEYS } from "@/repositories/guest-repositories";
import { mockTestRepository } from "@/repositories/mock-test.repository";
import { questionRepository } from "@/repositories/question.repository";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";

describe("Phase 11: Mock Test Repositories & Persistence", () => {
  describe("A. Guest In-Memory / IndexedDB Repositories", () => {
    let repos: ReturnType<typeof createGuestRepositories>;
    let storage: MemoryStorageAdapter;
    const workspaceId = "ws_guest_mock_test";

    beforeEach(() => {
      storage = new MemoryStorageAdapter();
      repos = createGuestRepositories(storage);
    });

    it("1. seeds and retrieves available fixture mock tests for workspace", async () => {
      const mocks = await repos.mock.getMockTests(workspaceId);
      expect(mocks.length).toBeGreaterThanOrEqual(3);

      const fullMock = mocks.find((m) => m.type === "full_syllabus");
      expect(fullMock).toBeDefined();
      expect(fullMock?.markingScheme.correctMarks).toBe(4);
      expect(fullMock?.markingScheme.incorrectPenalty).toBe(1);
      expect(fullMock?.provenance).toBe("fixture");
    });

    it("2. creates a mock session, records answer, and toggles marked for review", async () => {
      const mocks = await repos.mock.getMockTests(workspaceId);
      const testMock = mocks[0];

      const session = await repos.mock.createSession({
        workspaceId,
        mockTestId: testMock.id,
      });

      expect(session.id).toBeDefined();
      expect(session.status).toBe("in_progress");
      expect(session.questions.length).toBe(testMock.totalQuestions);
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const q1 = session.questions[0];
      const optId = q1.options[0].id;

      // Select answer
      await repos.mock.updateSessionAnswer({
        workspaceId,
        sessionId: session.id,
        questionId: q1.id,
        selectedOptionId: optId,
      });

      // Mark for review
      await repos.mock.updateSessionAnswer({
        workspaceId,
        sessionId: session.id,
        questionId: q1.id,
        isMarkedForReview: true,
      });

      const updated = await repos.mock.getSession(session.id, workspaceId);
      expect(updated?.selectedAnswers[q1.id]).toBe(optId);
      expect(updated?.markedForReview).toContain(q1.id);
    });

    it("3. resumes active unexpired mock session instead of duplicating questions", async () => {
      const mocks = await repos.mock.getMockTests(workspaceId);
      const testMock = mocks[0];

      const sess1 = await repos.mock.createSession({
        workspaceId,
        mockTestId: testMock.id,
      });

      const sess2 = await repos.mock.createSession({
        workspaceId,
        mockTestId: testMock.id,
      });

      // Must be same active session
      expect(sess1.id).toBe(sess2.id);
      expect(sess1.questionIds).toEqual(sess2.questionIds);
    });

    it("4. auto-submits expired session authoritatively when getSession is called past expiry", async () => {
      const mocks = await repos.mock.getMockTests(workspaceId);
      const testMock = mocks[0];

      const session = await repos.mock.createSession({
        workspaceId,
        mockTestId: testMock.id,
      });

      // Simulate expired time by updating session expiresAt in storage
      const sessions = (await storage.getItem<any[]>(GUEST_STORAGE_KEYS.MOCK_TEST_SESSIONS)) || [];
      const idx = sessions.findIndex((s) => s.id === session.id);
      if (idx !== -1) {
        sessions[idx].expiresAt = new Date(Date.now() - 5000).toISOString();
        await storage.setItem(GUEST_STORAGE_KEYS.MOCK_TEST_SESSIONS, sessions);
      }

      // Next retrieval should detect expiry and auto-submit
      const loaded = await repos.mock.getSession(session.id, workspaceId);
      expect(loaded?.status).toBe("auto_submitted");
      expect(loaded?.completedAt).toBeDefined();

      const result = await repos.mock.getResultBySessionId(session.id, workspaceId);
      expect(result).toBeDefined();
      expect(result?.submissionStatus).toBe("auto_submitted");
    });

    it("5. manually submits session, calculates score with negative marking, and updates practice progress", async () => {
      const mocks = await repos.mock.getMockTests(workspaceId);
      const testMock = mocks[0];

      const session = await repos.mock.createSession({
        workspaceId,
        mockTestId: testMock.id,
      });

      const q0 = session.questions[0];
      const q1 = session.questions[1];

      // q0 correct (+4), q1 wrong (-1)
      const correctOpt0 = q0.options.find((o) => o.isCorrect)?.id ?? null;
      const wrongOpt1 = q1.options.find((o) => !o.isCorrect)?.id ?? null;

      const result = await repos.mock.submitSession({
        workspaceId,
        sessionId: session.id,
        submissionStatus: "completed",
        answers: {
          [q0.id]: correctOpt0,
          [q1.id]: wrongOpt1,
        },
        markedForReview: [q0.id],
      });

      expect(result.rawScore).toBe(3); // 4 - 1 = 3
      expect(result.correct).toBe(1);
      expect(result.incorrect).toBe(1);
      expect(result.attempted).toBe(2);
      expect(result.submissionStatus).toBe("completed");

      // Verify practice session was recorded for q0's topic
      const practiceSessions = await repos.practice.getPracticeSessions(workspaceId);
      expect(practiceSessions.length).toBeGreaterThan(0);

      // Verify topic progress exists
      const progress = await repos.progress.getProgress(workspaceId, q0.topicId);
      expect(progress).toBeDefined();
      expect(progress?.practiceAttempts).toBeGreaterThanOrEqual(1);
    });
  });

  describe("B. Authenticated D1 / SQLite Repositories", () => {
    let db: DatabaseInstance;
    const userId = "usr_auth_mock";
    const workspaceId = "ws_auth_mock";
    const now = new Date();

    beforeEach(async () => {
      db = createTestDb();

      // Seed exam taxonomy
      await seedExam(db, neetSeedData);

      // Create test user and workspace
      await db.insert(users).values({
        id: userId,
        email: "mock_test_student@parikshaverse.org",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(userWorkspaces).values({
        id: workspaceId,
        userId,
        examAttemptId: "attempt_neet_2027",
        startedAt: now,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // Ensure question bank fixtures seeded
      await questionRepository.ensureFixtureQuestionsSeeded(db);
    });

    it("1. seeds and queries mock tests for workspace via D1 repository", async () => {
      const tests = await mockTestRepository.getMockTests(db, workspaceId);
      expect(tests.length).toBeGreaterThanOrEqual(3);

      const single = await mockTestRepository.getMockTestById(db, tests[0].id, workspaceId);
      expect(single).toBeDefined();
      expect(single?.id).toBe(tests[0].id);
    });

    it("2. creates session, records answer, submits, and stores results in D1", async () => {
      const tests = await mockTestRepository.getMockTests(db, workspaceId);
      const mockTest = tests[0];

      const session = await mockTestRepository.createSession(db, {
        workspaceId,
        mockTestId: mockTest.id,
        seed: 42,
      });

      expect(session.id).toBeDefined();
      expect(session.questions.length).toBe(mockTest.totalQuestions);

      const q0 = session.questions[0];
      const correctOpt = q0.options.find((o) => o.isCorrect)?.id ?? null;

      // Update answer
      await mockTestRepository.updateSessionAnswer(db, {
        workspaceId,
        sessionId: session.id,
        questionId: q0.id,
        selectedOptionId: correctOpt,
      });

      // Submit
      const result = await mockTestRepository.submitSession(db, {
        workspaceId,
        sessionId: session.id,
        submissionStatus: "completed",
        answers: { [q0.id]: correctOpt },
      });

      expect(result.rawScore).toBe(4);
      expect(result.correct).toBe(1);

      // Retrieve result by session
      const fetchedResult = await mockTestRepository.getResultBySessionId(db, session.id, workspaceId);
      expect(fetchedResult).toBeDefined();
      expect(fetchedResult?.rawScore).toBe(4);

      // Verify all results for workspace
      const allResults = await mockTestRepository.getAllResultsForWorkspace(db, workspaceId);
      expect(allResults.length).toBe(1);
      expect(allResults[0].sessionId).toBe(session.id);
    });
  });
});
