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
import { createGuestRepositories } from "@/repositories/guest-repositories";
import { questionRepository } from "@/repositories/question.repository";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";
import type { PracticeScope } from "@/domain/practice-engine";
import { PRACTICE_WEAK_ACCURACY_BPS } from "@/domain/practice";

describe("Phase 10: Practice Engine Repositories & Persistence", () => {
  describe("A. Guest In-Memory / IndexedDB Repositories", () => {
    let repos: ReturnType<typeof createGuestRepositories>;
    const workspaceId = "ws_guest_test";
    const topicId = "exam_neet_physics_kinematics_vectors-and-scalars";

    beforeEach(() => {
      const storage = new MemoryStorageAdapter();
      repos = createGuestRepositories(storage);
    });

    it("1. queries available questions by topic and subject scope", async () => {
      const topicScope: PracticeScope = { type: "topic", topicId };
      const count = await repos.question.countQuestionsForScope({ scope: topicScope });
      expect(count).toBe(5);

      const questions = await repos.question.getQuestionsForScope({ scope: topicScope });
      expect(questions).toHaveLength(5);
      expect(questions[0].topicId).toBe(topicId);
    });

    it("2. creates question session, records answers, and changes answers before submit", async () => {
      const topicScope: PracticeScope = { type: "topic", topicId };
      const session = await repos.questionSession.createSession({
        workspaceId,
        scope: topicScope,
        questionCount: 5,
        options: { shuffle: false },
      });

      expect(session.id).toBeDefined();
      expect(session.status).toBe("in_progress");
      expect(session.totalQuestions).toBe(5);
      expect(session.attempts).toHaveLength(5);

      const q1 = session.questions[0];
      const optA = q1.options[0].id;
      const optB = q1.options[1].id;

      // Select option A
      await repos.questionSession.recordAnswer({
        sessionId: session.id,
        workspaceId,
        questionId: q1.id,
        selectedOptionId: optA,
      });

      let updated = await repos.questionSession.getSession(session.id, workspaceId);
      expect(updated?.attempts[0].selectedOptionId).toBe(optA);

      // Change answer to option B
      await repos.questionSession.recordAnswer({
        sessionId: session.id,
        workspaceId,
        questionId: q1.id,
        selectedOptionId: optB,
      });

      updated = await repos.questionSession.getSession(session.id, workspaceId);
      expect(updated?.attempts[0].selectedOptionId).toBe(optB);

      // Clear answer
      await repos.questionSession.recordAnswer({
        sessionId: session.id,
        workspaceId,
        questionId: q1.id,
        selectedOptionId: null,
      });

      updated = await repos.questionSession.getSession(session.id, workspaceId);
      expect(updated?.attempts[0].selectedOptionId).toBeNull();
    });

    it("3. authoritatively evaluates submission and synchronizes with Phase 9 practice performance", async () => {
      const topicScope: PracticeScope = { type: "topic", topicId };
      const session = await repos.questionSession.createSession({
        workspaceId,
        scope: topicScope,
        questionCount: 4,
        options: { shuffle: false },
      });

      // Submit with 1 correct answer out of 2 attempted (50% accuracy -> weak)
      const q1 = session.questions[0];
      const q2 = session.questions[1];
      const correctOpt1 = q1.options.find((o) => o.isCorrect)!.id;
      const wrongOpt2 = q2.options.find((o) => !o.isCorrect)!.id;

      const result = await repos.questionSession.submitSession({
        sessionId: session.id,
        workspaceId,
        durationSeconds: 120,
        answers: {
          [q1.id]: correctOpt1,
          [q2.id]: wrongOpt2,
        },
      });

      expect(result.totalQuestions).toBe(4);
      expect(result.attempted).toBe(2);
      expect(result.correct).toBe(1);
      expect(result.incorrect).toBe(1);
      expect(result.unanswered).toBe(2);
      expect(result.accuracyBps).toBe(5000); // 50.00%
      expect(result.accuracyBps).toBeLessThan(PRACTICE_WEAK_ACCURACY_BPS);

      // Verify session is marked completed in storage
      const storedSession = await repos.questionSession.getSession(session.id, workspaceId);
      expect(storedSession?.status).toBe("completed");

      // Verify Phase 9 practice_sessions record was created!
      const practiceSessions = await repos.practice.getPracticeSessions(workspaceId);
      expect(practiceSessions).toHaveLength(1);
      expect(practiceSessions[0].topicId).toBe(topicId);
      expect(practiceSessions[0].questionCount).toBe(2);
      expect(practiceSessions[0].correct).toBe(1);

      // Verify user_topic_progress was updated!
      const progress = await repos.progress.getProgress(workspaceId, topicId);
      expect(progress).not.toBeNull();
      expect(progress?.practiceAttempts).toBe(2);
      expect(progress?.correctAnswers).toBe(1);
      expect(progress?.accuracy).toBe(5000);
      expect(progress?.status).toBe("practiced");
    });
  });

  describe("B. Server D1 Database Persistence", () => {
    let db: DatabaseInstance;
    const now = new Date();
    const workspaceId = "ws_auth_test";
    const topicId = "exam_neet_physics_kinematics_vectors-and-scalars";

    beforeEach(async () => {
      db = createTestDb();

      // Seed complete taxonomy entities for foreign keys
      await seedExam(db, neetSeedData);

      await db.insert(users).values({
        id: "usr_auth_1",
        email: "student@example.com",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(userWorkspaces).values({
        id: workspaceId,
        userId: "usr_auth_1",
        examAttemptId: "attempt_neet_2027",
        isActive: true,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    it("1. seeds fixture questions into D1 when empty", async () => {
      const allBefore = await questionRepository.getAllQuestions(db);
      expect(allBefore.length).toBeGreaterThan(0);

      const q = await questionRepository.getQuestionById(db, allBefore[0].id);
      expect(q).not.toBeNull();
      expect(q?.options.length).toBeGreaterThanOrEqual(2);
    });

    it("2. creates session and attempt records in D1 with foreign key integrity", async () => {
      const topicScope: PracticeScope = { type: "topic", topicId };
      const created = await questionRepository.createSession(db, {
        workspaceId,
        scope: topicScope,
        questionCount: 3,
        options: { shuffle: false },
      });

      expect(created.id).toBeDefined();
      expect(created.status).toBe("in_progress");
      expect(created.questions).toHaveLength(3);
      expect(created.attempts).toHaveLength(3);

      const fetched = await questionRepository.getSession(db, created.id, workspaceId);
      expect(fetched).not.toBeNull();
      expect(fetched?.totalQuestions).toBe(3);
    });

    it("3. authoritatively grades session in D1 and writes Phase 9 practice tables", async () => {
      const topicScope: PracticeScope = { type: "topic", topicId };
      const created = await questionRepository.createSession(db, {
        workspaceId,
        scope: topicScope,
        questionCount: 3,
        options: { shuffle: false },
      });

      const q1 = created.questions[0];
      const correctOpt1 = q1.options.find((o) => o.isCorrect)!.id;

      // Submit: 1 correct answer out of 1 attempted
      const result = await questionRepository.submitSession(db, {
        sessionId: created.id,
        workspaceId,
        durationSeconds: 90,
        answers: {
          [q1.id]: correctOpt1,
        },
      });

      expect(result.attempted).toBe(1);
      expect(result.correct).toBe(1);
      expect(result.accuracyBps).toBe(10000); // 100%

      // Verify D1 attempt updated
      const sessionAfter = await questionRepository.getSession(db, created.id, workspaceId);
      expect(sessionAfter?.status).toBe("completed");
      expect(sessionAfter?.attempts[0].isCorrect).toBe(true);

      // Verify session isolation: accessing with another workspaceId returns null
      const isolated = await questionRepository.getSession(db, created.id, "ws_other");
      expect(isolated).toBeNull();
    });
  });
});
