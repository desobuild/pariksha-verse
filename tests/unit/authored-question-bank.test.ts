import { describe, it, expect } from "vitest";
import {
  AUTHORED_QUESTIONS,
  AUTHORED_PHYSICS_QUESTIONS,
  AUTHORED_CHEMISTRY_QUESTIONS,
  AUTHORED_BIOLOGY_QUESTIONS,
} from "@/data/questions/neet-authored";
import { validateAuthoredQuestionBank, normalizeStem } from "@/data/questions/validation";
import { FIXTURE_QUESTIONS } from "@/domain/practice-engine/fixtures";
import { neetSeedData } from "@/db/seeds/data/neet";
import { createAuthoredSampleMockForWorkspace } from "@/data/questions/neet-authored-mock";

/**
 * Content QA gate for the V1 authored (production) question bank.
 * These tests fail loudly if malformed content is ever introduced.
 */
describe("V1 Authored Question Bank: Content Validation", () => {
  const result = validateAuthoredQuestionBank(AUTHORED_QUESTIONS);

  it("passes the full deterministic validation with ZERO errors", () => {
    expect(result.errors).toEqual([]);
  });

  it("raises no near-duplicate stem warnings requiring review", () => {
    expect(result.warnings).toEqual([]);
  });

  it("contains approximately 150 questions (145-155 band)", () => {
    expect(AUTHORED_QUESTIONS.length).toBeGreaterThanOrEqual(145);
    expect(AUTHORED_QUESTIONS.length).toBeLessThanOrEqual(155);
    expect(result.stats.totalQuestions).toBe(AUTHORED_QUESTIONS.length);
  });

  it("balances the three subjects ~50/50/50", () => {
    expect(AUTHORED_PHYSICS_QUESTIONS.length).toBe(50);
    expect(AUTHORED_CHEMISTRY_QUESTIONS.length).toBe(50);
    expect(AUTHORED_BIOLOGY_QUESTIONS.length).toBe(50);
    expect(result.stats.bySubject).toEqual({
      Physics: 50,
      Chemistry: 50,
      Biology: 50,
    });
  });

  it("spreads questions across a meaningful selection of existing topics", () => {
    // 139 canonical topics exist; the starter bank must not collapse into a few.
    expect(result.stats.topicsCovered).toBeGreaterThanOrEqual(40);
    expect(result.stats.topicsCovered).toBeLessThanOrEqual(139);

    // No single topic may hold more than a small starter share.
    const perTopic = new Map<string, number>();
    for (const q of AUTHORED_QUESTIONS) {
      perTopic.set(q.topicId, (perTopic.get(q.topicId) || 0) + 1);
    }
    for (const [, count] of perTopic) {
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it("maps every question strictly onto the canonical NEET taxonomy", () => {
    const validTopicIds = new Set<string>();
    const topicToSubject = new Map<string, string>();
    const topicToChapter = new Map<string, string>();
    for (const sub of neetSeedData.subjects) {
      const subjectId = `${neetSeedData.exam.id}_${sub.slug}`;
      for (const chap of sub.chapters) {
        const chapterId = `${subjectId}_${chap.slug}`;
        for (const top of chap.topics) {
          const topicId = `${chapterId}_${top.slug}`;
          validTopicIds.add(topicId);
          topicToSubject.set(topicId, subjectId);
          topicToChapter.set(topicId, chapterId);
        }
      }
    }

    for (const q of AUTHORED_QUESTIONS) {
      expect(validTopicIds.has(q.topicId)).toBe(true);
      expect(topicToSubject.get(q.topicId)).toBe(q.subjectId);
      expect(topicToChapter.get(q.topicId)).toBe(q.chapterId);
      expect(q.examId).toBe("exam_neet");
    }
  });

  it("uses stable, readable question and option IDs with no duplicates", () => {
    const questionIds = AUTHORED_QUESTIONS.map((q) => q.id);
    expect(new Set(questionIds).size).toBe(questionIds.length);
    for (const id of questionIds) {
      expect(id).toMatch(/^q_auth_(phy|chm|bio)_\d{3}$/);
    }

    const optionIds = AUTHORED_QUESTIONS.flatMap((q) => q.options.map((o) => o.id));
    expect(new Set(optionIds).size).toBe(optionIds.length);
    for (const id of optionIds) {
      expect(id).toMatch(/^opt_auth_(phy|chm|bio)\d{3}_[abcd]$/);
    }
  });

  it("marks every question provenance=authored with ParikshaVerse attribution and no fake sources", () => {
    for (const q of AUTHORED_QUESTIONS) {
      expect(q.provenance).toBe("authored");
      expect(q.source).toBe("ParikshaVerse Authored Bank");
      expect(q.attribution).toBe("Original practice content");
      expect(q.sourceUrl).toBeNull();
      expect(q.externalId).toBeNull();
      expect(q.year).toBeNull();
      expect(q.license).toBeNull();
      expect(q.status).toBe("active");
    }
  });

  it("uses only SINGLE_CHOICE with exactly one correct option among 4 options", () => {
    for (const q of AUTHORED_QUESTIONS) {
      expect(q.type).toBe("single_choice");
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => o.isCorrect)).toHaveLength(1);

      const keys = q.options.map((o) => o.optionKey);
      expect(keys).toEqual(["A", "B", "C", "D"]);
      const orders = q.options.map((o) => o.displayOrder);
      expect(orders).toEqual([1, 2, 3, 4]);
    }
  });

  it("gives every question a clear stem and an educational explanation", () => {
    for (const q of AUTHORED_QUESTIONS) {
      expect(q.text.trim().length).toBeGreaterThan(15);
      expect(q.explanation?.trim().length ?? 0).toBeGreaterThan(30);
    }
  });

  it("targets the ~30/50/20 difficulty distribution", () => {
    const total = AUTHORED_QUESTIONS.length;
    const { easy, medium, hard } = result.stats.byDifficulty;

    expect(easy / total).toBeGreaterThanOrEqual(0.25);
    expect(easy / total).toBeLessThanOrEqual(0.35);
    expect(medium / total).toBeGreaterThanOrEqual(0.45);
    expect(medium / total).toBeLessThanOrEqual(0.55);
    expect(hard / total).toBeGreaterThanOrEqual(0.15);
    expect(hard / total).toBeLessThanOrEqual(0.25);
  });

  it("keeps authored content strictly separate from test fixtures", () => {
    const fixtureIds = new Set(FIXTURE_QUESTIONS.map((f) => f.id));
    for (const q of AUTHORED_QUESTIONS) {
      expect(fixtureIds.has(q.id)).toBe(false);
      expect(q.provenance).not.toBe("fixture");
    }
    const authoredStems = new Set(AUTHORED_QUESTIONS.map((q) => normalizeStem(q.text)));
    for (const f of FIXTURE_QUESTIONS) {
      expect(authoredStems.has(normalizeStem(f.text))).toBe(false);
    }
  });

  it("detects malformed content when it is introduced (validator self-check)", () => {
    const broken = [
      {
        ...AUTHORED_QUESTIONS[0],
        id: "q_auth_phy_001",
        provenance: "fixture" as const,
        options: AUTHORED_QUESTIONS[0].options.map((o) => ({ ...o, isCorrect: false })),
      },
    ];
    const bad = validateAuthoredQuestionBank(broken, { includeWarnings: false });
    const codes = bad.errors.map((e) => e.code);
    expect(codes).toContain("provenance");
    expect(codes).toContain("no_correct_option");

    const duplicated = [AUTHORED_QUESTIONS[0], AUTHORED_QUESTIONS[1]].map((q, i) =>
      i === 0 ? q : { ...q, text: AUTHORED_QUESTIONS[0].text }
    );
    const dupResult = validateAuthoredQuestionBank(duplicated, { includeWarnings: false });
    expect(dupResult.errors.some((e) => e.code === "duplicate_stem")).toBe(true);
  });
});

describe("V1 Authored Sample Practice Mock", () => {
  const mock = createAuthoredSampleMockForWorkspace("ws_test");

  it("is clearly identified as a sample practice mock, never an official paper", () => {
    expect(mock.provenance).toBe("authored");
    expect(mock.title.toLowerCase()).toContain("sample practice mock");
    expect(mock.title.toLowerCase()).not.toContain("official");
    expect(mock.source).toBe("ParikshaVerse Authored Bank");
    expect(mock.externalUrl).toBeNull();
  });

  it("requests a small representative 30-question full-syllabus mock", () => {
    expect(mock.type).toBe("full_syllabus");
    expect(mock.totalQuestions).toBe(30);
    expect(mock.sections).toHaveLength(3);

    const phy = mock.sections.find((s) => s.subjectId === "exam_neet_physics");
    const chm = mock.sections.find((s) => s.subjectId === "exam_neet_chemistry");
    const bio = mock.sections.find((s) => s.subjectId === "exam_neet_biology");
    expect(phy?.questionCount).toBe(10);
    expect(chm?.questionCount).toBe(10);
    expect(bio?.questionCount).toBe(10);

    const sectionTotal = mock.sections.reduce((acc, s) => acc + s.questionCount, 0);
    expect(sectionTotal).toBe(mock.totalQuestions);
  });

  it("uses a stable per-workspace ID for idempotent seeding", () => {
    expect(mock.id).toBe("mock_ws_test_tpl_mock_authored_sample");
    expect(createAuthoredSampleMockForWorkspace("ws_test").id).toBe(mock.id);
  });
});
