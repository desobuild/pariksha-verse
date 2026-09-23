import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FormGroup, FormLabel, FormMessage, FormError } from "@/components/ui/form";
import { CheckCircle2 } from "lucide-react";

describe("Phase 4 Design System Primitives", () => {
  describe("Button Component", () => {
    it("renders default primary button with correct styling and touch target", () => {
      render(<Button>Click Me</Button>);
      const btn = screen.getByRole("button", { name: "Click Me" });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass("bg-primary", "text-primary-foreground", "min-h-[44px]");
    });

    it("renders all button variants properly", () => {
      const { rerender } = render(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole("button", { name: "Secondary" })).toHaveClass("bg-secondary");

      rerender(<Button variant="outline">Outline</Button>);
      expect(screen.getByRole("button", { name: "Outline" })).toHaveClass("border-border", "bg-surface");

      rerender(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByRole("button", { name: "Ghost" })).toHaveClass("hover:bg-muted");

      rerender(<Button variant="destructive">Destructive</Button>);
      expect(screen.getByRole("button", { name: "Destructive" })).toHaveClass("bg-destructive");
    });

    it("renders loading state with spinner, disabled state, and aria-busy", () => {
      render(<Button loading>Processing</Button>);
      const btn = screen.getByRole("button", { name: "Processing" });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
    });

    it("supports icon button size with 44px min touch target", () => {
      render(
        <Button size="icon" aria-label="Icon Action">
          <span data-testid="icon" />
        </Button>
      );
      const btn = screen.getByRole("button", { name: "Icon Action" });
      expect(btn).toHaveClass("h-11", "w-11", "min-h-[44px]", "min-w-[44px]");
    });
  });

  describe("Form Controls", () => {
    it("renders Input with accessible attributes and error state", () => {
      const { rerender } = render(<Input placeholder="Enter email" />);
      const input = screen.getByPlaceholderText("Enter email");
      expect(input).toHaveClass("h-11", "border-input", "bg-surface");
      expect(input).not.toHaveAttribute("aria-invalid");

      rerender(<Input placeholder="Enter email" error />);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveClass("border-destructive");
    });

    it("renders Textarea with error state and aria-invalid", () => {
      const { rerender } = render(<Textarea placeholder="Enter notes" />);
      const textarea = screen.getByPlaceholderText("Enter notes");
      expect(textarea).toHaveClass("min-h-[96px]", "border-input", "bg-surface");
      expect(textarea).not.toHaveAttribute("aria-invalid");

      rerender(<Textarea placeholder="Enter notes" error />);
      expect(textarea).toHaveAttribute("aria-invalid", "true");
      expect(textarea).toHaveClass("border-destructive");
    });

    it("renders FormLabel, FormMessage, and FormError with alert role", () => {
      render(
        <FormGroup>
          <FormLabel htmlFor="test-field" required>
            Test Label
          </FormLabel>
          <Input id="test-field" error />
          <FormError>This field is required</FormError>
        </FormGroup>
      );

      expect(screen.getByText("Test Label")).toBeInTheDocument();
      expect(screen.getByText("*")).toBeInTheDocument();
      const errorMsg = screen.getByRole("alert");
      expect(errorMsg).toHaveTextContent("This field is required");
      expect(errorMsg).toHaveClass("text-destructive");
    });
  });

  describe("Badge Component", () => {
    it("renders all semantic badge variants", () => {
      const { rerender } = render(<Badge variant="default">Primary</Badge>);
      expect(screen.getByText("Primary")).toBeInTheDocument();

      rerender(<Badge variant="success">Passed</Badge>);
      expect(screen.getByText("Passed")).toBeInTheDocument();

      rerender(<Badge variant="warning">Pending</Badge>);
      expect(screen.getByText("Pending")).toBeInTheDocument();

      rerender(<Badge variant="destructive">Failed</Badge>);
      expect(screen.getByText("Failed")).toBeInTheDocument();

      rerender(<Badge variant="info">Note</Badge>);
      expect(screen.getByText("Note")).toBeInTheDocument();
    });

    it("renders badge with icon so meaning does not rely solely on color", () => {
      render(
        <Badge variant="success" icon={<CheckCircle2 data-testid="check-icon" className="h-3 w-3" />}>
          Verified
        </Badge>
      );

      expect(screen.getByTestId("check-icon")).toBeInTheDocument();
      expect(screen.getByText("Verified")).toBeInTheDocument();
    });
  });

  describe("Card and Surface Hierarchy", () => {
    it("renders base, elevated, and interactive card surface variants", () => {
      const { rerender } = render(
        <Card variant="base" data-testid="card">
          <CardHeader>
            <CardTitle>Surface Title</CardTitle>
            <CardDescription>Surface Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>
      );

      const card = screen.getByTestId("card");
      expect(card).toHaveClass("bg-surface", "border-border/60", "shadow-card", "rounded-2xl");

      rerender(
        <Card variant="elevated" data-testid="card">
          Content
        </Card>
      );
      expect(card).toHaveClass("bg-surface-elevated", "shadow-elevated");

      rerender(
        <Card variant="interactive" data-testid="card">
          Content
        </Card>
      );
      expect(card).toHaveClass("cursor-pointer", "hover:border-primary/40");
    });
  });
});
