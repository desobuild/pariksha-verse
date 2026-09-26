import type { QuestionWithOptions } from "@/domain/practice-engine/types";
import { FIXTURE_QUESTIONS } from "@/domain/practice-engine/fixtures";
import { neetSeedData } from "@/db/seeds/data/neet";
import {
  AUTHORED_QUESTIONS,
  buildTaxonomyTopicIndex,
  type AuthoredTaxonomyRef,
} from "./neet-authored";
import { AUTHORED_SOURCE, AUTHORED_ATTRIBUTION } from "./authored-types";

/**
 * Deterministic content validation for the authored question bank.
 *
 * The validator runs over the assembled AUTHORED_QUESTIONS dataset and the
 * canonical NEET taxonomy and reports every violation it can find. It is used
 * by unit tests and by the standalone check script so that malformed content
 * (bad taxonomy refs, zero/multiple correct options, duplicate stems, fake
 * source metadata, etc.) fails loudly instead of entering the bank.
 */

export type ValidationSeverity = "error" | "warning";

export interface AuthoredBankIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  questionId?: string;
}

export interface AuthoredBankValidationResult {
  errors: AuthoredBankIssue[];
  warnings: AuthoredBankIssue[];
  stats: {
    totalQuestions: number;
    bySubject: Record<string, number>;
    byDifficulty: Record<string, number>;
    topicsCovered: number;
  };
}

/** Stable ID contract for authored questions and their options. */
export const AUTHORED_QUESTION_ID_PATTERN = /^q_auth_(phy|chm|bio)_\d{3}$/;
export const AUTHORED_OPTION_ID_PATTERN = /^opt_auth_(phy|chm|bio)\d{3}_[abcd]$/;

const NORMALIZATION_WHITESPACE = /\s+/g;
const NORMALIZATION_PUNCTUATION = /[.,;:!?'"()\[\]{}—–-]/g;

/**
 * Normalizes a question stem for duplicate detection: lower-cased, punctuation
 * stripped, whitespace collapsed.
 */
export function normalizeStem(text: string): string {
  return text
    .toLowerCase()
    .replace(NORMALIZATION_PUNCTUATION, " ")
    .replace(NORMALIZATION_WHITESPACE, " ")
    .trim();
}

/** Token set for cheap near-duplicate (bag-of-words overlap) detection. */
function stemTokenSet(text: string): Set<string> {
  const tokens = normalizeStem(text)
    .split(" ")
    .filter((t) => t.length > 2);
  return new Set(tokens);
}

/**
 * Jaccard similarity between the token sets of two stems (0..1).
 * Values ≥ NEAR_DUPLICATE_THRESHOLD are flagged for manual review.
 */
export function stemSimilarity(a: string, b: string): number {
  const ta = stemTokenSet(a);
  const tb = stemTokenSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) {
    if (tb.has(token)) intersection++;
  }
  return intersection / (ta.size + tb.size - intersection);
}

export const NEAR_DUPLICATE_THRESHOLD = 0.85;

/**
 * Validates the authored question bank against the canonical taxonomy and the
 * question-engine invariants. Never mutates anything; failures are descriptive.
 */
