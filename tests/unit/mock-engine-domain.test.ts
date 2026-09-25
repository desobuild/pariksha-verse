import { describe, it, expect } from "vitest";
import {
  calculateMockResult,
  selectMockQuestions,
  validateMockQuestionPool,
  InsufficientQuestionsError,
  createFixtureMocksForWorkspace,
  FIXTURE_MOCK_TEMPLATES,
  mockMarkingSchemeSchema,
  mockSectionConfigSchema,
  createMockSessionSchema,
  updateMockAnswerSchema,
  submitMockSessionSchema,
  type MockTestDetail,
} from "@/domain/mock-engine";
import { FIXTURE_QUESTIONS } from "@/domain/practice-engine";

describe("Phase 11: Mock Engine Domain & Algorithms", () => {
  const sampleMock: MockTestDetail = {
    id: "mock_test_sample",
    workspaceId: "ws_test",
    examId: "exam_neet",
    title: "Full Syllabus Sample Mock (Demo)",
    description: "A test mock",
    type: "full_syllabus",
    scheduledAt: null,
    durationMinutes: 15,
    totalQuestions: 6,
    markingScheme: {
      correctMarks: 4,
      incorrectPenalty: 1,
      unansweredMarks: 0,
    },
    sections: [
      {
        id: "sec_phy",
        name: "Physics",
        displayOrder: 1,
        questionCount: 2,
        subjectId: "exam_neet_physics",
      },
      {
        id: "sec_chm",
        name: "Chemistry",
        displayOrder: 2,
        questionCount: 2,
        subjectId: "exam_neet_chemistry",
      },
      {
        id: "sec_bio",
        name: "Biology",
        displayOrder: 3,
        questionCount: 2,
        subjectId: "exam_neet_biology",
      },
    ],
    source: null,
    externalUrl: null,
    provenance: "fixture",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("1. Validation Schemas", () => {
    it("validates marking scheme with positive correct marks and non-negative penalty", () => {
      const valid = mockMarkingSchemeSchema.safeParse({
        correctMarks: 4,
        incorrectPenalty: 1,
        unansweredMarks: 0,
      });
      expect(valid.success).toBe(true);

      const customExam = mockMarkingSchemeSchema.safeParse({
        correctMarks: 2,
        incorrectPenalty: 0.66,
        unansweredMarks: 0,
      });
      expect(customExam.success).toBe(true);

      const invalidPenalty = mockMarkingSchemeSchema.safeParse({
        correctMarks: 4,
        incorrectPenalty: -1,
      });
      expect(invalidPenalty.success).toBe(false);
    });

    it("validates section configuration correctly", () => {
      const valid = mockSectionConfigSchema.safeParse({
        id: "sec_1",
        name: "Physics Core",
        displayOrder: 1,
        questionCount: 4,
        subjectId: "exam_neet_physics",
      });
      expect(valid.success).toBe(true);

      const invalid = mockSectionConfigSchema.safeParse({
        id: "",
        name: "Empty",
        questionCount: 0,
      });
      expect(invalid.success).toBe(false);
    });

    it("validates session creation and answer update schemas", () => {
      const sessionValid = createMockSessionSchema.safeParse({
        workspaceId: "ws_123",
        mockTestId: "mock_456",
        seed: 99,
      });
      expect(sessionValid.success).toBe(true);

      const answerValid = updateMockAnswerSchema.safeParse({
        workspaceId: "ws_123",
        sessionId: "sess_1",
        questionId: "q_1",
        selectedOptionId: "opt_1",
        isMarkedForReview: true,
        currentIndex: 2,
      });
      expect(answerValid.success).toBe(true);

      const submitValid = submitMockSessionSchema.safeParse({
        workspaceId: "ws_123",
        sessionId: "sess_1",
        submissionStatus: "auto_submitted",
        answers: { q_1: "opt_1", q_2: null },
        markedForReview: ["q_1"],
      });
      expect(submitValid.success).toBe(true);
    });
  });

  describe("2. Authoritative Scoring & Marking Calculation", () => {
    it("grades all correct answers with positive marks", () => {
      const questions = FIXTURE_QUESTIONS.slice(0, 3);
      const answers: Record<string, string | null> = {};
      questions.forEach((q) => {
        const correct = q.options.find((o) => o.isCorrect);
        answers[q.id] = correct?.id ?? null;
      });

      const result = calculateMockResult({
        mockTest: {
          ...sampleMock,
          sections: [],
          totalQuestions: 3,
        },
        sessionId: "sess_all_correct",
        workspaceId: "ws_test",
        questions,
        answers,
        markedForReview: [],
        startedAt: new Date(Date.now() - 300000),
      });

      expect(result.rawScore).toBe(12); // 3 * 4
      expect(result.totalMarks).toBe(12);
      expect(result.correct).toBe(3);
      expect(result.incorrect).toBe(0);
      expect(result.unattempted).toBe(0);
      expect(result.accuracy).toBe(10000); // 100% in bps
      expect(result.accuracyPct).toBe(100);
    });

    it("applies negative marking penalty for incorrect answers", () => {
      const questions = FIXTURE_QUESTIONS.slice(0, 4);
      const answers: Record<string, string | null> = {};

      // Q0: correct (+4)
      const correct0 = questions[0].options.find((o) => o.isCorrect);
      answers[questions[0].id] = correct0?.id ?? null;

      // Q1: incorrect (-1)
      const wrong1 = questions[1].options.find((o) => !o.isCorrect);
      answers[questions[1].id] = wrong1?.id ?? null;

      // Q2: incorrect (-1)
      const wrong2 = questions[2].options.find((o) => !o.isCorrect);
      answers[questions[2].id] = wrong2?.id ?? null;

      // Q3: unanswered (0)
      answers[questions[3].id] = null;

      const result = calculateMockResult({
        mockTest: {
          ...sampleMock,
          sections: [],
          totalQuestions: 4,
          markingScheme: { correctMarks: 4, incorrectPenalty: 1, unansweredMarks: 0 },
        },
        sessionId: "sess_neg_marking",
        workspaceId: "ws_test",
        questions,
        answers,
        markedForReview: [],
        startedAt: new Date(Date.now() - 120000),
      });

      // Score = 4 - 1 - 1 + 0 = 2
      expect(result.rawScore).toBe(2);
      expect(result.totalMarks).toBe(16); // 4 * 4
      expect(result.correct).toBe(1);
      expect(result.incorrect).toBe(2);
      expect(result.unattempted).toBe(1);
      expect(result.attempted).toBe(3);
      // Accuracy = 1/3 = 3333 bps
      expect(result.accuracy).toBe(3333);
      expect(result.accuracyPct).toBe(33);
    });

    it("evaluates custom exam marking configurations correctly (exam-agnostic)", () => {
      const questions = FIXTURE_QUESTIONS.slice(0, 2);
      const answers: Record<string, string | null> = {};

      // 1 correct, 1 wrong
      answers[questions[0].id] = questions[0].options.find((o) => o.isCorrect)?.id ?? null;
      answers[questions[1].id] = questions[1].options.find((o) => !o.isCorrect)?.id ?? null;

      const customMock: MockTestDetail = {
        ...sampleMock,
        sections: [],
        totalQuestions: 2,
        markingScheme: { correctMarks: 2, incorrectPenalty: 0.5, unansweredMarks: 0 },
      };

      const result = calculateMockResult({
        mockTest: customMock,
        sessionId: "sess_custom",
        workspaceId: "ws_test",
        questions,
        answers,
        markedForReview: [],
        startedAt: new Date(Date.now() - 60000),
      });

      // Score = 2 - 0.5 = 1.5
      expect(result.rawScore).toBe(1.5);
      expect(result.totalMarks).toBe(4);
    });

    it("handles marked for review: marked + answered is scored; marked + unanswered is unanswered", () => {
      const questions = FIXTURE_QUESTIONS.slice(0, 3);
      const answers: Record<string, string | null> = {};

      // Q0: answered correct + marked for review => should score +4
      answers[questions[0].id] = questions[0].options.find((o) => o.isCorrect)?.id ?? null;

      // Q1: unanswered + marked for review => should score 0
      answers[questions[1].id] = null;

      // Q2: answered incorrect + not marked => should score -1
      answers[questions[2].id] = questions[2].options.find((o) => !o.isCorrect)?.id ?? null;

      const result = calculateMockResult({
        mockTest: {
          ...sampleMock,
          sections: [],
          totalQuestions: 3,
        },
        sessionId: "sess_marked",
        workspaceId: "ws_test",
        questions,
        answers,
        markedForReview: [questions[0].id, questions[1].id],
        startedAt: new Date(Date.now() - 60000),
      });

      expect(result.rawScore).toBe(3); // 4 + 0 - 1 = 3
      expect(result.correct).toBe(1);
      expect(result.incorrect).toBe(1);
      expect(result.unattempted).toBe(1);
      expect(result.markedForReviewCount).toBe(2);

      const q0 = result.questions.find((q) => q.questionId === questions[0].id);
      expect(q0?.isMarkedForReview).toBe(true);
      expect(q0?.isCorrect).toBe(true);
      expect(q0?.marksAwarded).toBe(4);

      const q1 = result.questions.find((q) => q.questionId === questions[1].id);
      expect(q1?.isMarkedForReview).toBe(true);
      expect(q1?.isAttempted).toBe(false);
      expect(q1?.marksAwarded).toBe(0);
    });

    it("calculates section-level breakdown when sections exist", () => {
      const selected = selectMockQuestions(FIXTURE_QUESTIONS, sampleMock, 42);
      expect(selected).toHaveLength(6);

      // Answer first question of each section correctly
      const answers: Record<string, string | null> = {};
      answers[selected[0].id] = selected[0].options.find((o) => o.isCorrect)?.id ?? null;
      answers[selected[2].id] = selected[2].options.find((o) => o.isCorrect)?.id ?? null;
      answers[selected[4].id] = selected[4].options.find((o) => o.isCorrect)?.id ?? null;

      const result = calculateMockResult({
        mockTest: sampleMock,
        sessionId: "sess_sections",
        workspaceId: "ws_test",
        questions: selected,
        answers,
        markedForReview: [],
        startedAt: new Date(Date.now() - 60000),
      });

      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].name).toBe("Physics");
      expect(result.sections[0].totalQuestions).toBe(2);
      expect(result.sections[0].attempted).toBe(1);
      expect(result.sections[0].correct).toBe(1);
      expect(result.sections[0].rawScore).toBe(4);

      expect(result.sections[1].name).toBe("Chemistry");
      expect(result.sections[1].totalQuestions).toBe(2);

      expect(result.sections[2].name).toBe("Biology");
      expect(result.sections[2].totalQuestions).toBe(2);
    });
  });

  describe("3. Mock Question Selection & Pool Validation", () => {
    it("validates pool successfully when sufficient questions exist", () => {
      const validation = validateMockQuestionPool(FIXTURE_QUESTIONS, sampleMock);
      expect(validation.valid).toBe(true);
      expect(validation.requiredCount).toBe(6);
    });

    it("prevents launch and throws InsufficientQuestionsError when questions are insufficient", () => {
      const oversizedMock: MockTestDetail = {
        ...sampleMock,
        sections: [
          {
            id: "sec_oversized",
            name: "Physics Advanced",
            displayOrder: 1,
            questionCount: 100, // We only have 8 physics questions in fixtures
            subjectId: "exam_neet_physics",
          },
        ],
        totalQuestions: 100,
      };

      const validation = validateMockQuestionPool(FIXTURE_QUESTIONS, oversizedMock);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("Insufficient questions");

      expect(() => selectMockQuestions(FIXTURE_QUESTIONS, oversizedMock, 42)).toThrow(
        InsufficientQuestionsError
      );
    });

    it("produces deterministic, duplicate-free question sets for a seed", () => {
      const set1 = selectMockQuestions(FIXTURE_QUESTIONS, sampleMock, 12345);
      const set2 = selectMockQuestions(FIXTURE_QUESTIONS, sampleMock, 12345);

      expect(set1.map((q) => q.id)).toEqual(set2.map((q) => q.id));

      // Verify no duplicates
      const uniqueIds = new Set(set1.map((q) => q.id));
      expect(uniqueIds.size).toBe(set1.length);
    });

    it("respects section allocations without question overlap", () => {
      const selected = selectMockQuestions(FIXTURE_QUESTIONS, sampleMock, 77);
      expect(selected).toHaveLength(6);

      const phyQuestions = selected.slice(0, 2);
      const chmQuestions = selected.slice(2, 4);
      const bioQuestions = selected.slice(4, 6);

      phyQuestions.forEach((q) => expect(q.subjectId).toBe("exam_neet_physics"));
      chmQuestions.forEach((q) => expect(q.subjectId).toBe("exam_neet_chemistry"));
      bioQuestions.forEach((q) => expect(q.subjectId).toBe("exam_neet_biology"));
    });
  });

  describe("4. Fixture Mocks & Provenance Integrity", () => {
    it("ensures all fixture mock templates carry fixture provenance and neutral labels", () => {
      FIXTURE_MOCK_TEMPLATES.forEach((tpl) => {
        expect(tpl.provenance).toBe("fixture");
        // Must never claim to be official NEET/JEE or PYQ
        expect(tpl.title.toLowerCase()).not.toContain("official neet");
        expect(tpl.title.toLowerCase()).not.toContain("official jee");
        expect(tpl.title.toLowerCase()).not.toContain("previous year question");
        expect(tpl.title.toLowerCase()).not.toContain("pyq");
        expect(
          tpl.title.includes("Sample Mock") ||
            tpl.title.includes("Practice Mock") ||
            tpl.title.includes("Diagnostic")
        ).toBe(true);
      });
    });

    it("creates workspace-specific fixture mocks correctly", () => {
      const mocks = createFixtureMocksForWorkspace("ws_user_42");
      expect(mocks.length).toBeGreaterThanOrEqual(3);
      mocks.forEach((m) => {
        expect(m.workspaceId).toBe("ws_user_42");
        expect(m.provenance).toBe("fixture");
        expect(m.status).toBe("active");
        expect(m.markingScheme.correctMarks).toBe(4);
      });
    });
  });
});
