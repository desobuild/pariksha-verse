import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import RootPage from "@/app/page";
import HomePage from "@/app/app/home/page";
import { BRAND } from "@/config/brand";
import { GuestWorkspaceRepository } from "@/repositories/guest-repositories";
import { appStorage } from "@/lib/storage";
import { CANONICAL_EXAM_ATTEMPT } from "@/domain/exam";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Application Rendering & Route Reachability", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the root landing page with brand wordmark and navigation links", () => {
    render(<RootPage />);

    expect(screen.getByText(BRAND.logo.text)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /complete exam prep companion/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/exam/select"
    );
    expect(screen.getByRole("link", { name: /already have an account/i })).toHaveAttribute(
      "href",
      "/auth/sign-in"
    );
  });

  it("renders the home dashboard with real workspace attempt context", async () => {
    const repo = new GuestWorkspaceRepository(appStorage, "guest_default");
    await repo.ensureWorkspaceForAttempt(CANONICAL_EXAM_ATTEMPT.id);

    render(<HomePage />);

    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByText("Ready to make today count?")).toBeInTheDocument();
    expect(screen.getByText("NEET 2027")).toBeInTheDocument();
  });
});
