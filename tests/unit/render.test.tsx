import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RootPage from "@/app/page";
import HomePage from "@/app/app/home/page";
import { BRAND } from "@/config/brand";

describe("Application Rendering & Route Reachability", () => {
  it("renders the root landing page with brand title and navigation links", () => {
    render(<RootPage />);

    expect(screen.getByRole("heading", { name: BRAND.name })).toBeInTheDocument();
    expect(screen.getByText(BRAND.tagline)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/exam/select"
    );
    expect(screen.getByRole("link", { name: /open app shell/i })).toHaveAttribute(
      "href",
      "/app/home"
    );
  });

  it("renders the home dashboard placeholder with brand context", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Welcome to your ${BRAND.name} preparation space`))
    ).toBeInTheDocument();
  });
});
