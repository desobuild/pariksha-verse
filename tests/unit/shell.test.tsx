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
  it("renders AppHeader with brand wordmark, active exam target (NEET 2027) and sign-in link", () => {
    render(<AppHeader />);

    expect(screen.getByText(BRAND.name)).toBeInTheDocument();
    expect(screen.getByText("NEET 2027")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/auth/sign-in");
  });

  it("renders AppHeader with custom examName override when provided", () => {
    render(<AppHeader examName="Custom Exam" />);

    expect(screen.getByText("Custom Exam")).toBeInTheDocument();
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
      const link = screen.getByRole("link", { name: title });
      expect(link).toBeInTheDocument();
      expect(link).toHaveClass("min-h-[44px]");
    }
  });

  it("applies quiet active state to current route in DesktopSidebar", () => {
    render(<DesktopSidebar />);
    const activeLink = screen.getByRole("link", { name: "Home" });
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink).toHaveClass("bg-surface-tint", "text-primary");
  });

  it("applies active state to current route in MobileBottomNav", () => {
    render(<MobileBottomNav />);
    const activeLink = screen.getByRole("link", { name: "Home" });
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink).toHaveClass("text-primary");
  });
});
