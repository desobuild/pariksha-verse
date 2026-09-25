import { describe, it, expect } from "vitest";
import {
  calculateAccuracyBps,
  formatAccuracy,
  isTopicPracticeWeak,
  PRACTICE_WEAK_ACCURACY_BPS,
  validatePracticeInput,
  aggregateTopicPerformance,
  aggregateAllTopicsPerformance,
  getSubjectPracticePerformance,
  getOverallPracticeSnapshot,
  getWeakTopics,
  sortRecentPracticeSessions,
  filterTopicPerformances,
  applyPracticeSessionToProgress,
  type TopicPracticePerformance,
} from "@/domain/practice";
import type { PracticeSession, UserTopicProgress } from "@/db/schema";

const EXAM_ATTEMPT = "attempt_neet_2027";
const TOPIC_1 = "exam_neet_physics_physics-and-measurement_units-and-measurements";
const TOPIC_2 = "exam_neet_physics_kinematics_motion-in-straight-line";
const TOPIC_CHEM = "exam_neet_chemistry_basic-concepts-of-chemistry_matter-and-mole-concept";

function createMockSession(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    id: `sess_${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: "ws_test",
    topicId: TOPIC_1,
    questionCount: 10,
    correct: 7,
    incorrect: 3,
    unattempted: 0,
    durationMinutes: 20,
    completedAt: new Date("2026-09-25T10:00:00Z"),
    createdAt: new Date("2026-09-25T10:00:00Z"),
    updatedAt: new Date("2026-09-25T10:00:00Z"),
    ...overrides,
  };
}

describe("Practice Domain (Phase 9)", () => {
  // 1. accuracy calculation
  it("1. calculates accuracy in basis points correctly", () => {
    // 17 out of 20 = 85% = 8500 bps
    expect(calculateAccuracyBps(17, 20)).toBe(8500);
    // 1 out of 3 = 33.33% = 3333 bps
    expect(calculateAccuracyBps(1, 3)).toBe(3333);
    // 0 out of 10 = 0 bps
    expect(calculateAccuracyBps(0, 10)).toBe(0);
    // 10 out of 10 = 10000 bps
    expect(calculateAccuracyBps(10, 10)).toBe(10000);
    // 0 attempted = 0 bps
    expect(calculateAccuracyBps(0, 0)).toBe(0);
  });

  // 2. zero-question rejection
  it("2. rejects zero questions attempted in validation", () => {
    const result = validatePracticeInput({
      workspaceId: "ws_test",
      topicId: TOPIC_1,
      questionsAttempted: 0,
      correctAnswers: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes("at least 1"))).toBe(true);
    }
  });

  // 3. correct > attempted rejection
  it("3. rejects correct answers exceeding attempted questions in validation", () => {
    const result = validatePracticeInput({
      workspaceId: "ws_test",
      topicId: TOPIC_1,
      questionsAttempted: 20,
      correctAnswers: 21,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes("cannot exceed"))).toBe(true);
    }
  });

  // 4. weighted topic accuracy
  it("4. calculates weighted topic accuracy across sessions instead of blind percentage averaging", () => {
    // Session 1: 10 questions, 9 correct (90%)
    const s1 = createMockSession({ questionCount: 10, correct: 9, incorrect: 1 });
    // Session 2: 100 questions, 50 correct (50%)
    const s2 = createMockSession({ questionCount: 100, correct: 50, incorrect: 50 });

    const perf = aggregateTopicPerformance(TOPIC_1, [s1, s2]);
    // Correct weighted accuracy: (9 + 50) / (10 + 100) = 59 / 110 = 53.64% = 5364 bps
    // NOT (90% + 50%) / 2 = 70%
    expect(perf.totalQuestions).toBe(110);
    expect(perf.totalCorrect).toBe(59);
    expect(perf.accuracy).toBe(5364);
    expect(perf.accuracy).not.toBe(7000);
  });

  // 5. topic session aggregation
  it("5. aggregates topic performance correctly with counts and timestamps", () => {
    const s1 = createMockSession({
      questionCount: 15,
      correct: 10,
      incorrect: 5,
      completedAt: new Date("2026-09-24T10:00:00Z"),
    });
    const s2 = createMockSession({
      questionCount: 25,
      correct: 20,
      incorrect: 5,
      completedAt: new Date("2026-09-25T14:30:00Z"),
    });

    const perf = aggregateTopicPerformance(TOPIC_1, [s1, s2]);
    expect(perf.topicId).toBe(TOPIC_1);
    expect(perf.totalQuestions).toBe(40);
    expect(perf.totalCorrect).toBe(30);
    expect(perf.totalIncorrect).toBe(10);
    expect(perf.sessionCount).toBe(2);
    expect(perf.accuracy).toBe(7500); // 75%
    expect(perf.lastPracticedAt).toEqual(new Date("2026-09-25T14:30:00Z"));
  });

  // 6. subject aggregation
  it("6. aggregates subject performance according to canonical syllabus taxonomy", () => {
    const sPhys = createMockSession({
      topicId: TOPIC_1, // Physics
      questionCount: 30,
      correct: 24,
      incorrect: 6,
    });
    const sChem = createMockSession({
      topicId: TOPIC_CHEM, // Chemistry
      questionCount: 40,
      correct: 20,
      incorrect: 20,
    });

    const subjects = getSubjectPracticePerformance(EXAM_ATTEMPT, [sPhys, sChem]);
    expect(subjects.length).toBe(3); // Physics, Chemistry, Biology

    const physics = subjects.find((s) => s.subjectSlug === "physics");
    const chemistry = subjects.find((s) => s.subjectSlug === "chemistry");
    const biology = subjects.find((s) => s.subjectSlug === "biology");

    expect(physics?.totalQuestions).toBe(30);
    expect(physics?.totalCorrect).toBe(24);
    expect(physics?.accuracy).toBe(8000); // 80%
    expect(physics?.sessionCount).toBe(1);

    expect(chemistry?.totalQuestions).toBe(40);
    expect(chemistry?.totalCorrect).toBe(20);
    expect(chemistry?.accuracy).toBe(5000); // 50%
    expect(chemistry?.sessionCount).toBe(1);

    expect(biology?.totalQuestions).toBe(0);
    expect(biology?.accuracy).toBe(0);
    expect(biology?.sessionCount).toBe(0);

    // Verify canonical order (Physics first, then Chemistry, then Biology)
    expect(subjects[0].subjectSlug).toBe("physics");
    expect(subjects[1].subjectSlug).toBe("chemistry");
    expect(subjects[2].subjectSlug).toBe("biology");
  });

  // 7. overall summary
  it("7. calculates overall practice snapshot across all sessions", () => {
    const s1 = createMockSession({ questionCount: 20, correct: 15, incorrect: 5 });
    const s2 = createMockSession({ questionCount: 30, correct: 25, incorrect: 5 });

    const snapshot = getOverallPracticeSnapshot([s1, s2]);
    expect(snapshot.totalQuestions).toBe(50);
    expect(snapshot.totalCorrect).toBe(40);
    expect(snapshot.totalIncorrect).toBe(10);
    expect(snapshot.accuracy).toBe(8000); // 80%
    expect(snapshot.sessionCount).toBe(2);
  });

  // 8. weak-topic threshold
  it("8. centralizes weak threshold at 6000 bps (60%)", () => {
    expect(PRACTICE_WEAK_ACCURACY_BPS).toBe(6000);
  });

  // 9. exactly 60% is not weak
  it("9. determines that exactly 60% (6000 bps) is not weak", () => {
    expect(isTopicPracticeWeak(10, 6000)).toBe(false);
  });

  // 10. below 60% is weak
  it("10. determines that below 60% (e.g. 59% / 5900 bps) is weak", () => {
    expect(isTopicPracticeWeak(10, 5999)).toBe(true);
    expect(isTopicPracticeWeak(10, 5900)).toBe(true);
    expect(isTopicPracticeWeak(10, 4500)).toBe(true);
  });

  // 11. no practice data is not weak
  it("11. determines that zero questions attempted is never weak", () => {
    expect(isTopicPracticeWeak(0, 0)).toBe(false);
    expect(isTopicPracticeWeak(0, 5000)).toBe(false);
  });

  // 12. recent session sorting
  it("12. sorts recent sessions newest first with stable secondary tie-breaker", () => {
    const sOld = createMockSession({
      id: "sess_a",
      completedAt: new Date("2026-09-20T10:00:00Z"),
    });
    const sNew = createMockSession({
      id: "sess_b",
      completedAt: new Date("2026-09-25T10:00:00Z"),
    });
    const sTie1 = createMockSession({
      id: "sess_c",
      completedAt: new Date("2026-09-25T10:00:00Z"),
    });

    const sorted = sortRecentPracticeSessions([sOld, sNew, sTie1]);
    expect(sorted[0].completedAt?.getTime()).toBe(new Date("2026-09-25T10:00:00Z").getTime());
    expect(sorted[2].id).toBe("sess_a");
  });

  // 13. deterministic topic sorting
  it("13. sorts weak topics deterministically: lowest accuracy first, then newest, then alphabetical", () => {
    const sWeak1 = createMockSession({
      topicId: TOPIC_1,
      questionCount: 20,
      correct: 10, // 50%
      incorrect: 10,
      completedAt: new Date("2026-09-24T10:00:00Z"),
    });
    const sWeak2 = createMockSession({
      topicId: TOPIC_2,
      questionCount: 20,
      correct: 8, // 40%
      incorrect: 12,
      completedAt: new Date("2026-09-25T10:00:00Z"),
    });

    const weakList = getWeakTopics(EXAM_ATTEMPT, [sWeak1, sWeak2]);
    expect(weakList.length).toBe(2);
    // TOPIC_2 has 40% accuracy, TOPIC_1 has 50% accuracy -> TOPIC_2 must come first
    expect(weakList[0].topicId).toBe(TOPIC_2);
    expect(weakList[1].topicId).toBe(TOPIC_1);
  });

  // 14. subject filter
  it("14. filters topic performances by subject correctly", () => {
    const items: TopicPracticePerformance[] = [
      {
        topicId: TOPIC_1,
        topicName: "Units",
        chapterId: "c1",
        chapterName: "Measurements",
        subjectId: "s1",
        subjectName: "Physics",
        subjectSlug: "physics",
        totalQuestions: 20,
        totalCorrect: 15,
        totalIncorrect: 5,
        accuracy: 7500,
        sessionCount: 1,
        lastPracticedAt: new Date(),
        isWeak: false,
      },
      {
        topicId: TOPIC_CHEM,
        topicName: "Matter",
        chapterId: "c2",
        chapterName: "Concepts",
        subjectId: "s2",
        subjectName: "Chemistry",
        subjectSlug: "chemistry",
        totalQuestions: 20,
        totalCorrect: 10,
        totalIncorrect: 10,
        accuracy: 5000,
        sessionCount: 1,
        lastPracticedAt: new Date(),
        isWeak: true,
      },
    ];

    const physicsOnly = filterTopicPerformances(items, "physics", "all");
    expect(physicsOnly.length).toBe(1);
    expect(physicsOnly[0].subjectSlug).toBe("physics");

    const chemOnly = filterTopicPerformances(items, "chemistry", "all");
    expect(chemOnly.length).toBe(1);
    expect(chemOnly[0].subjectSlug).toBe("chemistry");
  });

  // 15. weak filter
  it("15. filters topic performances by weak performance classification", () => {
    const items: TopicPracticePerformance[] = [
      {
        topicId: TOPIC_1,
        topicName: "Units",
        chapterId: "c1",
        chapterName: "Measurements",
        subjectId: "s1",
        subjectName: "Physics",
        subjectSlug: "physics",
        totalQuestions: 20,
        totalCorrect: 15,
        totalIncorrect: 5,
        accuracy: 7500,
        sessionCount: 1,
        lastPracticedAt: new Date(),
        isWeak: false,
      },
      {
        topicId: TOPIC_2,
        topicName: "Motion",
        chapterId: "c1",
        chapterName: "Kinematics",
        subjectId: "s1",
        subjectName: "Physics",
        subjectSlug: "physics",
        totalQuestions: 20,
        totalCorrect: 10,
        totalIncorrect: 10,
        accuracy: 5000,
        sessionCount: 1,
        lastPracticedAt: new Date(),
        isWeak: true,
      },
    ];

    const weakOnly = filterTopicPerformances(items, "all", "weak");
    expect(weakOnly.length).toBe(1);
    expect(weakOnly[0].topicId).toBe(TOPIC_2);
  });

  // 16. combined filters
  it("16. composes subject and performance filters correctly", () => {
    const items: TopicPracticePerformance[] = [
      {
        topicId: TOPIC_1,
        topicName: "Units",
        chapterId: "c1",
        chapterName: "Measurements",
        subjectId: "s1",
        subjectName: "Physics",
        subjectSlug: "physics",
        totalQuestions: 20,
        totalCorrect: 15,
        totalIncorrect: 5,
        accuracy: 7500,
        sessionCount: 1,
        lastPracticedAt: new Date(),
        isWeak: false,
      },
      {
        topicId: TOPIC_2,
        topicName: "Motion",
        chapterId: "c1",
        chapterName: "Kinematics",
        subjectId: "s1",
        subjectName: "Physics",
        subjectSlug: "physics",
        totalQuestions: 20,
        totalCorrect: 10,
        totalIncorrect: 10,
        accuracy: 5000,
        sessionCount: 1,
        lastPracticedAt: new Date(),
        isWeak: true,
      },
      {
        topicId: TOPIC_CHEM,
        topicName: "Matter",
        chapterId: "c2",
        chapterName: "Concepts",
        subjectId: "s2",
        subjectName: "Chemistry",
        subjectSlug: "chemistry",
        totalQuestions: 20,
        totalCorrect: 8,
        totalIncorrect: 12,
        accuracy: 4000,
        sessionCount: 1,
        lastPracticedAt: new Date(),
        isWeak: true,
      },
    ];

    // Physics + Weak -> Only TOPIC_2
    const physicsWeak = filterTopicPerformances(items, "physics", "weak");
    expect(physicsWeak.length).toBe(1);
    expect(physicsWeak[0].topicId).toBe(TOPIC_2);

    // Chemistry + Weak -> Only TOPIC_CHEM
    const chemWeak = filterTopicPerformances(items, "chemistry", "weak");
    expect(chemWeak.length).toBe(1);
    expect(chemWeak[0].topicId).toBe(TOPIC_CHEM);
  });

  // 17. practice input validation
  it("17. validates practice input with integer and range requirements", () => {
    const valid = validatePracticeInput({
      workspaceId: "ws_1",
      topicId: TOPIC_1,
      questionsAttempted: 25,
      correctAnswers: 20,
      durationMinutes: 45,
      sessionType: "focused",
    });
    expect(valid.success).toBe(true);

    const negativeCorrect = validatePracticeInput({
      workspaceId: "ws_1",
      topicId: TOPIC_1,
      questionsAttempted: 25,
      correctAnswers: -1,
    });
    expect(negativeCorrect.success).toBe(false);

    const floatQuestions = validatePracticeInput({
      workspaceId: "ws_1",
      topicId: TOPIC_1,
      questionsAttempted: 10.5,
      correctAnswers: 5,
    });
    expect(floatQuestions.success).toBe(false);
  });

  // 18. accuracy representation conversion
  it("18. converts between basis points and percent representations accurately", () => {
    // 69.7% = 6970 bps
    expect(calculateAccuracyBps(697, 1000)).toBe(6970);
    expect(formatAccuracy(6970)).toBe("69.7%");

    // 100% = 10000 bps
    expect(calculateAccuracyBps(50, 50)).toBe(10000);
    expect(formatAccuracy(10000)).toBe("100%");

    // 0% = 0 bps
    expect(calculateAccuracyBps(0, 50)).toBe(0);
    expect(formatAccuracy(0)).toBe("0%");
  });

  // 19. performance formatting
  it("19. formats whole percentages without trailing zero decimals", () => {
    expect(formatAccuracy(7400)).toBe("74%");
    expect(formatAccuracy(6000)).toBe("60%");
    expect(formatAccuracy(5420)).toBe("54.2%");
  });

  // 20. empty state behavior
  it("20. handles empty practice state cleanly without division by zero or errors", () => {
    const emptySnapshot = getOverallPracticeSnapshot([]);
    expect(emptySnapshot.totalQuestions).toBe(0);
    expect(emptySnapshot.totalCorrect).toBe(0);
    expect(emptySnapshot.accuracy).toBe(0);
    expect(emptySnapshot.sessionCount).toBe(0);

    const emptyWeak = getWeakTopics(EXAM_ATTEMPT, []);
    expect(emptyWeak).toEqual([]);

    const emptySubjects = getSubjectPracticePerformance(EXAM_ATTEMPT, []);
    expect(emptySubjects.every((s) => s.totalQuestions === 0 && s.accuracy === 0)).toBe(true);
  });

  // Additional: Progress synchronization and revision preservation
  it("preserves revision state and topic status semantics when updating progress", () => {
    const existingProgress: UserTopicProgress = {
      id: "prog_1",
      workspaceId: "ws_1",
      topicId: TOPIC_1,
      status: "revised",
      startedAt: new Date("2026-09-01"),
      learnedAt: new Date("2026-09-05"),
      practicedAt: null,
      revisedAt: new Date("2026-09-10"),
      masteredAt: null,
      practiceAttempts: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      accuracy: 0,
      lastStudiedAt: new Date("2026-09-10"),
      lastRevisedAt: new Date("2026-09-10"),
      nextRevisionAt: new Date("2026-09-28"),
      notes: "Important formulas",
      createdAt: new Date("2026-09-01"),
      updatedAt: new Date("2026-09-10"),
    };

    const session = createMockSession({
      topicId: TOPIC_1,
      questionCount: 20,
      correct: 16,
      incorrect: 4,
    });

    const patch = applyPracticeSessionToProgress({
      workspaceId: "ws_1",
      topicId: TOPIC_1,
      existingProgress,
      sessions: [session],
      completedAt: new Date("2026-09-25T12:00:00Z"),
    });

    // Practice fields updated
    expect(patch.practiceAttempts).toBe(20);
    expect(patch.correctAnswers).toBe(16);
    expect(patch.incorrectAnswers).toBe(4);
    expect(patch.accuracy).toBe(8000);
    expect(patch.practicedAt).toEqual(new Date("2026-09-25T12:00:00Z"));

    // Revision and progress state preserved
    expect(patch.status).toBe("revised"); // NOT overwritten
    expect(patch.learnedAt).toEqual(new Date("2026-09-05"));
    expect(patch.revisedAt).toEqual(new Date("2026-09-10"));
    expect(patch.lastRevisedAt).toEqual(new Date("2026-09-10"));
    expect(patch.nextRevisionAt).toEqual(new Date("2026-09-28"));
    expect(patch.notes).toBe("Important formulas");
  });
});
