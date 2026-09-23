import { z } from "zod";
import { getExamAttempt } from "./exam-catalog";

/**
 * Preparation personalization options (Phase 5).
 * Kept intentionally short — every field must directly improve planning.
 */

export const PREPARATION_STAGES = [
  {
    value: "just_starting",
    label: "Just starting",
    description: "New to the syllabus or returning after a long break.",
  },
  {
    value: "building_fundamentals",
    label: "Building fundamentals",
    description: "Learning core concepts chapter by chapter.",
  },
  {
    value: "practicing_regularly",
    label: "Practicing regularly",
    description: "Concepts largely covered; solving questions daily.",
  },
  {
    value: "revising",
    label: "Revising",
    description: "Cycling through revision with targeted practice.",
  },
  {
    value: "final_preparation",
    label: "Final preparation",
    description: "Final lap — mocks, error logs, and high-yield revision.",
  },
] as const;

export type PreparationStage = (typeof PREPARATION_STAGES)[number]["value"];

export const PREPARATION_STAGE_VALUES = PREPARATION_STAGES.map((s) => s.value) as [
  PreparationStage,
  ...PreparationStage[]
];

export function isPreparationStage(value: unknown): value is PreparationStage {
  return typeof value === "string" && PREPARATION_STAGE_VALUES.includes(value as PreparationStage);
}

export function getPreparationStageLabel(value: string | null | undefined): string {
  return PREPARATION_STAGES.find((s) => s.value === value)?.label ?? "—";
}

/** Sensible predefined daily study goal options (minutes). */
export const STUDY_GOAL_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hr" },
  { minutes: 90, label: "1.5 hrs" },
  { minutes: 120, label: "2 hrs" },
  { minutes: 180, label: "3 hrs" },
  { minutes: 300, label: "5 hrs" },
];

export const STUDY_GOAL_MIN = 15;
export const STUDY_GOAL_MAX = 720;

export function formatStudyGoal(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  const rounded = Number.isInteger(hours) ? hours.toString() : hours.toFixed(1);
  return `${rounded} ${hours === 1 ? "hr" : "hrs"}`;
}

/**
 * Onboarding payload validation. The exam attempt must resolve against the
 * seeded curriculum registry — client-provided IDs are never trusted.
 */
export const onboardingSchema = z.object({
  examAttemptId: z
    .string()
    .min(1)
    .refine((id) => getExamAttempt(id) !== null, {
      message: "Unknown exam attempt",
    }),
  dailyStudyGoalMinutes: z
    .number()
    .int()
    .min(STUDY_GOAL_MIN, `Daily goal must be at least ${STUDY_GOAL_MIN} minutes`)
    .max(STUDY_GOAL_MAX, `Daily goal must be at most ${STUDY_GOAL_MAX} minutes`),
  preparationStage: z.enum(PREPARATION_STAGE_VALUES),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
