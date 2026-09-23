import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppHeader } from "@/components/navigation/app-header";
import { DesktopSidebar } from "@/components/navigation/desktop-sidebar";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import { BRAND } from "@/config/brand";

// Mock next/navigation usePathname
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/home",
}));

describe("Responsive App Shell Foundation", () => {
  it("renders AppHeader with brand mark, exam selector and sign-in link", () => {
    render(<AppHeader examName="NEET 2026" />);

    expect(screen.getByText(BRAND.logo.mark)).toBeInTheDocument();
    expect(screen.getByText("NEET 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/auth/sign-in");
  });

  it("renders DesktopSidebar with all 7 core navigation items", () => {
    render(<DesktopSidebar />);

    const nav = screen.getByRole("navigation", { name: "Main Navigation" });
    expect(nav).toBeInTheDocument();

    const expectedItems = [
      "Home",
      "Study",
      "Planner",
      "Mock Tests",
      "Progress",
      "Resources",
      "More",
    ];
    for (const title of expectedItems) {
      expect(screen.getByRole("link", { name: title })).toBeInTheDocument();
    }
  });

  it("renders MobileBottomNav with 5 core mobile navigation items", () => {
    render(<MobileBottomNav />);

    const mobileNav = screen.getByRole("navigation", {
      name: "Mobile Bottom Navigation",
    });
    expect(mobileNav).toBeInTheDocument();

    const expectedMobileItems = ["Home", "Study", "Progress", "Resources", "More"];
    for (const title of expectedMobileItems) {
      expect(screen.getByRole("link", { name: title })).toBeInTheDocument();
    }
  });
});
