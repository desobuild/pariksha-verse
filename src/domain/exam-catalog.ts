import { neetSeedData } from "@/db/seeds/data/neet";
import type { SeedExamData } from "@/db/seeds/data/neet";

/**
 * Registry of every seeded exam curriculum dataset.
 * NEET is currently the first populated dataset — not a special application mode.
 * Adding a new supported exam means appending its SeedExamData here.
 */
const SEEDED_EXAM_DATASETS: SeedExamData[] = [neetSeedData];

export interface ExamCatalogEntry {
  /** Stable catalog slug (matches seeded exam slug when supported). */
  slug: string;
  shortName: string;
  name: string;
  category: string;
}

/**
 * Exams recognized by the product catalog. Unsupported entries render as
 * "Coming soon" until a verified curriculum dataset is registered above.
 */
const EXAM_CATALOG: ExamCatalogEntry[] = [
  { slug: "neet", shortName: "NEET", name: "National Eligibility cum Entrance Test (Undergraduate)", category: "Medical (UG)" },
  { slug: "jee", shortName: "JEE", name: "Joint Entrance Examination", category: "Engineering (UG)" },
  { slug: "upsc", shortName: "UPSC", name: "Union Public Service Commission Civil Services", category: "Civil Services" },
  { slug: "ssc", shortName: "SSC", name: "Staff Selection Commission Exams", category: "Govt. Exams" },
  { slug: "gate", shortName: "GATE", name: "Graduate Aptitude Test in Engineering", category: "Engineering (PG)" },
  { slug: "cat", shortName: "CAT", name: "Common Admission Test", category: "MBA / Management" },
  { slug: "cuet", shortName: "CUET", name: "Common University Entrance Test", category: "UG Entrance" },
  { slug: "banking", shortName: "Banking", name: "Banking Exams (IBPS / SBI / RBI)", category: "Bank Exams" },
];

export interface AvailableExam {
  id: string;
  slug: string;
  shortName: string;
  name: string;
  category: string;
  /** True when a verified curriculum dataset (with at least one attempt) is registered. */
  isSupported: boolean;
  attemptCount: number;
}

export interface ExamAttemptOption {
  id: string;
  examId: string;
  examSlug: string;
  slug: string;
  label: string;
  examDate: Date | null;
  status: "upcoming" | "active" | "completed" | "archived";
  isProvisional: boolean;
  provisionalNotice?: string;
}

function toAttemptOptions(dataset: SeedExamData): ExamAttemptOption[] {
  const attempt = dataset.attempt;
  return [
    {
      id: attempt.id,
      examId: dataset.exam.id,
      examSlug: dataset.exam.slug,
      slug: attempt.slug,
      label: attempt.label,
      examDate: attempt.examDate,
      status: attempt.status,
      isProvisional: attempt.metadata?.syllabusStatus === "provisional",
      provisionalNotice:
        typeof attempt.metadata?.provisionalNotice === "string"
          ? (attempt.metadata.provisionalNotice as string)
          : undefined,
    },
  ];
}

/**
 * Lists every catalog exam with its live support status derived from the
 * seeded curriculum registry — never from a hardcoded exam branch.
 */
export function listAvailableExams(): AvailableExam[] {
  return EXAM_CATALOG.map((entry) => {
    const dataset = SEEDED_EXAM_DATASETS.find(
      (d) => d.exam.slug === entry.slug || d.exam.shortName.toLowerCase() === entry.shortName.toLowerCase()
    );
    return {
      id: dataset?.exam.id ?? `exam_${entry.slug}`,
      slug: entry.slug,
      shortName: entry.shortName,
      name: entry.name,
      category: entry.category,
      isSupported: Boolean(dataset),
      attemptCount: dataset ? toAttemptOptions(dataset).length : 0,
    };
  });
}

/** Returns the seeded attempts for a supported exam (empty for unsupported exams). */
export function listExamAttempts(examSlug: string): ExamAttemptOption[] {
  const dataset = SEEDED_EXAM_DATASETS.find(
    (d) =>
      d.exam.slug === examSlug.toLowerCase() ||
      d.exam.shortName.toLowerCase() === examSlug.toLowerCase()
  );
  return dataset ? toAttemptOptions(dataset) : [];
}

/** Resolves a single attempt by id or slug across all seeded datasets. */
export function getExamAttempt(attemptIdOrSlug: string): ExamAttemptOption | null {
  if (!attemptIdOrSlug) return null;
  for (const dataset of SEEDED_EXAM_DATASETS) {
    const match = toAttemptOptions(dataset).find(
      (a) => a.id === attemptIdOrSlug || a.slug === attemptIdOrSlug
    );
    if (match) return match;
  }
  return null;
}

/** Resolves the exam catalog entry that owns an attempt. */
export function getExamForAttempt(attemptIdOrSlug: string): ExamCatalogEntry | null {
  const dataset = SEEDED_EXAM_DATASETS.find(
    (d) =>
      d.attempt.id === attemptIdOrSlug ||
      d.attempt.slug === attemptIdOrSlug
  );
  if (!dataset) return null;
  return (
    EXAM_CATALOG.find((e) => e.slug === dataset.exam.slug) ?? {
      slug: dataset.exam.slug,
      shortName: dataset.exam.shortName,
      name: dataset.exam.name,
      category: dataset.exam.category,
    }
  );
}
