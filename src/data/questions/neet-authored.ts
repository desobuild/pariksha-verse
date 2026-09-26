import type { QuestionWithOptions } from "@/domain/practice-engine/types";
import {
  buildAuthoredQuestion,
  buildTaxonomyTopicIndex,
  type AuthoredSubjectCode,
} from "./authored-types";
import { AUTHORED_PHYSICS_SPECS } from "./physics";
import { AUTHORED_CHEMISTRY_SPECS } from "./chemistry";
import { AUTHORED_BIOLOGY_SPECS } from "./biology";

export * from "./authored-types";

/**
 * Assembles the canonical authored (production) question bank.
 * Throws at module-load time if any spec references a non-canonical topic,
 * guaranteeing the bank can never silently drift out of the taxonomy.
 */
function assembleAuthoredBank(): QuestionWithOptions[] {
  const taxonomyIndex = buildTaxonomyTopicIndex();
  const entries: Array<[AuthoredSubjectCode, typeof AUTHORED_PHYSICS_SPECS]> = [
    ["phy", AUTHORED_PHYSICS_SPECS],
    ["chm", AUTHORED_CHEMISTRY_SPECS],
    ["bio", AUTHORED_BIOLOGY_SPECS],
  ];

  const bank: QuestionWithOptions[] = [];
  for (const [subject, specs] of entries) {
    for (const spec of specs) {
      bank.push(buildAuthoredQuestion(subject, spec, taxonomyIndex));
    }
  }
  return bank;
}

/** Production starter question bank: original ParikshaVerse authored content. */
export const AUTHORED_QUESTIONS: QuestionWithOptions[] = assembleAuthoredBank();

export const AUTHORED_PHYSICS_QUESTIONS = AUTHORED_QUESTIONS.filter((q) =>
  q.id.startsWith("q_auth_phy_")
);
export const AUTHORED_CHEMISTRY_QUESTIONS = AUTHORED_QUESTIONS.filter((q) =>
  q.id.startsWith("q_auth_chm_")
);
export const AUTHORED_BIOLOGY_QUESTIONS = AUTHORED_QUESTIONS.filter((q) =>
  q.id.startsWith("q_auth_bio_")
);
