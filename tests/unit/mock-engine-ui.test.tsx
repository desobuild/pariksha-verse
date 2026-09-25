import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MockList } from "@/components/mock-tests/mock-list";
import { MockInstructionsView } from "@/components/mock-tests/mock-instructions-view";
import { MockExamPlayer } from "@/components/mock-tests/mock-exam-player";
import { MockResultView } from "@/components/mock-tests/mock-result-view";
import type {
  MockTestDetail,
  MockTestSessionDetail,
  MockTestResultDetail,
} from "@/domain/mock-engine";
import type { QuestionWithOptions } from "@/domain/practice-engine/types";
import { RepositoryProvider } from "@/repositories/repository-provider";
import { createGuestRepositories } from "@/repositories/guest-repositories";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: mockPush }),
  usePathname: () => "/app/mock-tests",
  useSearchParams: () => new URLSearchParams(),
}));

const sampleMock: MockTestDetail = {
  id: "mock_test_ui",
  workspaceId: "ws_ui",
  examId: "exam_neet",
  title: "Full Syllabus Sample Mock (Demo)",
  description: "A comprehensive sample mock simulation.",
  type: "full_syllabus",
  scheduledAt: null,
  durationMinutes: 15,
  totalQuestions: 2,
  markingScheme: {
    correctMarks: 4,
    incorrectPenalty: 1,
    unansweredMarks: 0,
  },
  sections: [
    {
      id: "sec_1",
      name: "Physics",
      description: "Physics Fundamentals",
      displayOrder: 1,
      questionCount: 1,
      subjectId: "exam_neet_physics",
    },
    {
      id: "sec_2",
      name: "Chemistry",
      description: "Chemistry Fundamentals",
      displayOrder: 2,
      questionCount: 1,
      subjectId: "exam_neet_chemistry",
    },
  ],
  source: null,
  externalUrl: null,
  provenance: "fixture",
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleQuestions: QuestionWithOptions[] = [
  {
    id: "q_ui_1",
    examId: "exam_neet",
    subjectId: "exam_neet_physics",
    chapterId: "exam_neet_physics_kinematics",
    topicId: "exam_neet_physics_kinematics_vectors",
    type: "single_choice",
    difficulty: "medium",
    text: "What is the dot product of perpendicular vectors?",
    explanation: "Because cos(90) = 0.",
    provenance: "fixture",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [
      { id: "opt_1_a", questionId: "q_ui_1", displayOrder: 1, text: "Zero", optionKey: "A", isCorrect: true },
      { id: "opt_1_b", questionId: "q_ui_1", displayOrder: 2, text: "One", optionKey: "B", isCorrect: false },
    ],
  },
  {
    id: "q_ui_2",
    examId: "exam_neet",
    subjectId: "exam_neet_chemistry",
    chapterId: "exam_neet_chemistry_bonding",
    topicId: "exam_neet_chemistry_bonding_shape",
    type: "single_choice",
    difficulty: "easy",
    text: "What is the geometry of a water molecule?",
    explanation: "Bent shape due to lone pairs.",
    provenance: "fixture",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [
      { id: "opt_2_a", questionId: "q_ui_2", displayOrder: 1, text: "Linear", optionKey: "A", isCorrect: false },
      { id: "opt_2_b", questionId: "q_ui_2", displayOrder: 2, text: "Bent", optionKey: "B", isCorrect: true },
    ],
  },
];

const sampleSession: MockTestSessionDetail = {
  id: "sess_ui_1",
  mockTestId: "mock_test_ui",
  workspaceId: "ws_ui",
  status: "in_progress",
  questionIds: ["q_ui_1", "q_ui_2"],
  selectedAnswers: {},
  markedForReview: [],
  currentIndex: 0,
  durationSeconds: 900,
  startedAt: new Date(),
  expiresAt: new Date(Date.now() + 900000),
  completedAt: null,
  questions: sampleQuestions,
  mockTest: sampleMock,
};

const sampleResult: MockTestResultDetail = {
  id: "res_ui_1",
  mockTestId: "mock_test_ui",
  sessionId: "sess_ui_1",
  workspaceId: "ws_ui",
  mockTitle: "Full Syllabus Sample Mock (Demo)",
  rawScore: 8,
  totalMarks: 8,
  totalQuestions: 2,
  attempted: 2,
  correct: 2,
  incorrect: 0,
  unattempted: 0,
  markedForReviewCount: 0,
  accuracy: 10000,
  accuracyPct: 100,
  timeSpentSeconds: 120,
  submissionStatus: "completed",
  completedAt: new Date(),
  notes: null,
  sections: [
    {
      sectionId: "sec_1",
      name: "Physics",
      totalQuestions: 1,
      attempted: 1,
      correct: 1,
      incorrect: 0,
      unanswered: 0,
      rawScore: 4,
      maxScore: 4,
      accuracyBps: 10000,
      accuracyPct: 100,
    },
  ],
  questions: [
    {
      questionId: "q_ui_1",
      displayOrder: 1,
      sectionId: "sec_1",
      sectionName: "Physics",
      text: "What is the dot product of perpendicular vectors?",
      explanation: "Because cos(90) = 0.",
      topicId: "exam_neet_physics_kinematics_vectors",
      options: [
        { id: "opt_1_a", text: "Zero", optionKey: "A", isCorrect: true, isSelected: true },
        { id: "opt_1_b", text: "One", optionKey: "B", isCorrect: false, isSelected: false },
      ],
      selectedOptionId: "opt_1_a",
      correctOptionId: "opt_1_a",
      isCorrect: true,
      isAttempted: true,
      isMarkedForReview: false,
      marksAwarded: 4,
    },
  ],
};

function renderWithProviders(ui: React.ReactElement) {
  return render(ui);
}

describe("Phase 11: Mock Engine UI Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. MockList", () => {
    it("renders available mock tests with title, metadata, and history", () => {
      render(
        <MockList
          mockTests={[sampleMock]}
          results={[sampleResult]}
          workspaceId="ws_ui"
        />
      );

      // Title & provenance
      expect(screen.getAllByText("Full Syllabus Sample Mock (Demo)")[0]).toBeInTheDocument();
      expect(screen.getByText("Sample Mock")).toBeInTheDocument();
      expect(screen.getByText("+4 / -1")).toBeInTheDocument();

      // Top stats
      expect(screen.getByText("Mocks Taken")).toBeInTheDocument();
      expect(screen.getByText("Best Score")).toBeInTheDocument();

      // History
      expect(screen.getByText("Attempt History")).toBeInTheDocument();
      expect(screen.getAllByText("8 / 8")[0]).toBeInTheDocument();
    });

    it("renders empty states gracefully when no mocks or results exist", () => {
      render(<MockList mockTests={[]} results={[]} workspaceId="ws_ui" />);
      expect(screen.getByText("No mock tests available")).toBeInTheDocument();
      expect(screen.getByText("No completed mocks yet")).toBeInTheDocument();
    });
  });

  describe("2. MockInstructionsView", () => {
    it("renders specifications, sections, rules, and launch button", () => {
      renderWithProviders(
        <MockInstructionsView
          mockTest={sampleMock}
          workspaceId="ws_ui"
          poolQuestions={sampleQuestions}
        />
      );

      expect(screen.getByText("Total Questions")).toBeInTheDocument();
      expect(screen.getByText("Maximum Marks")).toBeInTheDocument();
      expect(screen.getByText("Exam Simulation Instructions")).toBeInTheDocument();
      expect(screen.getByText("Section Breakdown")).toBeInTheDocument();

      const startBtn = screen.getByRole("button", { name: /start mock test/i });
      expect(startBtn).toBeEnabled();
    });

    it("shows warning and disables launch when question pool is insufficient", () => {
      const oversized: MockTestDetail = {
        ...sampleMock,
        totalQuestions: 50,
        sections: [
          {
            id: "sec_big",
            name: "Physics",
            displayOrder: 1,
            questionCount: 50,
            subjectId: "exam_neet_physics",
          },
        ],
      };

      renderWithProviders(
        <MockInstructionsView
          mockTest={oversized}
          workspaceId="ws_ui"
          poolQuestions={sampleQuestions}
        />
      );

      expect(screen.getByText(/Insufficient Question Bank Content/i)).toBeInTheDocument();
      const startBtn = screen.getByRole("button", { name: /start mock test/i });
      expect(startBtn).toBeDisabled();
    });
  });

  describe("3. MockExamPlayer", () => {
    it("renders countdown timer, question, options, mark-for-review, and review modal", async () => {
      renderWithProviders(
        <MockExamPlayer initialSession={sampleSession} workspaceId="ws_ui" />
      );

      // Timer & Question
      expect(screen.getByRole("timer")).toBeInTheDocument();
      expect(
        screen.getByText("What is the dot product of perpendicular vectors?")
      ).toBeInTheDocument();

      // Options
      const optZero = screen.getByText("Zero");
      const optOne = screen.getByText("One");
      expect(optZero).toBeInTheDocument();
      expect(optOne).toBeInTheDocument();

      // Select an option
      fireEvent.click(optZero);

      // Toggle Mark for Review
      const markBtn = screen.getByRole("button", { name: /mark for review/i });
      fireEvent.click(markBtn);

      await waitFor(() => {
        expect(screen.getByText("Marked for Review")).toBeInTheDocument();
      });

      // Navigate to Next
      const nextBtn = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(
          screen.getByText("What is the geometry of a water molecule?")
        ).toBeInTheDocument();
      });

      // Open review modal
      const reviewSubmitBtn = screen.getByRole("button", { name: /review & submit/i });
      fireEvent.click(reviewSubmitBtn);

      await waitFor(() => {
        expect(screen.getByText("Submit Mock Test?")).toBeInTheDocument();
      });
    });
  });

  describe("4. MockResultView", () => {
    it("renders score hero, section results, question review and filters", () => {
      render(<MockResultView result={sampleResult} />);

      expect(screen.getByText("Final Raw Score")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByText("/ 8")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();

      // Section
      expect(screen.getByText("Section Performance")).toBeInTheDocument();

      // Question review
      expect(screen.getByText("Question-by-Question Review")).toBeInTheDocument();
      expect(
        screen.getByText("What is the dot product of perpendicular vectors?")
      ).toBeInTheDocument();
      expect(screen.getByText("Explanation:")).toBeInTheDocument();
      expect(screen.getByText("Because cos(90) = 0.")).toBeInTheDocument();
    });
  });
});