export function validateAuthoredQuestionBank(
  bank: QuestionWithOptions[] = AUTHORED_QUESTIONS,
  options?: { includeWarnings?: boolean }
): AuthoredBankValidationResult {
  const includeWarnings = options?.includeWarnings ?? true;
  const errors: AuthoredBankIssue[] = [];
  const warnings: AuthoredBankIssue[] = [];

  const taxonomy: Map<string, AuthoredTaxonomyRef> = buildTaxonomyTopicIndex();

  const seenQuestionIds = new Set<string>();
  const seenOptionIds = new Set<string>();
  const exactStemIndex = new Map<string, string>(); // normalized stem -> first question id
  const stemsForNearDup: Array<{ id: string; text: string }> = [];

  const bySubject: Record<string, number> = { Physics: 0, Chemistry: 0, Biology: 0 };
  const byDifficulty: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  const topicsCovered = new Set<string>();

  for (const q of bank) {
    const fail = (code: string, message: string) =>
      errors.push({ severity: "error", code, message, questionId: q.id });

    // 1. Stable, unique question IDs (also collision-checked against fixtures below)
    if (!AUTHORED_QUESTION_ID_PATTERN.test(q.id)) {
      fail("id_format", `Question ID "${q.id}" does not match the stable authored ID pattern.`);
    }
    if (seenQuestionIds.has(q.id)) {
      fail("duplicate_question_id", `Question ID "${q.id}" appears more than once in the bank.`);
    }
    seenQuestionIds.add(q.id);

    // 2. Taxonomy integrity: topic must exist and parent IDs must agree
    const ref = taxonomy.get(q.topicId);
    if (!ref) {
      fail(
        "taxonomy_missing_topic",
        `Topic "${q.topicId}" does not exist in the canonical NEET taxonomy.`
      );
    } else {
      if (q.subjectId !== ref.subjectId) {
        fail(
          "taxonomy_subject_mismatch",
          `Subject ID "${q.subjectId}" does not match canonical "${ref.subjectId}" for topic "${q.topicId}".`
        );
      }
      if (q.chapterId !== ref.chapterId) {
        fail(
          "taxonomy_chapter_mismatch",
          `Chapter ID "${q.chapterId}" does not match canonical "${ref.chapterId}" for topic "${q.topicId}".`
        );
      }
      if (q.examId !== neetSeedData.exam.id) {
        fail("taxonomy_exam_mismatch", `Exam ID "${q.examId}" is not the canonical NEET exam ID.`);
      }
    }

    // 3. Provenance: authored, with honest ParikshaVerse attribution and no fake sources
    if (q.provenance !== "authored") {
      fail("provenance", `Provenance must be "authored" but is "${q.provenance}".`);
    }
    if (q.source !== AUTHORED_SOURCE) {
      fail("source_metadata", `Source must be "${AUTHORED_SOURCE}" but is "${q.source}".`);
    }
    if (q.attribution !== AUTHORED_ATTRIBUTION) {
      fail(
        "attribution",
        `Attribution must be "${AUTHORED_ATTRIBUTION}" but is "${q.attribution}".`
      );
    }
    if (q.sourceUrl || q.externalId || q.year || q.license) {
      fail(
        "fake_source_metadata",
        `Question carries external provenance metadata (sourceUrl/externalId/year/license) which authored original content must not have.`
      );
    }

    // 4. Type / difficulty / status
    if (q.type !== "single_choice") {
      fail("question_type", `Only SINGLE_CHOICE is supported; found "${q.type}".`);
    }
    if (q.difficulty !== "easy" && q.difficulty !== "medium" && q.difficulty !== "hard") {
      fail("difficulty", `Difficulty "${q.difficulty}" is not one of easy|medium|hard.`);
    }
    if (q.status !== "active") {
      fail("status", `Authored bank questions must be active; found "${q.status}".`);
    }

    // 5. Stem quality
    if (!q.text || q.text.trim().length < 10) {
      fail("stem_empty", "Question stem is empty or too short.");
    }
    if (!q.explanation || q.explanation.trim().length < 10) {
      fail("explanation_missing", "Every authored question must have a non-trivial explanation.");
    }

    // 6. Options: normalized model, >= 2, exactly one correct, unique IDs/keys
    if (!Array.isArray(q.options) || q.options.length < 2) {
      fail("options_count", "A question needs at least 2 options.");
    } else {
      const keys = new Set<string>();
      const orders = new Set<number>();
      const optionTexts = new Set<string>();
      let correctCount = 0;

      for (const opt of q.options) {
        if (opt.questionId !== q.id) {
          fail(
            "option_parent",
            `Option "${opt.id}" references question "${opt.questionId}" instead of "${q.id}".`
          );
        }
        if (!AUTHORED_OPTION_ID_PATTERN.test(opt.id)) {
          fail(
            "option_id_format",
            `Option ID "${opt.id}" does not match the stable authored pattern.`
          );
        }
        if (seenOptionIds.has(opt.id)) {
          fail("duplicate_option_id", `Option ID "${opt.id}" is used more than once.`);
        }
        seenOptionIds.add(opt.id);
        if (!opt.text || opt.text.trim().length === 0) {
          fail("option_empty", `Option "${opt.id}" has empty text.`);
        }
        if (keys.has(opt.optionKey)) {
          fail(
            "option_key_duplicate",
            `Option key "${opt.optionKey}" is repeated in question "${q.id}".`
          );
        }
        keys.add(opt.optionKey);
        if (orders.has(opt.displayOrder)) {
          fail(
            "option_order_duplicate",
            `Display order ${opt.displayOrder} is repeated in question "${q.id}".`
          );
        }
        orders.add(opt.displayOrder);
        optionTexts.add(normalizeStem(opt.text));
        if (opt.isCorrect) correctCount++;
      }

      if (optionTexts.size < q.options.length) {
        warnings.push({
          severity: "warning",
          code: "option_text_duplicate",
          message: `Question "${q.id}" has identical option texts; distractors should be distinct.`,
          questionId: q.id,
        });
      }
      if (correctCount === 0) {
        fail("no_correct_option", `Question "${q.id}" has no correct option.`);
      }
      if (correctCount > 1) {
        fail("multiple_correct_options", `Question "${q.id}" has ${correctCount} correct options.`);
      }
    }

    // 7. Duplicate stems
    const normalized = normalizeStem(q.text);
    const firstOwner = exactStemIndex.get(normalized);
    if (firstOwner) {
      fail("duplicate_stem", `Question "${q.id}" has a stem identical to "${firstOwner}".`);
    } else {
      exactStemIndex.set(normalized, q.id);
    }
    stemsForNearDup.push({ id: q.id, text: q.text });

    // Stats
    if (ref) {
      topicsCovered.add(q.topicId);
    }
    if (q.id.startsWith("q_auth_phy_")) bySubject.Physics++;
    else if (q.id.startsWith("q_auth_chm_")) bySubject.Chemistry++;
    else if (q.id.startsWith("q_auth_bio_")) bySubject.Biology++;
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;
  }

  // Collision with test fixtures: authored IDs must never shadow fixture IDs
  const fixtureIds = new Set(FIXTURE_QUESTIONS.map((f) => f.id));
  for (const id of seenQuestionIds) {
    if (fixtureIds.has(id)) {
      errors.push({
        severity: "error",
        code: "fixture_id_collision",
        message: `Authored question ID "${id}" collides with an existing fixture question ID.`,
        questionId: id,
      });
    }
  }

  // Near-duplicate stems: flagged for manual review, never auto-removed
  if (includeWarnings) {
    for (let i = 0; i < stemsForNearDup.length; i++) {
      for (let j = i + 1; j < stemsForNearDup.length; j++) {
        const a = stemsForNearDup[i];
        const b = stemsForNearDup[j];
        if (normalizeStem(a.text) === normalizeStem(b.text)) continue; // already an error
        if (stemSimilarity(a.text, b.text) >= NEAR_DUPLICATE_THRESHOLD) {
          warnings.push({
            severity: "warning",
            code: "near_duplicate_stem",
            message: `Questions "${a.id}" and "${b.id}" have highly similar stems; review for redundancy.`,
            questionId: b.id,
          });
        }
      }
    }
  }

  return {
    errors,
    warnings,
    stats: {
      totalQuestions: bank.length,
      bySubject,
      byDifficulty,
      topicsCovered: topicsCovered.size,
    },
  };
}
