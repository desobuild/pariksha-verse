import type { QuestionDifficulty, QuestionWithOptions } from "@/domain/practice-engine/types";
import { neetSeedData } from "@/db/seeds/data/neet";

/**
 * Canonical authored (production) question bank for ParikshaVerse.
 *
 * PROVENANCE NOTICE:
 * Every question in this module is ORIGINAL ParikshaVerse content, authored
 * specifically as starter practice material. No question in this bank is a
 * previous-year question (PYQ), an official exam question, a scraped item,
 * or a reproduction from a copyrighted question bank. All questions carry
 * provenance = "authored".
 *
 * This module is intentionally kept separate from the engine test fixtures in
 * src/domain/practice-engine/fixtures.ts, which remain test-only content.
 */

export const AUTHORED_SOURCE = "ParikshaVerse Authored Bank";
export const AUTHORED_ATTRIBUTION = "Original practice content";
export const AUTHORED_BANK_TIMESTAMP = new Date("2026-09-26T00:00:00.000Z");

/**
 * Authoring format: compact per-question specs expanded into the normalized
 * QuestionWithOptions model by buildAuthoredQuestion(). Option index 0..3 maps
 * to option keys A..D in display order; exactly one correctIndex is allowed.
 */
export interface AuthoredQuestionSpec {
  /** Stable numeric suffix, zero-padded (e.g. "001"). Full ID: q_auth_<subject>_<suffix>. */
  id: string;
  /** Full canonical topic ID from the seeded NEET taxonomy (topic IDs are never invented). */
  topicId: string;
  text: string;
  difficulty: QuestionDifficulty;
  explanation: string;
  /** Option texts in display order A, B, C, D. */
  options: [string, string, string, string];
  /** Zero-based index of the single correct option. */
  correctIndex: 0 | 1 | 2 | 3;
}

export type AuthoredSubjectCode = "phy" | "chm" | "bio";

export interface AuthoredTaxonomyRef {
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterName: string;
  topicId: string;
  topicName: string;
}

/**
 * Builds a lookup of every canonical topic ID in the seeded NEET taxonomy.
 * Used both to expand authored specs and to validate taxonomy integrity.
 */
export function buildTaxonomyTopicIndex(): Map<string, AuthoredTaxonomyRef> {
  const index = new Map<string, AuthoredTaxonomyRef>();
  const exam = neetSeedData.exam;

  for (const sub of neetSeedData.subjects) {
    const subjectId = `${exam.id}_${sub.slug}`;
    for (const chap of sub.chapters) {
      const chapterId = `${subjectId}_${chap.slug}`;
      for (const top of chap.topics) {
        const topicId = `${chapterId}_${top.slug}`;
        index.set(topicId, {
          subjectId,
          subjectName: sub.name,
          chapterId,
          chapterName: chap.name,
          topicId,
          topicName: top.name,
        });
      }
    }
  }
  return index;
}

export function authoredQuestionId(subject: AuthoredSubjectCode, suffix: string): string {
  return `q_auth_${subject}_${suffix}`;
}

export function authoredOptionId(
  subject: AuthoredSubjectCode,
  suffix: string,
  key: string
): string {
  return `opt_auth_${subject}${suffix}_${key.toLowerCase()}`;
}

/**
 * Expands an authored spec into the normalized QuestionWithOptions model.
 * Throws immediately if the topic ID is not part of the canonical taxonomy,
 * so malformed content can never enter the bank silently.
 */
export function buildAuthoredQuestion(
  subject: AuthoredSubjectCode,
  spec: AuthoredQuestionSpec,
  taxonomyIndex: Map<string, AuthoredTaxonomyRef>
): QuestionWithOptions {
  const ref = taxonomyIndex.get(spec.topicId);
  if (!ref) {
    throw new Error(
      `Authored question ${spec.id} references unknown topic "${spec.topicId}" which does not exist in the canonical taxonomy.`
    );
  }

  const questionId = authoredQuestionId(subject, spec.id);
  const optionKeys = ["A", "B", "C", "D"] as const;

  return {
    id: questionId,
    examId: neetSeedData.exam.id,
    subjectId: ref.subjectId,
    chapterId: ref.chapterId,
    topicId: ref.topicId,
    text: spec.text,
    type: "single_choice",
    difficulty: spec.difficulty,
    explanation: spec.explanation,
    source: AUTHORED_SOURCE,
    sourceUrl: null,
    attribution: AUTHORED_ATTRIBUTION,
    license: null,
    externalId: null,
    year: null,
    provenance: "authored",
    status: "active",
    options: spec.options.map((text, i) => ({
      id: authoredOptionId(subject, spec.id, optionKeys[i]),
      questionId,
      displayOrder: i + 1,
      optionKey: optionKeys[i],
      text,
      isCorrect: i === spec.correctIndex,
    })),
    createdAt: AUTHORED_BANK_TIMESTAMP,
    updatedAt: AUTHORED_BANK_TIMESTAMP,
  };
}
