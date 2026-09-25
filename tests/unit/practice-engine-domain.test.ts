import { describe, it, expect } from "vitest";
import {
  filterQuestionsByScope,
  selectQuestionsForSession,
  gradeQuestionSession,
  FIXTURE_QUESTIONS,
  createQuestionSessionSchema,
  recordAnswerSchema,
  submitQuestionSessionSchema,
  type QuestionWithOptions,
  type PracticeScope,
} from "@/domain/practice-engine";

describe("Phase 10: Practice Engine Domain & Algorithms", () => {
  describe("1. Validation Schemas", () => {
    it("validates topic practice scope correctly", () => {
      const valid = createQuestionSessionSchema.safeParse({
        workspaceId: "ws_test",
        scope: { type: "topic", topicId: "exam_neet_physics_kinematics_vectors-and-scalars" },
        questionCount: 10,
      });
      expect(valid.success).toBe(true);
    });

    it("validates subject practice scope correctly", () => {
      const valid = createQuestionSessionSchema.safeParse({
        workspaceId: "ws_test",
        scope: { type: "subject", subjectId: "exam_neet_physics" },
        questionCount: 20,
      });
      expect(valid.success).toBe(true);
    });

    it("validates mixed practice scope correctly", () => {
      const valid = createQuestionSessionSchema.safeParse({
        workspaceId: "ws_test",
        scope: { type: "mixed", examAttemptId: "attempt_neet_2027" },
        questionCount: 5,
      });
      expect(valid.success).toBe(true);
    });

    it("rejects invalid question counts (< 1 or > 50)", () => {
      const tooLow = createQuestionSessionSchema.safeParse({
        workspaceId: "ws_test",
        scope: { type: "mixed", examAttemptId: "attempt_neet_2027" },
        questionCount: 0,
      });
      expect(tooLow.success).toBe(false);

      const tooHigh = createQuestionSessionSchema.safeParse({
        workspaceId: "ws_test",
        scope: { type: "mixed", examAttemptId: "attempt_neet_2027" },
        questionCount: 100,
      });
      expect(tooHigh.success).toBe(false);
    });

    it("validates answer recording input", () => {
      const valid = recordAnswerSchema.safeParse({
        workspaceId: "ws_test",
        sessionId: "sess_1",
        questionId: "q_1",
        selectedOptionId: "opt_1",
      });
      expect(valid.success).toBe(true);

      const clearChoice = recordAnswerSchema.safeParse({
        workspaceId: "ws_test",
        sessionId: "sess_1",
        questionId: "q_1",
        selectedOptionId: null,
      });
      expect(clearChoice.success).toBe(true);
    });

    it("validates session submission payload", () => {
      const valid = submitQuestionSessionSchema.safeParse({
        workspaceId: "ws_test",
        sessionId: "sess_1",
        durationSeconds: 120,
        answers: { q_1: "opt_a", q_2: null },
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("2. Scope Filtering", () => {
    it("filters questions strictly by topic", () => {
      const topicScope: PracticeScope = {
        type: "topic",
        topicId: "exam_neet_physics_kinematics_vectors-and-scalars",
      };
      const filtered = filterQuestionsByScope(FIXTURE_QUESTIONS, topicScope);
      expect(filtered.length).toBeGreaterThan(0);
      for (const q of filtered) {
        expect(q.topicId).toBe(topicScope.topicId);
        expect(q.status).toBe("active");
      }
    });

    it("filters questions strictly by subject", () => {
      const subjectScope: PracticeScope = {
        type: "subject",
        subjectId: "exam_neet_physics",
      };
      const filtered = filterQuestionsByScope(FIXTURE_QUESTIONS, subjectScope);
      expect(filtered.length).toBeGreaterThan(0);
      for (const q of filtered) {
        expect(q.subjectId).toBe(subjectScope.subjectId);
      }
    });

    it("includes all questions for mixed scope", () => {
      const mixedScope: PracticeScope = {
        type: "mixed",
        examAttemptId: "attempt_neet_2027",
      };
      const filtered = filterQuestionsByScope(FIXTURE_QUESTIONS, mixedScope);
      expect(filtered.length).toBe(FIXTURE_QUESTIONS.length);
    });

    it("returns empty array for non-existent topic", () => {
      const nonExistent: PracticeScope = {
        type: "topic",
        topicId: "unknown_topic_id",
      };
      const filtered = filterQuestionsByScope(FIXTURE_QUESTIONS, nonExistent);
      expect(filtered).toEqual([]);
    });
  });

  describe("3. Question Selection Algorithm", () => {
    it("selects exactly the requested number of questions when pool is sufficient", () => {
      const selected = selectQuestionsForSession(FIXTURE_QUESTIONS, 10);
      expect(selected).toHaveLength(10);
    });

    it("guarantees no duplicate questions within a session", () => {
      const selected = selectQuestionsForSession(FIXTURE_QUESTIONS, 15);
      const ids = selected.map((q) => q.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(selected.length);
    });

    it("handles pool exhaustion gracefully without fabricating questions", () => {
      // Pick a topic that has only 5 questions
      const topicQuestions = FIXTURE_QUESTIONS.filter(
        (q) => q.topicId === "exam_neet_physics_kinematics_vectors-and-scalars"
      );
      expect(topicQuestions.length).toBe(5);

      // Student requests 20 questions, but only 5 exist
      const selected = selectQuestionsForSession(topicQuestions, 20);
      expect(selected).toHaveLength(5);
      // All 5 must be unique and from the pool
      const ids = selected.map((q) => q.id);
      expect(new Set(ids).size).toBe(5);
    });

    it("returns empty array when pool is empty or count is 0", () => {
      expect(selectQuestionsForSession([], 10)).toEqual([]);
      expect(selectQuestionsForSession(FIXTURE_QUESTIONS, 0)).toEqual([]);
    });

    it("supports deterministic seeded selection for test repeatability", () => {
      const seed = 12345;
      const run1 = selectQuestionsForSession(FIXTURE_QUESTIONS, 5, { seed });
      const run2 = selectQuestionsForSession(FIXTURE_QUESTIONS, 5, { seed });

      expect(run1.map((q) => q.id)).toEqual(run2.map((q) => q.id));
    });

    it("supports deterministic non-shuffled selection", () => {
      const run1 = selectQuestionsForSession(FIXTURE_QUESTIONS, 5, { shuffle: false });
      const run2 = selectQuestionsForSession(FIXTURE_QUESTIONS, 5, { shuffle: false });

      expect(run1.map((q) => q.id)).toEqual(run2.map((q) => q.id));
    });
  });

  describe("4. Authoritative Grading & Accuracy Calculation", () => {
    const mockQuestions: QuestionWithOptions[] = [
      {
        id: "q_test_1",
        examId: "exam_neet",
        subjectId: "exam_neet_physics",
        chapterId: "chap_1",
        topicId: "top_1",
        text: "Question 1 text",
        type: "single_choice",
        difficulty: "easy",
        explanation: "Because option A is true.",
        provenance: "fixture",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        options: [
          { id: "opt_1_a", questionId: "q_test_1", displayOrder: 1, optionKey: "A", text: "Choice A", isCorrect: true },
          { id: "opt_1_b", questionId: "q_test_1", displayOrder: 2, optionKey: "B", text: "Choice B", isCorrect: false },
        ],
      },
      {
        id: "q_test_2",
        examId: "exam_neet",
        subjectId: "exam_neet_physics",
        chapterId: "chap_1",
        topicId: "top_1",
        text: "Question 2 text",
        type: "single_choice",
        difficulty: "medium",
        explanation: null,
        provenance: "fixture",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        options: [
          { id: "opt_2_a", questionId: "q_test_2", displayOrder: 1, optionKey: "A", text: "Choice A", isCorrect: false },
          { id: "opt_2_b", questionId: "q_test_2", displayOrder: 2, optionKey: "B", text: "Choice B", isCorrect: true },
        ],
      },
      {
        id: "q_test_3",
        examId: "exam_neet",
        subjectId: "exam_neet_chemistry",
        chapterId: "chap_2",
        topicId: "top_2",
        text: "Question 3 text",
        type: "single_choice",
        difficulty: "hard",
        explanation: "Detail on Q3",
        provenance: "fixture",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        options: [
          { id: "opt_3_a", questionId: "q_test_3", displayOrder: 1, optionKey: "A", text: "Choice A", isCorrect: true },
          { id: "opt_3_b", questionId: "q_test_3", displayOrder: 2, optionKey: "B", text: "Choice B", isCorrect: false },
        ],
      },
      {
        id: "q_test_4",
        examId: "exam_neet",
        subjectId: "exam_neet_chemistry",
        chapterId: "chap_2",
        topicId: "top_2",
        text: "Question 4 text",
        type: "single_choice",
        difficulty: "easy",
        explanation: "Detail on Q4",
        provenance: "fixture",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        options: [
          { id: "opt_4_a", questionId: "q_test_4", displayOrder: 1, optionKey: "A", text: "Choice A", isCorrect: false },
          { id: "opt_4_b", questionId: "q_test_4", displayOrder: 2, optionKey: "B", text: "Choice B", isCorrect: true },
        ],
      },
    ];

    it("evaluates a session with 100% correct answers", () => {
      const result = gradeQuestionSession({
        sessionId: "sess_1",
        workspaceId: "ws_1",
        scopeType: "mixed",
        scopeId: "attempt_neet_2027",
        questions: mockQuestions,
        answers: {
          q_test_1: "opt_1_a",
          q_test_2: "opt_2_b",
          q_test_3: "opt_3_a",
          q_test_4: "opt_4_b",
        },
        durationSeconds: 100,
      });

      expect(result.totalQuestions).toBe(4);
      expect(result.attempted).toBe(4);
      expect(result.correct).toBe(4);
      expect(result.incorrect).toBe(0);
      expect(result.unanswered).toBe(0);
      expect(result.accuracyBps).toBe(10000); // 100.00%
      expect(result.accuracyPct).toBe(100);
    });

    it("evaluates a session with mixed correct, incorrect, and skipped", () => {
      const result = gradeQuestionSession({
        sessionId: "sess_2",
        workspaceId: "ws_1",
        scopeType: "mixed",
        scopeId: "attempt_neet_2027",
        questions: mockQuestions,
        answers: {
          q_test_1: "opt_1_a", // Correct
          q_test_2: "opt_2_a", // Incorrect (correct is opt_2_b)
          q_test_3: null,       // Unanswered
          // q_test_4 not in map -> Unanswered
        },
        durationSeconds: 75,
      });

      expect(result.totalQuestions).toBe(4);
      expect(result.attempted).toBe(2);
      expect(result.correct).toBe(1);
      expect(result.incorrect).toBe(1);
      expect(result.unanswered).toBe(2);
      expect(result.accuracyBps).toBe(5000); // 50.00% (1 / 2)
      expect(result.accuracyPct).toBe(50);
    });

    it("evaluates a session with all unanswered correctly (0 accuracy)", () => {
      const result = gradeQuestionSession({
        sessionId: "sess_3",
        workspaceId: "ws_1",
        scopeType: "mixed",
        scopeId: "attempt_neet_2027",
        questions: mockQuestions,
        answers: {},
      });

      expect(result.totalQuestions).toBe(4);
      expect(result.attempted).toBe(0);
      expect(result.correct).toBe(0);
      expect(result.incorrect).toBe(0);
      expect(result.unanswered).toBe(4);
      expect(result.accuracyBps).toBe(0);
      expect(result.accuracyPct).toBe(0);
    });

    it("preserves explanations and respects null explanations without inventing text", () => {
      const result = gradeQuestionSession({
        sessionId: "sess_4",
        workspaceId: "ws_1",
        scopeType: "mixed",
        scopeId: "attempt_neet_2027",
        questions: mockQuestions,
        answers: {},
      });

      expect(result.questions[0].explanation).toBe("Because option A is true.");
      expect(result.questions[1].explanation).toBeNull();
    });
  });

  describe("5. Content Provenance & Fixture Isolation", () => {
    it("all fixture questions explicitly declare provenance as fixture", () => {
      expect(FIXTURE_QUESTIONS.length).toBeGreaterThan(0);
      for (const q of FIXTURE_QUESTIONS) {
        expect(q.provenance).toBe("fixture");
        expect(q.status).toBe("active");
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        // Must have exactly one correct option for single_choice
        const correctCount = q.options.filter((o) => o.isCorrect).length;
        expect(correctCount).toBe(1);
      }
    });

    it("all fixture questions have valid normalized option keys", () => {
      for (const q of FIXTURE_QUESTIONS) {
        for (let i = 0; i < q.options.length; i++) {
          const opt = q.options[i];
          expect(opt.displayOrder).toBe(i + 1);
          expect(opt.questionId).toBe(q.id);
          expect(typeof opt.text).toBe("string");
          expect(opt.text.trim().length).toBeGreaterThan(0);
        }
      }
    });
  });
});
