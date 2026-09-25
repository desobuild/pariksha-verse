import type { QuestionWithOptions, PracticeScope } from "./types";

/**
 * Creates a deterministic pseudo-random number generator using Mulberry32.
 * Ensures consistent, reproducible shuffling for unit tests and deterministic sessions.
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
 * Shuffles an array in place using either a seeded PRNG or Math.random.
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

export interface SelectionOptions {
  seed?: number;
  shuffle?: boolean;
}

/**
 * Filters a pool of questions according to practice scope.
 * Exam-agnostic: matches on topicId, subjectId, or examId.
 */
export function filterQuestionsByScope(
  pool: QuestionWithOptions[],
  scope: PracticeScope,
  examId?: string
): QuestionWithOptions[] {
  return pool.filter((q) => {
    // Only active questions can be selected
    if (q.status !== "active") return false;

    // Optional exam check
    if (examId && q.examId !== examId) return false;

    switch (scope.type) {
      case "topic":
        return q.topicId === scope.topicId;
      case "subject":
        return q.subjectId === scope.subjectId;
      case "mixed":
        // Mixed scope covers all questions for the attempt/exam
        return true;
      default:
        return false;
    }
  });
}

/**
 * Selects questions for a practice session from an available pool.
 *
 * Guarantees:
 * 1. Respects practice scope
 * 2. Only selects active questions
 * 3. Never produces duplicate questions
 * 4. Never fabricates questions to fill a requested count
 * 5. Handles fewer available questions gracefully (returns all available)
 * 6. Deterministic and testable when a seed or shuffle=false is passed
 */
export function selectQuestionsForSession(
  pool: QuestionWithOptions[],
  requestedCount: number,
  options?: SelectionOptions
): QuestionWithOptions[] {
  if (!pool || pool.length === 0 || requestedCount <= 0) {
    return [];
  }

  // Deduplicate by question ID to ensure safety
  const seenIds = new Set<string>();
  const uniquePool: QuestionWithOptions[] = [];
  for (const q of pool) {
    if (q.status === "active" && !seenIds.has(q.id)) {
      seenIds.add(q.id);
      uniquePool.push(q);
    }
  }

  if (uniquePool.length === 0) {
    return [];
  }

  const shouldShuffle = options?.shuffle ?? true;
  let poolToSelectFrom = uniquePool;

  if (shouldShuffle) {
    const rng = options?.seed !== undefined ? createMulberry32(options.seed) : Math.random;
    poolToSelectFrom = shuffleArray(uniquePool, rng);
  } else {
    // Deterministic sort by id when not shuffling
    poolToSelectFrom = [...uniquePool].sort((a, b) => a.id.localeCompare(b.id));
  }

  // Take min(requestedCount, available count)
  const actualCount = Math.min(requestedCount, poolToSelectFrom.length);
  return poolToSelectFrom.slice(0, actualCount);
}
