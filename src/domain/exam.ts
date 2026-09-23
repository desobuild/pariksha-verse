import { neetAttempt, neetExam } from "@/db/seeds/data/neet";

export interface ResolvedExamAttempt {
  id: string;
  examId: string;
  slug: string;
  label: string;
  isProvisional: boolean;
  provisionalNotice?: string;
  examDate: Date | null;
  status: "upcoming" | "active" | "completed" | "archived";
}

export interface ResolvedExam {
  id: string;
  slug: string;
  shortName: string;
  name: string;
  category: string;
  status: "active" | "draft" | "archived";
}

/**
 * The canonical Phase 2 exam is NEET.
 */
export const CANONICAL_EXAM: ResolvedExam = {
  id: neetExam.id,
  slug: neetExam.slug,
  shortName: neetExam.shortName,
  name: neetExam.name,
  category: neetExam.category,
  status: neetExam.status,
};

/**
 * The canonical Phase 2 exam attempt is `neet-2027`.
 * It is provisional pending the official NEET-UG 2027 syllabus from NTA/NMC.
 */
export const CANONICAL_EXAM_ATTEMPT: ResolvedExamAttempt = {
  id: neetAttempt.id,
  examId: neetExam.id,
  slug: neetAttempt.slug,
  label: neetAttempt.label,
  isProvisional: neetAttempt.metadata.syllabusStatus === "provisional",
  provisionalNotice:
    typeof neetAttempt.metadata.provisionalNotice === "string"
      ? neetAttempt.metadata.provisionalNotice
      : undefined,
  examDate: neetAttempt.examDate,
  status: neetAttempt.status,
};

/**
 * Resolves the active exam attempt from seeded Phase 2 exam/attempt data.
 * Does not hardcode or invent unseeded attempts.
 */
export function resolveActiveExamAttempt(attemptIdOrSlug?: string): ResolvedExamAttempt {
  if (attemptIdOrSlug) {
    if (attemptIdOrSlug === neetAttempt.id || attemptIdOrSlug === neetAttempt.slug) {
      return CANONICAL_EXAM_ATTEMPT;
    }
  }
  return CANONICAL_EXAM_ATTEMPT;
}

/**
 * Checks whether an exam has seeded curriculum data.
 * Only exams with seeded curriculum data (currently NEET) are fully supported.
 * Other exams remain "Coming soon".
 */
export function isExamCurriculumSeeded(examSlugOrShortName: string): boolean {
  if (!examSlugOrShortName) return false;
  const normalized = examSlugOrShortName.trim().toLowerCase();
  return (
    normalized === neetExam.slug.toLowerCase() ||
    normalized === neetExam.shortName.toLowerCase()
  );
}
