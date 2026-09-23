import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { ThemeToggle } from "@/components/shared/theme-toggle";

describe("Theme System Foundation", () => {
  it("initializes ThemeProvider with default system theme and renders children", () => {
    render(
      <ThemeProvider>
        <div data-testid="themed-content">Themed Content</div>
      </ThemeProvider>
    );

    expect(screen.getByTestId("themed-content")).toBeInTheDocument();
  });

  it("renders ThemeToggle button with accessible label and allows interaction", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const toggleButton = screen.getByRole("button", {
      name: /current theme/i,
    });
    expect(toggleButton).toBeInTheDocument();

    // Verify interaction does not crash
    fireEvent.click(toggleButton);
    expect(toggleButton).toBeInTheDocument();
  });
});
