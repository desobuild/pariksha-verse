import { eq, and, desc, asc, inArray } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import {
  questions,
  questionOptions,
  questionSessions,
  questionAttempts,
  type QuestionOption,
} from "@/db/schema";
import {
  FIXTURE_QUESTIONS,
  filterQuestionsByScope,
  selectQuestionsForSession,
  gradeQuestionSession,
  type QuestionWithOptions,
  type PracticeScope,
  type CreateQuestionSessionInput,
  type QuestionSessionWithAttempts,
  type QuestionSessionResult,
  type QuestionAttemptDetail,
} from "@/domain/practice-engine";
import { AUTHORED_QUESTIONS } from "@/data/questions/neet-authored";
import { practiceRepository } from "./practice.repository";
import { topicProgressRepository } from "./progress.repository";
import { applyPracticeSessionToProgress } from "@/domain/practice";
import { getTopicMetadata } from "@/domain/dashboard";

/**
 * Server-side question bank and practice engine persistence (D1 via Drizzle).
 */

/**
 * Per-database memo so the authored bank is checked once per process/database
 * instead of on every question query. WeakMap keeps test databases isolated.
 */
const authoredSeededDatabases = new WeakMap<object, boolean>();

export const questionRepository = {
  /**
   * Ensures fixture questions are seeded into the database if questions table is empty.
   */
  async ensureFixtureQuestionsSeeded(db: DatabaseInstance): Promise<void> {
    const existing = await db.select({ id: questions.id }).from(questions).limit(1);
    if (existing.length > 0) return;

    for (const q of FIXTURE_QUESTIONS) {
      await this.insertQuestionWithOptions(db, q);
    }
  },

  /**
   * Ensures the canonical AUTHORED (production) question bank is present in the
   * database. Idempotent: stable question/option IDs plus ON CONFLICT DO NOTHING
   * mean repeated calls and repeated seeds never duplicate or corrupt records,
   * and only genuinely missing questions are inserted.
   */
  async ensureAuthoredQuestionsSeeded(db: DatabaseInstance): Promise<void> {
    if (authoredSeededDatabases.has(db)) return;

    const existingAuthored = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.provenance, "authored"));
    const existingIds = new Set(existingAuthored.map((row) => row.id));

    const missing = AUTHORED_QUESTIONS.filter((q) => !existingIds.has(q.id));
    for (const q of missing) {
      await this.insertQuestionWithOptions(db, q);
    }

    authoredSeededDatabases.set(db, true);
  },

  /**
   * Inserts a single question with its normalized options. Stable IDs plus
   * ON CONFLICT DO NOTHING make repeated inserts no-ops instead of errors.
   */
  async insertQuestionWithOptions(db: DatabaseInstance, q: QuestionWithOptions): Promise<void> {
    await db
      .insert(questions)
      .values({
        id: q.id,
        examId: q.examId,
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        topicId: q.topicId,
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        explanation: q.explanation,
        source: q.source,
        sourceUrl: q.sourceUrl,
        attribution: q.attribution,
        license: q.license,
        externalId: q.externalId,
        year: q.year,
        provenance: q.provenance,
        status: q.status,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      })
      .onConflictDoNothing();

    for (const opt of q.options) {
      await db
        .insert(questionOptions)
        .values({
          id: opt.id,
          questionId: opt.questionId,
          displayOrder: opt.displayOrder,
          optionKey: opt.optionKey,
          text: opt.text,
          isCorrect: Boolean(opt.isCorrect),
        })
        .onConflictDoNothing();
    }
  },

  /**
   * Fetches a question with its normalized options.
   */
  async getQuestionById(db: DatabaseInstance, id: string): Promise<QuestionWithOptions | null> {
    const qRows = await db.select().from(questions).where(eq(questions.id, id)).limit(1);

    if (!qRows[0]) return null;
    const q = qRows[0];

    const optRows = await db
      .select()
      .from(questionOptions)
      .where(eq(questionOptions.questionId, q.id))
      .orderBy(asc(questionOptions.displayOrder));

    return {
      ...q,
      options: optRows.map((opt) => ({
        id: opt.id,
        questionId: opt.questionId,
        displayOrder: opt.displayOrder,
        optionKey: opt.optionKey,
        text: opt.text,
        isCorrect: opt.isCorrect,
      })),
      createdAt: new Date(q.createdAt),
      updatedAt: new Date(q.updatedAt),
    };
  },

  /**
   * Fetches all active questions with options.
   */
  async getAllQuestions(db: DatabaseInstance): Promise<QuestionWithOptions[]> {
    await this.ensureFixtureQuestionsSeeded(db);
    await this.ensureAuthoredQuestionsSeeded(db);

    const qRows = await db.select().from(questions).where(eq(questions.status, "active"));

    if (qRows.length === 0) return [];

    const questionIds = qRows.map((q) => q.id);
    const optRows = await db
      .select()
      .from(questionOptions)
      .where(inArray(questionOptions.questionId, questionIds))
      .orderBy(asc(questionOptions.displayOrder));

    const optionsByQ = new Map<string, QuestionOption[]>();
    for (const opt of optRows) {
      const list = optionsByQ.get(opt.questionId) || [];
      list.push(opt);
      optionsByQ.set(opt.questionId, list);
    }

    return qRows.map((q) => ({
      ...q,
      options: (optionsByQ.get(q.id) || []).map((opt) => ({
        id: opt.id,
        questionId: opt.questionId,
        displayOrder: opt.displayOrder,
        optionKey: opt.optionKey,
        text: opt.text,
        isCorrect: opt.isCorrect,
      })),
      createdAt: new Date(q.createdAt),
      updatedAt: new Date(q.updatedAt),
    }));
  },

  /**
   * Fetches active questions matching a specific scope.
   */
  async getQuestionsForScope(
    db: DatabaseInstance,
    params: { examId?: string; scope: PracticeScope; limit?: number }
  ): Promise<QuestionWithOptions[]> {
    const all = await this.getAllQuestions(db);
    const filtered = filterQuestionsByScope(all, params.scope, params.examId);
    if (params.limit !== undefined && params.limit > 0) {
      return filtered.slice(0, params.limit);
    }
    return filtered;
  },

  /**
   * Counts active questions matching a scope.
   */
  async countQuestionsForScope(
    db: DatabaseInstance,
    params: { examId?: string; scope: PracticeScope }
  ): Promise<number> {
    const questions = await this.getQuestionsForScope(db, params);
    return questions.length;
  },

  /**
   * Creates a question session with selected questions and initialized attempts.
   */
  async createSession(
    db: DatabaseInstance,
    input: CreateQuestionSessionInput
  ): Promise<QuestionSessionWithAttempts> {
    await this.ensureFixtureQuestionsSeeded(db);
    await this.ensureAuthoredQuestionsSeeded(db);

    const all = await this.getAllQuestions(db);
    const eligible = filterQuestionsByScope(all, input.scope);
    const selected = selectQuestionsForSession(eligible, input.questionCount, {
      seed: input.options?.seed,
      shuffle: input.options?.shuffle,
    });

    const sessionId = `q_sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();

    const scopeId =
      input.scope.type === "topic"
        ? input.scope.topicId
        : input.scope.type === "subject"
          ? input.scope.subjectId
          : input.scope.examAttemptId;

    // 1. Insert session
    const [createdSession] = await db
      .insert(questionSessions)
      .values({
        id: sessionId,
        workspaceId: input.workspaceId,
        scopeType: input.scope.type,
        scopeId,
        totalQuestions: selected.length,
        status: "in_progress",
        durationSeconds: 0,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // 2. Insert attempt rows
    const attemptDetails: QuestionAttemptDetail[] = [];
    for (let i = 0; i < selected.length; i++) {
      const q = selected[i];
      const attemptId = `q_att_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      const [att] = await db
        .insert(questionAttempts)
        .values({
          id: attemptId,
          sessionId,
          questionId: q.id,
          selectedOptionId: null,
          isCorrect: null,
          displayOrder: i + 1,
          answeredAt: null,
        })
        .returning();

      attemptDetails.push({
        id: att.id,
        sessionId: att.sessionId,
        questionId: att.questionId,
        selectedOptionId: att.selectedOptionId,
        isCorrect: att.isCorrect,
        displayOrder: att.displayOrder,
        answeredAt: att.answeredAt ? new Date(att.answeredAt) : null,
      });
    }

    return {
      id: createdSession.id,
      workspaceId: createdSession.workspaceId,
      scopeType: createdSession.scopeType as QuestionSessionWithAttempts["scopeType"],
      scopeId: createdSession.scopeId,
      totalQuestions: createdSession.totalQuestions,
      status: createdSession.status as QuestionSessionWithAttempts["status"],
      durationSeconds: createdSession.durationSeconds,
      startedAt: new Date(createdSession.startedAt),
      completedAt: createdSession.completedAt ? new Date(createdSession.completedAt) : null,
      questions: selected,
      attempts: attemptDetails,
    };
  },

  /**
   * Retrieves a question session with questions and attempts.
   */
  async getSession(
    db: DatabaseInstance,
    sessionId: string,
    workspaceId: string
  ): Promise<QuestionSessionWithAttempts | null> {
    const sessRows = await db
      .select()
      .from(questionSessions)
      .where(and(eq(questionSessions.id, sessionId), eq(questionSessions.workspaceId, workspaceId)))
      .limit(1);

    if (!sessRows[0]) return null;
    const sess = sessRows[0];

    // Fetch attempts
    const attRows = await db
      .select()
      .from(questionAttempts)
      .where(eq(questionAttempts.sessionId, sess.id))
      .orderBy(asc(questionAttempts.displayOrder));

    // Fetch questions
    const questionIds = attRows.map((a) => a.questionId);
    let questionList: QuestionWithOptions[] = [];
    if (questionIds.length > 0) {
      const qRows = await db.select().from(questions).where(inArray(questions.id, questionIds));

      const optRows = await db
        .select()
        .from(questionOptions)
        .where(inArray(questionOptions.questionId, questionIds))
        .orderBy(asc(questionOptions.displayOrder));

      const optionsByQ = new Map<string, QuestionOption[]>();
      for (const opt of optRows) {
        const list = optionsByQ.get(opt.questionId) || [];
        list.push(opt);
        optionsByQ.set(opt.questionId, list);
      }

      const qMap = new Map<string, QuestionWithOptions>();
      for (const q of qRows) {
        qMap.set(q.id, {
          ...q,
          options: (optionsByQ.get(q.id) || []).map((opt) => ({
            id: opt.id,
            questionId: opt.questionId,
            displayOrder: opt.displayOrder,
            optionKey: opt.optionKey,
            text: opt.text,
            isCorrect: opt.isCorrect,
          })),
          createdAt: new Date(q.createdAt),
          updatedAt: new Date(q.updatedAt),
        });
      }

      // Preserve order matching attempts
      questionList = questionIds
        .map((qid) => qMap.get(qid))
        .filter((q): q is QuestionWithOptions => q !== undefined);
    }

    return {
      id: sess.id,
      workspaceId: sess.workspaceId,
      scopeType: sess.scopeType as QuestionSessionWithAttempts["scopeType"],
      scopeId: sess.scopeId,
      totalQuestions: sess.totalQuestions,
      status: sess.status as QuestionSessionWithAttempts["status"],
      durationSeconds: sess.durationSeconds,
      startedAt: new Date(sess.startedAt),
      completedAt: sess.completedAt ? new Date(sess.completedAt) : null,
      questions: questionList,
      attempts: attRows.map((att) => ({
        id: att.id,
        sessionId: att.sessionId,
        questionId: att.questionId,
        selectedOptionId: att.selectedOptionId,
        isCorrect: att.isCorrect,
        displayOrder: att.displayOrder,
        answeredAt: att.answeredAt ? new Date(att.answeredAt) : null,
      })),
    };
  },

  /**
   * Updates answer for a specific question attempt.
   */
  async recordAnswer(
    db: DatabaseInstance,
    params: {
      sessionId: string;
      workspaceId: string;
      questionId: string;
      selectedOptionId: string | null;
    }
  ): Promise<void> {
    const sess = await this.getSession(db, params.sessionId, params.workspaceId);
    if (!sess || sess.status === "completed") {
      throw new Error("Session not found or already completed");
    }

    const now = new Date();
    await db
      .update(questionAttempts)
      .set({
        selectedOptionId: params.selectedOptionId,
        answeredAt: params.selectedOptionId ? now : null,
      })
      .where(
        and(
          eq(questionAttempts.sessionId, params.sessionId),
          eq(questionAttempts.questionId, params.questionId)
        )
      );
  },

  /**
   * Authoritatively evaluates and submits a question session,
   * updates attempts, marks session completed, and syncs performance with Phase 9.
   */
  async submitSession(
    db: DatabaseInstance,
    params: {
      sessionId: string;
      workspaceId: string;
      durationSeconds?: number;
      answers?: Record<string, string | null>;
    }
  ): Promise<QuestionSessionResult> {
    const session = await this.getSession(db, params.sessionId, params.workspaceId);
    if (!session) {
      throw new Error("Question session not found");
    }

    const completedAt = new Date();
    const durationSeconds = params.durationSeconds ?? session.durationSeconds;

    // Collect effective answers
    const answersMap: Record<string, string | null> = {};
    for (const att of session.attempts) {
      answersMap[att.questionId] = att.selectedOptionId;
    }
    if (params.answers) {
      for (const [qid, optId] of Object.entries(params.answers)) {
        answersMap[qid] = optId;
      }
    }

    // Authoritative grading
    const result = gradeQuestionSession({
      sessionId: session.id,
      workspaceId: session.workspaceId,
      scopeType: session.scopeType,
      scopeId: session.scopeId,
      questions: session.questions,
      answers: answersMap,
      durationSeconds,
      completedAt,
      metadataResolver: (topicId) => getTopicMetadata(topicId),
    });

    // 1. Update attempt records with authoritative results
    for (const item of result.questions) {
      await db
        .update(questionAttempts)
        .set({
          selectedOptionId: item.selectedOptionId,
          isCorrect: item.isAttempted ? item.isCorrect : null,
          answeredAt: item.isAttempted ? completedAt : null,
        })
        .where(
          and(
            eq(questionAttempts.sessionId, session.id),
            eq(questionAttempts.questionId, item.questionId)
          )
        );
    }

    // 2. Mark session completed
    await db
      .update(questionSessions)
      .set({
        status: "completed",
        durationSeconds,
        completedAt,
        updatedAt: completedAt,
      })
      .where(eq(questionSessions.id, session.id));

    // 3. Integrate with Phase 9 Practice Performance
    // Group questions by topicId to update topic progress accurately
    const questionsByTopic = new Map<
      string,
      { attempted: number; correct: number; incorrect: number }
    >();

    for (const q of result.questions) {
      const current = questionsByTopic.get(q.topicId) || { attempted: 0, correct: 0, incorrect: 0 };
      if (q.isAttempted) {
        current.attempted++;
        if (q.isCorrect) {
          current.correct++;
        } else {
          current.incorrect++;
        }
      }
      questionsByTopic.set(q.topicId, current);
    }

    // For each topic practiced:
    for (const [topicId, stats] of questionsByTopic.entries()) {
      if (stats.attempted > 0) {
        // Create practice_sessions record
        const newPracSession = await practiceRepository.createPracticeSession(db, {
          workspaceId: session.workspaceId,
          topicId,
          questionCount: stats.attempted,
          correct: stats.correct,
          incorrect: stats.incorrect,
          unattempted: 0,
          durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
          completedAt,
        });

        // Sync with user_topic_progress
        const [existingProgress, allTopicSessions] = await Promise.all([
          topicProgressRepository.getTopicProgress(db, session.workspaceId, topicId),
          practiceRepository.getSessionsForTopicId(db, session.workspaceId, topicId),
        ]);

        if (!allTopicSessions.some((s) => s.id === newPracSession.id)) {
          allTopicSessions.push(newPracSession);
        }

        const progressPatch = applyPracticeSessionToProgress({
          workspaceId: session.workspaceId,
          topicId,
          existingProgress,
          sessions: allTopicSessions,
          completedAt,
        });

        await topicProgressRepository.upsertTopicProgress(db, progressPatch);
      }
    }

    return result;
  },

  /**
   * Fetches recent sessions for a workspace.
   */
  async getRecentQuestionSessions(
    db: DatabaseInstance,
    workspaceId: string
  ): Promise<QuestionSessionWithAttempts[]> {
    const rows = await db
      .select()
      .from(questionSessions)
      .where(eq(questionSessions.workspaceId, workspaceId))
      .orderBy(desc(questionSessions.createdAt))
      .limit(10);

    const results: QuestionSessionWithAttempts[] = [];
    for (const r of rows) {
      const sess = await this.getSession(db, r.id, workspaceId);
      if (sess) results.push(sess);
    }
    return results;
  },
};
