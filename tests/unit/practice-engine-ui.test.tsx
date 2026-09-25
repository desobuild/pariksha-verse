import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { StartPracticeDialog } from "@/components/practice/start-practice-dialog";
import { QuestionPlayer } from "@/components/practice/question-player";
import { QuestionResultView } from "@/components/practice/question-result-view";
import type {
  QuestionWithOptions,
  QuestionSessionWithAttempts,
  QuestionSessionResult,
} from "@/domain/practice-engine";
import { createGuestRepositories } from "@/repositories/guest-repositories";
import { appStorage } from "@/lib/storage";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: mockPush }),
  usePathname: () => "/app/practice",
  useSearchParams: () => new URLSearchParams(),
}));

const mockQuestions: QuestionWithOptions[] = [
  {
    id: "q_test_1",
    examId: "exam_neet",
    subjectId: "exam_neet_physics",
    chapterId: "exam_neet_physics_kinematics",
    topicId: "exam_neet_physics_kinematics_vectors-and-scalars",
    type: "single_choice",
    difficulty: "medium",
    text: "Which of the following is a fundamental physical vector quantity?",
    explanation: "Velocity has both magnitude and direction.",
    provenance: "fixture",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [
      { id: "opt_1", questionId: "q_test_1", displayOrder: 1, text: "Speed", optionKey: "A" },
      { id: "opt_2", questionId: "q_test_1", displayOrder: 2, text: "Velocity", optionKey: "B" },
      { id: "opt_3", questionId: "q_test_1", displayOrder: 3, text: "Mass", optionKey: "C" },
      { id: "opt_4", questionId: "q_test_1", displayOrder: 4, text: "Time", optionKey: "D" },
    ],
  },
  {
    id: "q_test_2",
    examId: "exam_neet",
    subjectId: "exam_neet_physics",
    chapterId: "exam_neet_physics_kinematics",
    topicId: "exam_neet_physics_kinematics_vectors-and-scalars",
    type: "single_choice",
    difficulty: "easy",
    text: "What is the dot product of two mutually orthogonal non-zero vectors?",
    explanation: "cos(90°) = 0, hence A · B = 0.",
    provenance: "fixture",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [
      { id: "opt_5", questionId: "q_test_2", displayOrder: 1, text: "Zero", optionKey: "A" },
      { id: "opt_6", questionId: "q_test_2", displayOrder: 2, text: "One", optionKey: "B" },
      { id: "opt_7", questionId: "q_test_2", displayOrder: 3, text: "-1", optionKey: "C" },
      { id: "opt_8", questionId: "q_test_2", displayOrder: 4, text: "Infinity", optionKey: "D" },
    ],
  },
];

