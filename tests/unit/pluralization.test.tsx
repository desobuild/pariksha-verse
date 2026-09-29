import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ConsistencySection } from "@/components/analytics/consistency-section";
import { RecentPracticeList } from "@/components/practice/recent-practice-list";
import type { ConsistencyAnalytics } from "@/domain/analytics";
import type { PracticeSession } from "@/db/schema";

/**
 * Singular/plural grammar at the two surfaces flagged in staging QA:
 * - Progress page consistency sentence ("Studied on 1 days in total.")
 * - Recent Practice rows ("1 questions")
 * Each count is exercised at 0, 1, and 2.
 */

function consistencyFixture(overrides: Partial<ConsistencyAnalytics> = {}): ConsistencyAnalytics {
  return {
    windowDays: null,
    windowLabel: "All time",
    activeStudyDays: 0,
    activePracticeDays: 0,
    studySessions: 0,
    practiceSessions: 0,
    mocksCompleted: 0,
    revisionCompletions: 0,
    ...overrides,
  };
}

function practiceSessionFixture(questionCount: number): PracticeSession {
  return {
    id: `prac_${questionCount}`,
    workspaceId: "ws_test",
    topicId: "exam_neet_physics_kinematics_motion-in-straight-line",
    questionCount,
    correct: Math.min(1, questionCount),
    incorrect: 0,
    unattempted: 0,
    durationMinutes: 5,
    completedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("ConsistencySection sentence pluralization", () => {
  it.each([0, 1, 2])("renders all-time activeStudyDays=%s with correct plural", (days) => {
    const { container } = render(
      <ConsistencySection consistency={consistencyFixture({ windowDays: null, activeStudyDays: days })} />
    );
    expect(container.textContent).toContain(`Studied on ${days} ${days === 1 ? "day" : "days"} in total.`);
  });

  it("never renders the singular-breaking '1 days in total'", () => {
    const { container } = render(
      <ConsistencySection consistency={consistencyFixture({ windowDays: null, activeStudyDays: 1 })} />
    );
    expect(container.textContent).not.toContain("1 days in total");
  });

  it.each([0, 1, 2])("renders windowed sentence for windowDays=%s with correct plural", (days) => {
    const { container } = render(
      <ConsistencySection
        consistency={consistencyFixture({ windowDays: days, activeStudyDays: days })}
      />
    );
    expect(container.textContent).toContain(`of the last ${days} ${days === 1 ? "day" : "days"}.`);
  });

  it("keeps the header description pluralized for multi-day windows", () => {
    const { container } = render(
      <ConsistencySection consistency={consistencyFixture({ windowDays: 7, activeStudyDays: 3 })} />
    );
    expect(container.textContent).toContain("Activity recorded during the last 7 days");
  });
});

describe("RecentPracticeList question-count pluralization", () => {
  it.each([0, 1, 2])("renders questionCount=%s with correct plural", (count) => {
    const { container } = render(
      <RecentPracticeList sessions={[practiceSessionFixture(count)]} examAttemptId="attempt_neet_2027" />
    );
    expect(container.textContent).toContain(`${count} ${count === 1 ? "question" : "questions"}`);
  });

  it("never renders the singular-breaking '1 questions'", () => {
    const { container } = render(
      <RecentPracticeList sessions={[practiceSessionFixture(1)]} examAttemptId="attempt_neet_2027" />
    );
    expect(container.textContent).toContain("1 question");
    expect(container.textContent).not.toContain("1 questions");
  });

  it("keeps the header session count pluralized", () => {
    const single = render(
      <RecentPracticeList sessions={[practiceSessionFixture(1)]} examAttemptId="attempt_neet_2027" />
    );
    expect(single.container.textContent).toContain("1 session logged");

    const multiple = render(
      <RecentPracticeList
        sessions={[practiceSessionFixture(1), practiceSessionFixture(2)]}
        examAttemptId="attempt_neet_2027"
      />
    );
    expect(multiple.container.textContent).toContain("2 sessions logged");
  });
});
