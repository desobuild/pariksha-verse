import { eq, and, desc } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import {
  mockTests,
  mockTestSessions,
  mockTestResults,
  type MockTest,
  type MockSessionStatus,
} from "@/db/schema/mock-tests";
import {
  calculateMockResult,
  selectMockQuestions,
  createFixtureMocksForWorkspace,
  type MockTestDetail,
  type MockTestSessionDetail,
  type MockTestResultDetail,
  type MockMarkingScheme,
  type MockSectionConfig,
} from "@/domain/mock-engine";
import { questionRepository } from "./question.repository";
import { practiceRepository } from "./practice.repository";
import { topicProgressRepository } from "./progress.repository";
import { applyPracticeSessionToProgress } from "@/domain/practice";
import { getTopicMetadata } from "@/domain/dashboard";

/**
 * Server-side Mock Test & Exam Simulation repository (Cloudflare D1 via Drizzle).
 */
export const mockTestRepository = {
  /**
   * Parses raw DB MockTest into strongly typed MockTestDetail.
   */
  mapToMockDetail(row: MockTest): MockTestDetail {
    let markingScheme: MockMarkingScheme = {
      correctMarks: 4,
      incorrectPenalty: 1,
      unansweredMarks: 0,
    };
    if (row.markingScheme) {
      try {
        markingScheme = JSON.parse(row.markingScheme);
      } catch {
        // Fallback default
      }
    }

    let sections: MockSectionConfig[] = [];
    if (row.sections) {
      try {
        sections = JSON.parse(row.sections);
      } catch {
        // Fallback empty
      }
    }

    let questionSelectionConfig = null;
    if (row.questionSelectionConfig) {
      try {
        questionSelectionConfig = JSON.parse(row.questionSelectionConfig);
      } catch {
        // Fallback null
      }
    }

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      examId: row.examId,
      title: row.title,
      description: row.description,
      type: row.type,
      scheduledAt: row.scheduledAt,
      durationMinutes: row.durationMinutes,
      totalQuestions: row.totalQuestions,
      markingScheme,
      sections,
      questionSelectionConfig,
      source: row.source,
      externalUrl: row.externalUrl,
      provenance: row.provenance as MockTestDetail["provenance"],
      status: row.status as MockTestDetail["status"],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },

  /**
   * Ensures fixture mock tests exist for a given workspace.
   */
  async ensureFixtureMocksSeeded(
    db: DatabaseInstance,
    workspaceId: string
  ): Promise<MockTestDetail[]> {
    const existing = await db
      .select()
      .from(mockTests)
      .where(eq(mockTests.workspaceId, workspaceId));

    if (existing.length > 0) {
      return existing.map((row) => this.mapToMockDetail(row));
    }

    const fixtures = createFixtureMocksForWorkspace(workspaceId);
    for (const f of fixtures) {
      await db.insert(mockTests).values({
        id: f.id,
        workspaceId: f.workspaceId,
        examId: f.examId ?? null,
        title: f.title,
        description: f.description,
        type: f.type,
        scheduledAt: f.scheduledAt ?? null,
        durationMinutes: f.durationMinutes,
        totalQuestions: f.totalQuestions,
        markingScheme: JSON.stringify(f.markingScheme),
        sections: JSON.stringify(f.sections),
        questionSelectionConfig: f.questionSelectionConfig
          ? JSON.stringify(f.questionSelectionConfig)
          : null,
        source: f.source,
        externalUrl: f.externalUrl,
        provenance: f.provenance,
        status: f.status,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      });
    }

    return fixtures;
  },

  /**
   * Retrieves all mock tests for a workspace.
   */
  async getMockTests(
    db: DatabaseInstance,
    workspaceId: string
  ): Promise<MockTestDetail[]> {
    return this.ensureFixtureMocksSeeded(db, workspaceId);
  },

  /**
   * Retrieves a single mock test by ID.
   */
  async getMockTestById(
    db: DatabaseInstance,
    id: string,
    workspaceId: string
  ): Promise<MockTestDetail | null> {
    const rows = await db
      .select()
      .from(mockTests)
      .where(and(eq(mockTests.id, id), eq(mockTests.workspaceId, workspaceId)))
      .limit(1);

    if (!rows[0]) return null;
    return this.mapToMockDetail(rows[0]);
  },

  /**
   * Creates or returns an active mock test session.
   */
  async createSession(
    db: DatabaseInstance,
    params: { workspaceId: string; mockTestId: string; seed?: number }
  ): Promise<MockTestSessionDetail> {
    const { workspaceId, mockTestId, seed = 42 } = params;

    const mock = await this.getMockTestById(db, mockTestId, workspaceId);
    if (!mock) {
      throw new Error(`Mock test ${mockTestId} not found in workspace`);
    }

    // Check if an unexpired in-progress session already exists
    const existing = await db
      .select()
      .from(mockTestSessions)
      .where(
        and(
          eq(mockTestSessions.workspaceId, workspaceId),
          eq(mockTestSessions.mockTestId, mockTestId),
          eq(mockTestSessions.status, "in_progress")
        )
      )
      .orderBy(desc(mockTestSessions.createdAt))
      .limit(1);

    if (existing[0]) {
      const sess = existing[0];
      // Check if expired
      if (Date.now() < sess.expiresAt.getTime()) {
        const fullSession = await this.getSession(db, sess.id, workspaceId);
        if (fullSession) return fullSession;
      }
    }

    // Ensure fixture questions exist in bank
    await questionRepository.ensureFixtureQuestionsSeeded(db);

    const allQuestions = await questionRepository.getAllQuestions(db);
    const selectedQuestions = selectMockQuestions(allQuestions, mock, seed);

    const sessionId = `sess_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const durationSeconds = mock.durationMinutes * 60;
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000);

    const questionIds = selectedQuestions.map((q) => q.id);

    await db.insert(mockTestSessions).values({
      id: sessionId,
      mockTestId,
      workspaceId,
      status: "in_progress",
      questionIds: JSON.stringify(questionIds),
      selectedAnswers: JSON.stringify({}),
      markedForReview: JSON.stringify([]),
      currentIndex: 0,
      durationSeconds,
      startedAt: now,
      expiresAt,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: sessionId,
      mockTestId,
      workspaceId,
      status: "in_progress",
      questionIds,
      selectedAnswers: {},
      markedForReview: [],
      currentIndex: 0,
      durationSeconds,
      startedAt: now,
      expiresAt,
      completedAt: null,
      questions: selectedQuestions,
      mockTest: mock,
    };
  },

  /**
   * Retrieves an active or completed session. Auto-submits if time has expired.
   */
  async getSession(
    db: DatabaseInstance,
    sessionId: string,
    workspaceId: string
  ): Promise<MockTestSessionDetail | null> {
    const rows = await db
      .select()
      .from(mockTestSessions)
      .where(
        and(
          eq(mockTestSessions.id, sessionId),
          eq(mockTestSessions.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!rows[0]) return null;
    const sess = rows[0];

    const mock = await this.getMockTestById(db, sess.mockTestId, workspaceId);
    if (!mock) return null;

    // Check expiry for in_progress session
    if (sess.status === "in_progress" && Date.now() >= sess.expiresAt.getTime()) {
      await this.submitSession(db, {
        workspaceId,
        sessionId,
        submissionStatus: "auto_submitted",
        completedAt: sess.expiresAt,
      });

      // Reload
      return this.getSession(db, sessionId, workspaceId);
    }

    const questionIds: string[] = JSON.parse(sess.questionIds || "[]");
    const selectedAnswers: Record<string, string | null> = JSON.parse(
      sess.selectedAnswers || "{}"
    );
    const markedForReview: string[] = JSON.parse(sess.markedForReview || "[]");

    const questions = [];
    for (const qid of questionIds) {
      const q = await questionRepository.getQuestionById(db, qid);
      if (q) questions.push(q);
    }

    return {
      id: sess.id,
      mockTestId: sess.mockTestId,
      workspaceId: sess.workspaceId,
      status: sess.status as MockSessionStatus,
      questionIds,
      selectedAnswers,
      markedForReview,
      currentIndex: sess.currentIndex,
      durationSeconds: sess.durationSeconds,
      startedAt: sess.startedAt,
      expiresAt: sess.expiresAt,
      completedAt: sess.completedAt,
      questions,
      mockTest: mock,
    };
  },

  /**
   * Updates answer, marked-for-review state, or current index in an active session.
   */
  async updateSessionAnswer(
    db: DatabaseInstance,
    params: {
      workspaceId: string;
      sessionId: string;
      questionId: string;
      selectedOptionId?: string | null;
      isMarkedForReview?: boolean;
      currentIndex?: number;
    }
  ): Promise<void> {
    const {
      workspaceId,
      sessionId,
      questionId,
      selectedOptionId,
      isMarkedForReview,
      currentIndex,
    } = params;

    const rows = await db
      .select()
      .from(mockTestSessions)
      .where(
        and(
          eq(mockTestSessions.id, sessionId),
          eq(mockTestSessions.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!rows[0] || rows[0].status !== "in_progress") return;
    const sess = rows[0];

    // Check expiry
    if (Date.now() >= sess.expiresAt.getTime()) {
      await this.submitSession(db, {
        workspaceId,
        sessionId,
        submissionStatus: "auto_submitted",
        completedAt: sess.expiresAt,
      });
      return;
    }

    const selectedAnswers: Record<string, string | null> = JSON.parse(
      sess.selectedAnswers || "{}"
    );
    const markedForReview: string[] = JSON.parse(sess.markedForReview || "[]");

    if (selectedOptionId !== undefined) {
      selectedAnswers[questionId] = selectedOptionId;
    }

    if (isMarkedForReview !== undefined) {
      const index = markedForReview.indexOf(questionId);
      if (isMarkedForReview && index === -1) {
        markedForReview.push(questionId);
      } else if (!isMarkedForReview && index !== -1) {
        markedForReview.splice(index, 1);
      }
    }

    await db
      .update(mockTestSessions)
      .set({
        selectedAnswers: JSON.stringify(selectedAnswers),
        markedForReview: JSON.stringify(markedForReview),
        currentIndex: currentIndex !== undefined ? currentIndex : sess.currentIndex,
        updatedAt: new Date(),
      })
      .where(eq(mockTestSessions.id, sessionId));
  },

  /**
   * Submits a mock test session authoritatively.
   * Grades questions, updates session status, stores MockTestResult,
   * and updates Phase 9 topic performance progress.
   */
  async submitSession(
    db: DatabaseInstance,
    params: {
      workspaceId: string;
      sessionId: string;
      submissionStatus?: "completed" | "auto_submitted";
      answers?: Record<string, string | null>;
      markedForReview?: string[];
      completedAt?: Date;
    }
  ): Promise<MockTestResultDetail> {
    const {
      workspaceId,
      sessionId,
      submissionStatus = "completed",
      answers,
      markedForReview,
      completedAt = new Date(),
    } = params;

    const rows = await db
      .select()
      .from(mockTestSessions)
      .where(
        and(
          eq(mockTestSessions.id, sessionId),
          eq(mockTestSessions.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!rows[0]) {
      throw new Error(`Mock test session ${sessionId} not found`);
    }
    const sess = rows[0];

    // If already submitted, return existing result
    if (sess.status === "completed" || sess.status === "auto_submitted") {
      const existingRes = await this.getResultBySessionId(db, sessionId, workspaceId);
      if (existingRes) return existingRes;
    }

    const mock = await this.getMockTestById(db, sess.mockTestId, workspaceId);
    if (!mock) {
      throw new Error(`Mock test ${sess.mockTestId} not found`);
    }

    const questionIds: string[] = JSON.parse(sess.questionIds || "[]");
    const storedAnswers: Record<string, string | null> = JSON.parse(
      sess.selectedAnswers || "{}"
    );
    const storedMarked: string[] = JSON.parse(sess.markedForReview || "[]");

    const effectiveAnswers = { ...storedAnswers, ...(answers || {}) };
    const effectiveMarked = markedForReview || storedMarked;

    const questions = [];
    for (const qid of questionIds) {
      const q = await questionRepository.getQuestionById(db, qid);
      if (q) questions.push(q);
    }

    // Authoritative grading
    const result = calculateMockResult({
      mockTest: mock,
      sessionId,
      workspaceId,
      questions,
      answers: effectiveAnswers,
      markedForReview: effectiveMarked,
      startedAt: sess.startedAt,
      completedAt,
      submissionStatus,
      metadataResolver: (topicId) => getTopicMetadata(topicId),
    });

    // 1. Update session status
    await db
      .update(mockTestSessions)
      .set({
        status: submissionStatus,
        selectedAnswers: JSON.stringify(effectiveAnswers),
        markedForReview: JSON.stringify(effectiveMarked),
        completedAt: result.completedAt,
        updatedAt: result.completedAt,
      })
      .where(eq(mockTestSessions.id, sessionId));

    // 2. Persist MockTestResult
    const resultId = `res_${sessionId}`;
    await db.insert(mockTestResults).values({
      id: resultId,
      mockTestId: mock.id,
      sessionId,
      score: result.rawScore,
      totalMarks: result.totalMarks,
      correct: result.correct,
      incorrect: result.incorrect,
      unattempted: result.unattempted,
      accuracy: result.accuracy,
      timeSpentSeconds: result.timeSpentSeconds,
      submissionStatus: result.submissionStatus,
      sectionResults: JSON.stringify(result.sections),
      questionResults: JSON.stringify(result.questions),
      completedAt: result.completedAt,
      notes: null,
      createdAt: result.completedAt,
      updatedAt: result.completedAt,
    });

    // 3. Integrate with Phase 9 Practice Performance & Progress
    const topicStatsMap = new Map<
      string,
      { attempted: number; correct: number; incorrect: number }
    >();

    for (const item of result.questions) {
      if (item.isAttempted) {
        const cur = topicStatsMap.get(item.topicId) || {
          attempted: 0,
          correct: 0,
          incorrect: 0,
        };
        cur.attempted++;
        if (item.isCorrect) cur.correct++;
        else cur.incorrect++;
        topicStatsMap.set(item.topicId, cur);
      }
    }

    for (const [topicId, stats] of topicStatsMap.entries()) {
      if (stats.attempted > 0) {
        const newPracSession = await practiceRepository.createPracticeSession(db, {
          workspaceId,
          topicId,
          questionCount: stats.attempted,
          correct: stats.correct,
          incorrect: stats.incorrect,
          unattempted: 0,
          durationMinutes: Math.max(1, Math.round(result.timeSpentSeconds / 60)),
          completedAt: result.completedAt,
        });

        const [existingProgress, allTopicSessions] = await Promise.all([
          topicProgressRepository.getTopicProgress(db, workspaceId, topicId),
          practiceRepository.getSessionsForTopicId(db, workspaceId, topicId),
        ]);

        if (!allTopicSessions.some((s) => s.id === newPracSession.id)) {
          allTopicSessions.push(newPracSession);
        }

        const progressPatch = applyPracticeSessionToProgress({
          workspaceId,
          topicId,
          existingProgress,
          sessions: allTopicSessions,
          completedAt: result.completedAt,
        });

        await topicProgressRepository.upsertTopicProgress(db, progressPatch);
      }
    }

    return result;
  },

  /**
   * Retrieves evaluated result by session ID.
   */
  async getResultBySessionId(
    db: DatabaseInstance,
    sessionId: string,
    workspaceId: string
  ): Promise<MockTestResultDetail | null> {
    const rows = await db
      .select()
      .from(mockTestResults)
      .where(eq(mockTestResults.sessionId, sessionId))
      .limit(1);

    if (!rows[0]) return null;
    const r = rows[0];

    const mock = await this.getMockTestById(db, r.mockTestId, workspaceId);
    const mockTitle = mock?.title || "Mock Test";

    const sections = r.sectionResults ? JSON.parse(r.sectionResults) : [];
    const questions = r.questionResults ? JSON.parse(r.questionResults) : [];

    const attempted = r.correct + r.incorrect;
    const totalQuestions = attempted + r.unattempted;

    return {
      id: r.id,
      mockTestId: r.mockTestId,
      sessionId: r.sessionId,
      workspaceId,
      mockTitle,
      rawScore: r.score,
      totalMarks: r.totalMarks,
      totalQuestions,
      attempted,
      correct: r.correct,
      incorrect: r.incorrect,
      unattempted: r.unattempted,
      markedForReviewCount: questions.filter(
        (q: { isMarkedForReview?: boolean }) => q.isMarkedForReview
      ).length,
      accuracy: r.accuracy,
      accuracyPct: Math.round(r.accuracy / 100),
      timeSpentSeconds: r.timeSpentSeconds,
      submissionStatus: r.submissionStatus as "completed" | "auto_submitted",
      completedAt: r.completedAt,
      notes: r.notes,
      sections,
      questions,
    };
  },

  /**
   * Retrieves all completed results for a workspace.
   */
  async getAllResultsForWorkspace(
    db: DatabaseInstance,
    workspaceId: string
  ): Promise<MockTestResultDetail[]> {
    const tests = await this.getMockTests(db, workspaceId);
    const testIds = tests.map((t) => t.id);
    if (testIds.length === 0) return [];

    const rows = await db
      .select()
      .from(mockTestResults)
      .orderBy(desc(mockTestResults.completedAt));

    const matching = rows.filter((r) => testIds.includes(r.mockTestId));
    const testMap = new Map(tests.map((t) => [t.id, t.title]));

    return matching.map((r) => {
      const sections = r.sectionResults ? JSON.parse(r.sectionResults) : [];
      const questions = r.questionResults ? JSON.parse(r.questionResults) : [];
      const attempted = r.correct + r.incorrect;
      const totalQuestions = attempted + r.unattempted;

      return {
        id: r.id,
        mockTestId: r.mockTestId,
        sessionId: r.sessionId,
        workspaceId,
        mockTitle: testMap.get(r.mockTestId) || "Mock Test",
        rawScore: r.score,
        totalMarks: r.totalMarks,
        totalQuestions,
        attempted,
        correct: r.correct,
        incorrect: r.incorrect,
        unattempted: r.unattempted,
        markedForReviewCount: questions.filter(
          (q: { isMarkedForReview?: boolean }) => q.isMarkedForReview
        ).length,
        accuracy: r.accuracy,
        accuracyPct: Math.round(r.accuracy / 100),
        timeSpentSeconds: r.timeSpentSeconds,
        submissionStatus: r.submissionStatus as "completed" | "auto_submitted",
        completedAt: r.completedAt,
        notes: r.notes,
        sections,
        questions,
      };
    });
  },
};