describe("Phase 10: Practice Engine UI Components", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  describe("1. StartPracticeDialog", () => {
    it("renders scope options and allows selecting question count and scope", async () => {
      const onOpenChange = vi.fn();

      render(
        <StartPracticeDialog
          open={true}
          onOpenChange={onOpenChange}
          examAttemptId="attempt_neet_2027"
          workspaceId="ws_test"
          initialTopicId="exam_neet_physics_kinematics_vectors-and-scalars"
        />
      );

      // Verify header and scope buttons
      expect(screen.getByText("Start Question Practice")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Topic/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Subject/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Mixed \(All\)/i })).toBeInTheDocument();

      // Check question count buttons (5, 10, 20)
      const countBtn5 = screen.getByRole("button", { name: /5 Questions/i });
      const countBtn20 = screen.getByRole("button", { name: /20 Questions/i });
      expect(countBtn5).toBeInTheDocument();
      expect(countBtn20).toBeInTheDocument();

      // Click 5 questions
      fireEvent.click(countBtn5);

      // Switch scope to Mixed (All)
      const mixedBtn = screen.getByRole("button", { name: /Mixed \(All\)/i });
      fireEvent.click(mixedBtn);

      // Verify start button exists
      const startButton = screen.getByRole("button", { name: /Start Practice Session/i });
      expect(startButton).toBeInTheDocument();
      expect(startButton).not.toBeDisabled();
    });
  });

  describe("2. QuestionPlayer", () => {
    it("renders current question, handles navigation, answering, review modal, and submit", async () => {
      const repos = createGuestRepositories(appStorage);
      const created = await repos.questionSession.createSession({
        workspaceId: "ws_test",
        scope: { type: "topic", topicId: "exam_neet_physics_kinematics_vectors-and-scalars" },
        questionCount: 5,
      });

      const initialSession = await repos.questionSession.getSession(
        created.id,
        "ws_test"
      );

      expect(initialSession).not.toBeNull();

      render(
        <QuestionPlayer
          initialSession={initialSession!}
          workspaceId="ws_test"
        />
      );

      // Shows Question 1 of 5
      expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();
      expect(screen.getByText("topic Practice")).toBeInTheDocument();

      // Find an option radio and select it
      const radioOptions = screen.getAllByRole("radio");
      expect(radioOptions.length).toBeGreaterThanOrEqual(2);
      fireEvent.click(radioOptions[0]);

      // Navigate to Next question via "Next" button
      const nextBtn = screen.getByRole("button", { name: /^Next$/i });
      fireEvent.click(nextBtn);

      // Now on Question 2 of 5
      expect(screen.getByText("Question 2 of 5")).toBeInTheDocument();

      // Previous button should go back to Question 1
      const prevBtn = screen.getByRole("button", { name: /Previous/i });
      fireEvent.click(prevBtn);
      expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();

      // Open review dialog via Review button
      const reviewBtn = screen.getAllByRole("button", { name: "Review practice session" })[0];
      fireEvent.click(reviewBtn);

      expect(screen.getByText("Practice Session Review")).toBeInTheDocument();
      expect(screen.getByText("Answered")).toBeInTheDocument();
      expect(screen.getByText("Unanswered")).toBeInTheDocument();

      // Submit from review dialog
      const finalSubmitBtn = screen.getByRole("button", { name: /Submit Practice/i });
      fireEvent.click(finalSubmitBtn);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`/app/practice/session/${created.id}/result`);
      });
    });
  });

  describe("3. QuestionResultView", () => {
    const mockResult: QuestionSessionResult = {
      sessionId: "sess_123",
      workspaceId: "ws_test",
      scopeType: "topic",
      scopeId: "exam_neet_physics_kinematics_vectors-and-scalars",
      totalQuestions: 2,
      attempted: 2,
      correct: 1,
      incorrect: 1,
      unanswered: 0,
      accuracyBps: 5000, // 50%
      accuracyPct: 50,
      durationSeconds: 95,
      completedAt: new Date(),
      questions: [
        {
          questionId: "q_test_1",
          displayOrder: 1,
          text: "Which of the following is a fundamental physical vector quantity?",
          explanation: "Velocity has both magnitude and direction.",
          topicId: "exam_neet_physics_kinematics_vectors-and-scalars",
          topicName: "Vectors & Scalars",
          subjectName: "Physics",
          options: [
            { id: "opt_1", optionKey: "A", text: "Speed", isCorrect: false, isSelected: false },
            { id: "opt_2", optionKey: "B", text: "Velocity", isCorrect: true, isSelected: true },
          ],
          selectedOptionId: "opt_2",
          correctOptionId: "opt_2",
          isCorrect: true,
          isAttempted: true,
        },
        {
          questionId: "q_test_2",
          displayOrder: 2,
          text: "What is the dot product of two mutually orthogonal non-zero vectors?",
          explanation: "cos(90°) = 0, hence A · B = 0.",
          topicId: "exam_neet_physics_kinematics_vectors-and-scalars",
          topicName: "Vectors & Scalars",
          subjectName: "Physics",
          options: [
            { id: "opt_5", optionKey: "A", text: "Zero", isCorrect: true, isSelected: false },
            { id: "opt_6", optionKey: "B", text: "One", isCorrect: false, isSelected: true },
          ],
          selectedOptionId: "opt_6",
          correctOptionId: "opt_5",
          isCorrect: false,
          isAttempted: true,
        },
      ],
    };

    it("displays score metrics, weak accuracy alert (<60%), and allows reviewing each question", () => {
      render(
        <QuestionResultView
          result={mockResult}
          onPracticeAgain={vi.fn()}
        />
      );

      // Score metrics
      expect(screen.getByText("50%")).toBeInTheDocument();
      expect(screen.getByText("Accuracy")).toBeInTheDocument();
      expect(screen.getByText("/ 2")).toBeInTheDocument();

      // Weak accuracy banner (since 50% < 60%)
      expect(screen.getByText(/Added to Weak Topics/i)).toBeInTheDocument();

      // Question review list
      expect(screen.getByText("Which of the following is a fundamental physical vector quantity?")).toBeInTheDocument();
      expect(screen.getByText("What is the dot product of two mutually orthogonal non-zero vectors?")).toBeInTheDocument();

      // Check badges (using getAllByText for Correct since it appears in the header card and question badge)
      expect(screen.getAllByText("Correct").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Incorrect")).toBeInTheDocument();

      // Explanations
      expect(screen.getByText("Velocity has both magnitude and direction.")).toBeInTheDocument();
      expect(screen.getByText("cos(90°) = 0, hence A · B = 0.")).toBeInTheDocument();
    });
  });
});
