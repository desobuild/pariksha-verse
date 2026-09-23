import { describe, it, expect } from "vitest";
import {
  listAvailableExams,
  listExamAttempts,
  getExamAttempt,
  getExamForAttempt,
} from "@/domain/exam-catalog";
import { CANONICAL_EXAM_ATTEMPT } from "@/domain/exam";

describe("Phase 5 Exam Catalog & Attempt Resolution", () => {
  it("lists all catalog exams with NEET supported and others coming soon", () => {
    const exams = listAvailableExams();
    expect(exams.length).toBe(8);

    const neet = exams.find((e) => e.slug === "neet");
    expect(neet).toBeDefined();
    expect(neet?.isSupported).toBe(true);
    expect(neet?.attemptCount).toBeGreaterThan(0);
    expect(neet?.shortName).toBe("NEET");

    for (const slug of ["jee", "upsc", "ssc", "gate", "cat", "cuet", "banking"]) {
      const exam = exams.find((e) => e.slug === slug);
      expect(exam?.isSupported, `${slug} must not be supported`).toBe(false);
      expect(exam?.attemptCount, `${slug} must have no attempts`).toBe(0);
    }
  });

  it("returns the seeded NEET 2027 attempt without hardcoding the year", () => {
    const attempts = listExamAttempts("neet");
    expect(attempts.length).toBe(1);
    expect(attempts[0].slug).toBe("neet-2027");
    expect(attempts[0].label).toBe("NEET 2027");
    expect(attempts[0].examDate).toEqual(CANONICAL_EXAM_ATTEMPT.examDate);
    expect(attempts[0].isProvisional).toBe(true);
    expect(attempts[0].provisionalNotice).toContain("NEET-UG 2027");
  });

  it("matches catalog attempt resolution with the canonical Phase 2 attempt", () => {
    expect(getExamAttempt("attempt_neet_2027")?.id).toBe(CANONICAL_EXAM_ATTEMPT.id);
    expect(getExamAttempt("neet-2027")?.id).toBe(CANONICAL_EXAM_ATTEMPT.id);
  });

  it("returns empty attempts for unsupported exams and unknown slugs", () => {
    expect(listExamAttempts("jee")).toEqual([]);
    expect(listExamAttempts("does-not-exist")).toEqual([]);
    expect(getExamAttempt("attempt_unknown")).toBeNull();
  });

  it("resolves the owning exam for an attempt", () => {
    const exam = getExamForAttempt("attempt_neet_2027");
    expect(exam?.slug).toBe("neet");
    expect(exam?.shortName).toBe("NEET");
    expect(getExamForAttempt("attempt_unknown")).toBeNull();
  });
});
