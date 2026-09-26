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
  questionOptions,
  questions,
  practiceSessions,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { seedExam } from "@/db/seeds/seed-exam";
import { neetSeedData } from "@/db/seeds/data/neet";
import { questionRepository } from "@/repositories/question.repository";
import { mockTestRepository } from "@/repositories/mock-test.repository";
import { createGuestRepositories } from "@/repositories/guest-repositories";
import { FIXTURE_QUESTIONS } from "@/domain/practice-engine/fixtures";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";
import { loadAnalyticsSnapshot } from "@/domain/analytics";
import { isRevisionEligible, getDueRevisions } from "@/domain/revision";
import type { PracticeScope } from "@/domain/practice-engine";
import type { UserWorkspace } from "@/db/schema";

const T_ACCELERATED = "exam_neet_physics_kinematics_uniformly-accelerated-motion";
const SUBJECT_PHYSICS = "exam_neet_physics";
const SUBJECT_CHEMISTRY = "exam_neet_chemistry";
const SUBJECT_BIOLOGY = "exam_neet_biology";

describe("V1 Authored Bank: Seeding & Engine Integration", () => {
  describe("A. D1 Seeding & Idempotency", () => {
    let db: DatabaseInstance;

    beforeEach(async () => {
      db = createTestDb();
      await seedExam(db, neetSeedData);
    });

    it("1. seeds exactly 150 authored questions with 600 options", async () => {
      await questionRepository.ensureAuthoredQuestionsSeeded(db);

      const authored = await db
        .select()
        .from(questions)
        .where(eq(questions.provenance, "authored"));
      expect(authored).toHaveLength(150);
      for (const q of authored) {
        expect(q.source).toBe("ParikshaVerse Authored Bank");
        expect(q.attribution).toBe("Original practice content");
        expect(q.status).toBe("active");
        expect(q.type).toBe("single_choice");
      }

      const options = await db.select().from(questionOptions);
      expect(options).toHaveLength(600);
    });

    it("2. is fully idempotent: repeated seeds never duplicate or corrupt", async () => {
      await questionRepository.ensureAuthoredQuestionsSeeded(db);
      await questionRepository.ensureAuthoredQuestionsSeeded(db);
      await questionRepository.ensureAuthoredQuestionsSeeded(db);

      const authored = await db
        .select()
        .from(questions)
        .where(eq(questions.provenance, "authored"));
      expect(authored).toHaveLength(150);

      const options = await db.select().from(questionOptions);
      expect(options).toHaveLength(600);

      // A correct option is still exactly one per question
      const allOptions = await db.select().from(questionOptions);
      const correctByQuestion = new Map<string, number>();
      for (const opt of allOptions) {
        if (opt.isCorrect) {
          correctByQuestion.set(opt.questionId, (correctByQuestion.get(opt.questionId) || 0) + 1);
        }
      }
      for (const q of authored) {
        expect(correctByQuestion.get(q.id)).toBe(1);
      }
    });

    it("3. coexists with fixtures without relabelling them", async () => {
      await questionRepository.ensureFixtureQuestionsSeeded(db);
      await questionRepository.ensureAuthoredQuestionsSeeded(db);

      const fixtures = await db.select().from(questions).where(eq(questions.provenance, "fixture"));
      const authored = await db
        .select()
        .from(questions)
        .where(eq(questions.provenance, "authored"));

      expect(fixtures).toHaveLength(FIXTURE_QUESTIONS.length);
      for (const f of fixtures) {
        expect(f.provenance).toBe("fixture");
        expect(f.source).not.toBe("ParikshaVerse Authored Bank");
      }
      expect(authored).toHaveLength(150);

      // Full bank is visible through the repository
      const all = await questionRepository.getAllQuestions(db);
      expect(all).toHaveLength(150 + FIXTURE_QUESTIONS.length);
    });

    it("4. seeds the full taxonomy untouched (139 topics, no duplicates)", async () => {
      await questionRepository.ensureAuthoredQuestionsSeeded(db);

      const subjectRows = await db.select().from(subjects);
      const chapterRows = await db.select().from(chapters);
      const topicRows = await db.select().from(topics);
      const examRows = await db.select().from(exams);
      const attemptRows = await db.select().from(examAttempts);

      expect(examRows).toHaveLength(1);
      expect(attemptRows).toHaveLength(1);
      expect(subjectRows).toHaveLength(3);
      expect(chapterRows).toHaveLength(52);
      expect(topicRows).toHaveLength(139);
    });
  });

  describe("B. D1 Retrieval & Partial Pool Behaviour", () => {
    let db: DatabaseInstance;
    let workspace: UserWorkspace;

    beforeEach(async () => {
      db = createTestDb();
      await seedExam(db, neetSeedData);
      const now = new Date();
      await db.insert(users).values({
        id: "usr_auth_v1",
        email: "v1@example.com",
        createdAt: now,
        updatedAt: now,
      });
      const inserted = await db
        .insert(userWorkspaces)
        .values({
          id: "ws_auth_v1",
          userId: "usr_auth_v1",
          examAttemptId: "attempt_neet_2027",
          isActive: true,
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      workspace = inserted[0] as UserWorkspace;
    });

    it("1. retrieves authored questions by topic scope", async () => {
      const scope: PracticeScope = { type: "topic", topicId: T_ACCELERATED };
      const list = await questionRepository.getQuestionsForScope(db, { scope });
      expect(list).toHaveLength(2);
      for (const q of list) {
        expect(q.topicId).toBe(T_ACCELERATED);
        expect(q.provenance).toBe("authored");
        expect(q.id.startsWith("q_auth_phy_")).toBe(true);
      }
    });

    it("2. retrieves authored questions by subject scope (50 authored per subject)", async () => {
      for (const subjectId of [SUBJECT_PHYSICS, SUBJECT_CHEMISTRY, SUBJECT_BIOLOGY]) {
        const scope: PracticeScope = { type: "subject", subjectId };
        const list = await questionRepository.getQuestionsForScope(db, { scope });

        // Subject pool = 50 authored + the subject's share of engine fixtures
        expect(list.length).toBeGreaterThanOrEqual(50);
        const authoredInSubject = list.filter((q) => q.provenance === "authored");
        expect(authoredInSubject).toHaveLength(50);
        for (const q of authoredInSubject) {
          expect(q.subjectId).toBe(subjectId);
          expect(q.id.startsWith("q_auth_")).toBe(true);
        }
      }
    });

    it("3. supports mixed practice across the whole bank with partial pools intact", async () => {
      const scope: PracticeScope = { type: "mixed", examAttemptId: workspace.examAttemptId };
      const all = await questionRepository.getQuestionsForScope(db, { scope });
      expect(all).toHaveLength(150 + FIXTURE_QUESTIONS.length); // full active bank

      // Partial pool: never fabricates to reach the requested count
      const limited = await questionRepository.getQuestionsForScope(db, {
        scope,
        limit: 500,
      });
      expect(limited).toHaveLength(150 + FIXTURE_QUESTIONS.length);

      const topicScope: PracticeScope = { type: "topic", topicId: T_ACCELERATED };
      const partial = await questionRepository.getQuestionsForScope(db, {
        scope: topicScope,
        limit: 10,
      });
      expect(partial).toHaveLength(2);
    });

    it("4. reports empty scopes honestly for unseeded topics", async () => {
      const scope: PracticeScope = {
        type: "topic",
        topicId: "exam_neet_physics_experimental-skills_optical-and-electrical-experiments",
      };
      const count = await questionRepository.countQuestionsForScope(db, { scope });
      expect(count).toBe(0);
    });
  });

  describe("C. D1 Practice Session with Authored Questions", () => {
    let db: DatabaseInstance;
    const workspaceId = "ws_auth_v1_practice";

    beforeEach(async () => {
      db = createTestDb();
      await seedExam(db, neetSeedData);
      const now = new Date();
      await db.insert(users).values({
        id: "usr_auth_v1_practice",
        email: "v1practice@example.com",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(userWorkspaces).values({
        id: workspaceId,
        userId: "usr_auth_v1_practice",
        examAttemptId: "attempt_neet_2027",
        isActive: true,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    it("1. runs a full practice session on authored questions and updates Phase 9 progress", async () => {
      const scope: PracticeScope = { type: "topic", topicId: T_ACCELERATED };
      const session = await questionRepository.createSession(db, {
        workspaceId,
        scope,
        questionCount: 10,
        options: { shuffle: false },
      });

      // Partial pool: only the 2 authored questions exist for this topic
      expect(session.totalQuestions).toBe(2);
      for (const q of session.questions) {
        expect(q.provenance).toBe("authored");
      }

      const answers: Record<string, string | null> = {};
      for (const q of session.questions) {
        answers[q.id] = q.options.find((o) => o.isCorrect)!.id;
      }

      const result = await questionRepository.submitSession(db, {
        sessionId: session.id,
        workspaceId,
        durationSeconds: 120,
        answers,
      });

      expect(result.attempted).toBe(2);
      expect(result.correct).toBe(2);
      expect(result.accuracyBps).toBe(10000);

      // Phase 9 practice session record exists for the topic
      const practiceRows = await db
        .select()
        .from(practiceSessions)
        .where(
          and(
            eq(practiceSessions.workspaceId, workspaceId),
            eq(practiceSessions.topicId, T_ACCELERATED)
          )
        );
      expect(practiceRows).toHaveLength(1);
      expect(practiceRows[0].questionCount).toBe(2);
      expect(practiceRows[0].correct).toBe(2);
    });
  });

  describe("D. D1 Mock Integration with Authored Sample Mock", () => {
    let db: DatabaseInstance;
    const workspaceId = "ws_auth_v1_mock";

    beforeEach(async () => {
      db = createTestDb();
      await seedExam(db, neetSeedData);
      const now = new Date();
      await db.insert(users).values({
        id: "usr_auth_v1_mock",
        email: "v1mock@example.com",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(userWorkspaces).values({
        id: workspaceId,
        userId: "usr_auth_v1_mock",
        examAttemptId: "attempt_neet_2027",
        isActive: true,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    it("1. lists the authored sample mock alongside fixtures, with authored provenance", async () => {
      const mocks = await mockTestRepository.getMockTests(db, workspaceId);
      expect(mocks).toHaveLength(4); // 3 fixture + 1 authored

      const authored = mocks.find((m) => m.provenance === "authored");
      expect(authored).toBeDefined();
      expect(authored?.title).toContain("Sample Practice Mock");
      expect(authored?.totalQuestions).toBe(30);
      expect(authored?.durationMinutes).toBe(35);

      // Fixture mocks remain first and untouched
      expect(mocks[0].provenance).toBe("fixture");
    });

    it("2. is idempotent: repeated getMockTests never duplicates it", async () => {
      await mockTestRepository.getMockTests(db, workspaceId);
      await mockTestRepository.getMockTests(db, workspaceId);
      const mocks = await mockTestRepository.getMockTests(db, workspaceId);
      const authored = mocks.filter((m) => m.provenance === "authored");
      expect(authored).toHaveLength(1);
    });

    it("3. runs a mock session drawing 10 questions per subject from the authored bank", async () => {
      const mocks = await mockTestRepository.getMockTests(db, workspaceId);
      const authoredMock = mocks.find((m) => m.provenance === "authored")!;

      const session = await mockTestRepository.createSession(db, {
        workspaceId,
        mockTestId: authoredMock.id,
        seed: 42,
      });

      expect(session.questions).toHaveLength(30);
      const bySubject = new Map<string, number>();
      for (const q of session.questions) {
        bySubject.set(q.subjectId, (bySubject.get(q.subjectId) || 0) + 1);
        expect(q.status).toBe("active");
      }
      expect(bySubject.get(SUBJECT_PHYSICS)).toBe(10);
      expect(bySubject.get(SUBJECT_CHEMISTRY)).toBe(10);
      expect(bySubject.get(SUBJECT_BIOLOGY)).toBe(10);

      // The session draws predominantly from the authored bank (which dominates
      // the active pool) and never duplicates a question.
      const authoredCount = session.questions.filter((q) => q.provenance === "authored").length;
      expect(authoredCount).toBeGreaterThanOrEqual(15);
      const ids = session.questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(30);

      // Submit with one correct answer and verify scoring works end-to-end
      const q0 = session.questions[0];
      const correctOpt = q0.options.find((o) => o.isCorrect)!.id;
      const result = await mockTestRepository.submitSession(db, {
        workspaceId,
        sessionId: session.id,
        submissionStatus: "completed",
        answers: { [q0.id]: correctOpt },
      });
      expect(result.correct).toBe(1);
      expect(result.rawScore).toBe(4);
    });
  });

  describe("E. Guest Experience with Authored Questions", () => {
    let repos: ReturnType<typeof createGuestRepositories>;
    let workspace: UserWorkspace;

    beforeEach(async () => {
      repos = createGuestRepositories(new MemoryStorageAdapter());
      workspace = await repos.workspace.ensureWorkspaceForAttempt("attempt_neet_2027");
    });

    it("1. serves authored questions by topic, subject and mixed scope", async () => {
      const topicCount = await repos.question.countQuestionsForScope({
        scope: { type: "topic", topicId: T_ACCELERATED },
      });
      expect(topicCount).toBe(2);

      const physics = await repos.question.getQuestionsForScope({
        scope: { type: "subject", subjectId: SUBJECT_PHYSICS },
      });
      expect(physics.length).toBeGreaterThanOrEqual(50);
      expect(physics.filter((q) => q.provenance === "authored")).toHaveLength(50);

      const mixed = await repos.question.getQuestionsForScope({
        scope: { type: "mixed", examAttemptId: workspace.examAttemptId },
      });
      expect(mixed).toHaveLength(150 + FIXTURE_QUESTIONS.length);

      // Authored question retrievable by ID with normalized options
      const byId = await repos.question.getQuestionById("q_auth_phy_008");
      expect(byId).not.toBeNull();
      expect(byId?.options).toHaveLength(4);
      expect(byId?.options.filter((o) => o.isCorrect)).toHaveLength(1);
    });

    it("2. lists the authored sample mock and can run a session from it", async () => {
      const mocks = await repos.mock.getMockTests(workspace.id);
      expect(mocks).toHaveLength(4);

      const authoredMock = mocks.find((m) => m.provenance === "authored");
      expect(authoredMock).toBeDefined();

      const session = await repos.mock.createSession({
        workspaceId: workspace.id,
        mockTestId: authoredMock!.id,
        seed: 42,
      });
      expect(session.questions).toHaveLength(30);
      expect(new Set(session.questions.map((q) => q.id)).size).toBe(30);
    });

    it("3. records authored practice into Phase 9 progress and Phase 12 analytics", async () => {
      const scope: PracticeScope = { type: "topic", topicId: T_ACCELERATED };
      const session = await repos.questionSession.createSession({
        workspaceId: workspace.id,
        scope,
        questionCount: 5,
        options: { shuffle: false },
      });
      expect(session.totalQuestions).toBe(2);

      const answers: Record<string, string | null> = {};
      answers[session.questions[0].id] = session.questions[0].options.find((o) => o.isCorrect)!.id;
      answers[session.questions[1].id] = session.questions[1].options.find((o) => !o.isCorrect)!.id;

      const result = await repos.questionSession.submitSession({
        sessionId: session.id,
        workspaceId: workspace.id,
        durationSeconds: 90,
        answers,
      });
      expect(result.attempted).toBe(2);
      expect(result.correct).toBe(1);
      expect(result.accuracyBps).toBe(5000);

      // Phase 9 progress updated from authored questions
      const progress = await repos.progress.getProgress(workspace.id, T_ACCELERATED);
      expect(progress).not.toBeNull();
      expect(progress?.practiceAttempts).toBe(2);
      expect(progress?.correctAnswers).toBe(1);
      expect(progress?.accuracy).toBe(5000);

      // Phase 12 analytics reflect authored question activity
      const snapshot = await loadAnalyticsSnapshot(repos, workspace);
      expect(snapshot.questions.totals.questions).toBe(2);
      expect(snapshot.questions.totals.correct).toBe(1);
      const physics = snapshot.subjects.find((s) => s.subjectId === SUBJECT_PHYSICS);
      expect(physics?.hasData).toBe(true);
      expect(physics?.questionsAttempted).toBe(2);
    });

    it("4. keeps the Phase 8 revision queue working over authored practice", async () => {
      // Seed a scheduled revision for the topic (as the study flow would),
      // then run authored practice against it.
      const referenceDate = new Date();
      // Schedule the first revision for today so the topic sits in the due bucket.
      const scheduledFor = referenceDate;
      await repos.progress.upsertProgress({
        workspaceId: workspace.id,
        topicId: T_ACCELERATED,
        status: "learned",
        startedAt: new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000),
        learnedAt: new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000),
        nextRevisionAt: scheduledFor,
      });

      const scope: PracticeScope = { type: "topic", topicId: T_ACCELERATED };
      const session = await repos.questionSession.createSession({
        workspaceId: workspace.id,
        scope,
        questionCount: 2,
        options: { shuffle: false },
      });

      const answers: Record<string, string | null> = {};
      answers[session.questions[0].id] = session.questions[0].options.find((o) => o.isCorrect)!.id;

      await repos.questionSession.submitSession({
        sessionId: session.id,
        workspaceId: workspace.id,
        durationSeconds: 60,
        answers,
      });

      // Authored practice preserves the revision schedule and eligibility
      const progress = await repos.progress.getProgress(workspace.id, T_ACCELERATED);
      expect(progress).not.toBeNull();
      expect(progress?.status).toBe("learned");
      expect(progress?.nextRevisionAt).not.toBeNull();
      expect(progress?.practiceAttempts).toBe(1);

      const progressList = await repos.progress.getAllProgressForWorkspace(workspace.id);
      const revised = await repos.revision.getRevisionItems(workspace.id);
      expect(
        isRevisionEligible(
          progress!.status,
          progress!.nextRevisionAt,
          revised.find((r) => r.topicId === T_ACCELERATED) ?? null
        )
      ).toBe(true);

      const queueInput = {
        examAttemptId: workspace.examAttemptId,
        progressList,
        revisionItems: revised,
        referenceDate,
      };
      // The due queue still surfaces the topic after authored practice, with
      // topic metadata resolved from the canonical taxonomy.
      const due = getDueRevisions(queueInput);
      const entry = due.find((e) => e.topicId === T_ACCELERATED);
      expect(entry).toBeDefined();
      expect(entry?.topicName).toBeTruthy();
      expect(entry?.subjectName).toBe("Physics");
    });
  });
});
