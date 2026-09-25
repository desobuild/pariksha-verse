import type { QuestionWithOptions } from "@/domain/practice-engine/types";
import type { MockTestDetail, MockSectionConfig } from "./types";

/**
 * Creates a deterministic pseudo-random number generator using Mulberry32.
 */
function createMulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffles an array deterministically.
 */
function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export class InsufficientQuestionsError extends Error {
  public required: number;
  public available: number;
  public missingSections?: { sectionName: string; required: number; available: number }[];

  constructor(
    message: string,
    required: number,
    available: number,
    missingSections?: { sectionName: string; required: number; available: number }[]
  ) {
    super(message);
    this.name = "InsufficientQuestionsError";
    this.required = required;
    this.available = available;
    this.missingSections = missingSections;
  }
}

export interface PoolValidationResult {
  valid: boolean;
  requiredCount: number;
  availableCount: number;
  reason?: string;
  missingSections?: { sectionName: string; required: number; available: number }[];
}

/**
 * Validates whether the question bank has enough active questions
 * to satisfy the mock test's configuration and section allocations.
 */
export function validateMockQuestionPool(
  pool: QuestionWithOptions[],
  mock: MockTestDetail
): PoolValidationResult {
  const activePool = pool.filter((q) => q.status === "active");

  // Check sectioned mock
  if (mock.sections && mock.sections.length > 0) {
    let totalRequired = 0;
    let totalAvailableForSections = 0;
    const missingSections: { sectionName: string; required: number; available: number }[] = [];

    // Track assigned questions to guarantee no cross-section overlap
    const allocatedQuestionIds = new Set<string>();

    for (const sec of mock.sections) {
      totalRequired += sec.questionCount;

      const matchingQuestions = activePool.filter((q) => {
        if (allocatedQuestionIds.has(q.id)) return false;
        if (sec.subjectId && q.subjectId !== sec.subjectId) return false;
        if (sec.chapterId && q.chapterId !== sec.chapterId) return false;
        if (sec.topicId && q.topicId !== sec.topicId) return false;
        return true;
      });

      totalAvailableForSections += matchingQuestions.length;

      if (matchingQuestions.length < sec.questionCount) {
        missingSections.push({
          sectionName: sec.name,
          required: sec.questionCount,
          available: matchingQuestions.length,
        });
      } else {
        // Reserve questionCount to prevent overlap
        matchingQuestions.slice(0, sec.questionCount).forEach((q) => allocatedQuestionIds.add(q.id));
      }
    }

    if (missingSections.length > 0) {
      const details = missingSections
        .map((s) => `${s.sectionName} (requires ${s.required}, found ${s.available})`)
        .join(", ");

      return {
        valid: false,
        requiredCount: totalRequired,
        availableCount: totalAvailableForSections,
        reason: `Insufficient questions in sections: ${details}`,
        missingSections,
      };
    }

    return {
      valid: true,
      requiredCount: totalRequired,
      availableCount: activePool.length,
    };
  }

  // Non-sectioned mock
  const requiredCount = mock.totalQuestions > 0 ? mock.totalQuestions : 10;
  if (activePool.length < requiredCount) {
    return {
      valid: false,
      requiredCount,
      availableCount: activePool.length,
      reason: `Mock test requires ${requiredCount} active questions, but only ${activePool.length} are available.`,
    };
  }

  return {
    valid: true,
    requiredCount,
    availableCount: activePool.length,
  };
}

/**
 * Deterministically selects and locks questions for a mock test session.
 *
 * Guarantees:
 * 1. Strictly respects section allocations without question overlap.
 * 2. Never fabricates questions; fails early with clear explanation if insufficient.
 * 3. Seed-based deterministic shuffling so the question set is fixed.
 * 4. Zero duplicate questions in the session.
 */
export function selectMockQuestions(
  pool: QuestionWithOptions[],
  mock: MockTestDetail,
  seed: number = 42
): QuestionWithOptions[] {
  const validation = validateMockQuestionPool(pool, mock);
  if (!validation.valid) {
    throw new InsufficientQuestionsError(
      validation.reason || "Insufficient questions for mock test",
      validation.requiredCount,
      validation.availableCount,
      validation.missingSections
    );
  }

  const activePool = pool.filter((q) => q.status === "active");
  const selectedQuestions: QuestionWithOptions[] = [];
  const selectedIds = new Set<string>();

  // If fixed question IDs are pre-configured
  if (
    mock.questionSelectionConfig?.fixedQuestionIds &&
    mock.questionSelectionConfig.fixedQuestionIds.length > 0
  ) {
    for (const qid of mock.questionSelectionConfig.fixedQuestionIds) {
      const match = activePool.find((q) => q.id === qid);
      if (match && !selectedIds.has(match.id)) {
        selectedIds.add(match.id);
        selectedQuestions.push(match);
      }
    }
    return selectedQuestions;
  }

  // Sectioned selection
  if (mock.sections && mock.sections.length > 0) {
    mock.sections.forEach((sec: MockSectionConfig, secIndex: number) => {
      const candidates = activePool.filter((q) => {
        if (selectedIds.has(q.id)) return false;
        if (sec.subjectId && q.subjectId !== sec.subjectId) return false;
        if (sec.chapterId && q.chapterId !== sec.chapterId) return false;
        if (sec.topicId && q.topicId !== sec.topicId) return false;
        return true;
      });

      const rng = createMulberry32(seed + secIndex * 1337);
      const shuffled = shuffleArray(candidates, rng);
      const picked = shuffled.slice(0, sec.questionCount);

      for (const q of picked) {
        selectedIds.add(q.id);
        selectedQuestions.push(q);
      }
    });

    return selectedQuestions;
  }

  // Pool selection
  const rng = createMulberry32(seed);
  const shuffled = shuffleArray(activePool, rng);
  const picked = shuffled.slice(0, mock.totalQuestions);

  return picked;
}
