import { describe, it, expect } from "vitest";
import {
  onboardingSchema,
  PREPARATION_STAGES,
  isPreparationStage,
  formatStudyGoal,
  STUDY_GOAL_MIN,
  STUDY_GOAL_MAX,
} from "@/domain/preparation";

describe("Phase 5 Personalization Validation", () => {
  const validBase = {
    examAttemptId: "attempt_neet_2027",
    dailyStudyGoalMinutes: 120,
    preparationStage: "building_fundamentals",
  };

  it("accepts a valid onboarding payload", () => {
    const parsed = onboardingSchema.safeParse(validBase);
    expect(parsed.success).toBe(true);
  });

  it("accepts every predefined preparation stage", () => {
    for (const stage of PREPARATION_STAGES) {
      const parsed = onboardingSchema.safeParse({ ...validBase, preparationStage: stage.value });
      expect(parsed.success, `stage ${stage.value} must be valid`).toBe(true);
    }
  });

  it("rejects an invalid preparation stage", () => {
    const parsed = onboardingSchema.safeParse({
      ...validBase,
      preparationStage: "vibing",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects study goals outside sensible bounds", () => {
    expect(onboardingSchema.safeParse({ ...validBase, dailyStudyGoalMinutes: 5 }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...validBase, dailyStudyGoalMinutes: 10000 }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...validBase, dailyStudyGoalMinutes: 90.5 }).success).toBe(false);
  });

  it("accepts goal bounds exactly at the limits", () => {
    expect(
      onboardingSchema.safeParse({ ...validBase, dailyStudyGoalMinutes: STUDY_GOAL_MIN }).success
    ).toBe(true);
    expect(
      onboardingSchema.safeParse({ ...validBase, dailyStudyGoalMinutes: STUDY_GOAL_MAX }).success
    ).toBe(true);
  });

  it("rejects exam attempt IDs that do not exist in the seeded registry", () => {
    const parsed = onboardingSchema.safeParse({
      ...validBase,
      examAttemptId: "attempt_jee_2028",
    });
    expect(parsed.success).toBe(false);
  });

  it("narrows preparation stage values and formats goals for display", () => {
    expect(isPreparationStage("revising")).toBe(true);
    expect(isPreparationStage("sleeping")).toBe(false);
    expect(formatStudyGoal(30)).toBe("30 min");
    expect(formatStudyGoal(60)).toBe("1 hr");
    expect(formatStudyGoal(90)).toBe("1.5 hrs");
    expect(formatStudyGoal(180)).toBe("3 hrs");
    expect(formatStudyGoal(null)).toBe("—");
  });
});
