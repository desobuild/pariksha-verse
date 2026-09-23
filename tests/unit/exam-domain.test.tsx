import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CANONICAL_EXAM,
  CANONICAL_EXAM_ATTEMPT,
  resolveActiveExamAttempt,
  isExamCurriculumSeeded,
} from "@/domain/exam";
import { GuestWorkspaceRepository } from "@/repositories/guest-repositories";
import { appStorage } from "@/lib/storage";
import HomePage from "@/app/app/home/page";
import ExamSelectPage from "@/app/exam/select/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/app/home",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Exam Domain & Canonical Attempt Resolution", () => {
  it("resolves canonical Phase 2 exam attempt as neet-2027 with provisional notice", () => {
    const attempt = resolveActiveExamAttempt();
    expect(attempt.slug).toBe("neet-2027");
    expect(attempt.label).toBe("NEET 2027");
    expect(attempt.isProvisional).toBe(true);
    expect(attempt.provisionalNotice).toBeDefined();
    expect(attempt.provisionalNotice).toContain("NEET-UG 2027");
  });

  it("identifies NEET as canonical exam", () => {
    expect(CANONICAL_EXAM.slug).toBe("neet");
    expect(CANONICAL_EXAM.shortName).toBe("NEET");
    expect(CANONICAL_EXAM_ATTEMPT.examId).toBe(CANONICAL_EXAM.id);
  });

  it("correctly identifies exams with seeded curriculum data vs unseeded exams", () => {
    expect(isExamCurriculumSeeded("NEET")).toBe(true);
    expect(isExamCurriculumSeeded("neet")).toBe(true);
    expect(isExamCurriculumSeeded("JEE")).toBe(false);
    expect(isExamCurriculumSeeded("UPSC")).toBe(false);
    expect(isExamCurriculumSeeded("SSC")).toBe(false);
    expect(isExamCurriculumSeeded("GATE")).toBe(false);
    expect(isExamCurriculumSeeded("CAT")).toBe(false);
    expect(isExamCurriculumSeeded("CUET")).toBe(false);
    expect(isExamCurriculumSeeded("Banking")).toBe(false);
  });

  describe("Page rendering with an active guest workspace", () => {
    beforeEach(async () => {
      window.localStorage.clear();
      const repo = new GuestWorkspaceRepository(appStorage, "guest_default");
      await repo.ensureWorkspaceForAttempt(CANONICAL_EXAM_ATTEMPT.id);
    });

    it("renders HomePage with NEET 2027 attempt and no NEET 2026 references", async () => {
      render(<HomePage />);
      expect(await screen.findByText("NEET 2027")).toBeInTheDocument();
      expect(screen.getByText(/provisional syllabus/i)).toBeInTheDocument();
      expect(screen.queryByText(/NEET 2026/i)).not.toBeInTheDocument();
    });

    it("renders ExamSelectPage showing NEET available and unseeded exams as Coming soon", async () => {
      render(<ExamSelectPage />);

      // NEET is a selectable radio once exams resolve
      expect(await screen.findByRole("radio", { name: /neet/i })).toHaveAttribute(
        "aria-checked",
        "false"
      );
      expect(await screen.findByText("Available")).toBeInTheDocument();

      // Other exams display 'Coming soon' and are not selectable radios
      const comingSoonElements = await screen.findAllByText(/coming soon/i);
      expect(comingSoonElements.length).toBe(7);
      expect(screen.queryByRole("radio", { name: /jee/i })).not.toBeInTheDocument();
    });
  });
});
