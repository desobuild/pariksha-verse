import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { VerifyMagicLinkClient } from "@/app/auth/verify/verify-client";

/**
 * Phase 14B — LOCAL magic-link verification page (/auth/verify).
 *
 * The page must reuse the existing useAuth().verify() flow (no second auth
 * mechanism), navigate to the authenticated destination on success, and
 * handle missing / invalid / expired tokens and API failures. The token is
 * never logged, persisted, or rendered.
 */

const mockReplace = vi.fn();
const mockPush = vi.fn();

let mockSearchParams = new URLSearchParams();
const mockVerify = vi.fn();
let mockAuthStatus: "loading" | "guest" | "authenticated" = "loading";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  usePathname: () => "/auth/verify",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/auth/use-auth", () => ({
  useAuth: () => ({
    status: mockAuthStatus,
    verify: mockVerify,
  }),
}));

const TOKEN = "valid_magic_link_token_payload.signature";

function setParams(params: Record<string, string>) {
  mockSearchParams = new URLSearchParams(params);
}

describe("Phase 14B — /auth/verify magic-link page", () => {
  let consoleSpies: Array<ReturnType<typeof vi.spyOn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockAuthStatus = "loading";
    mockVerify.mockReset();
    mockVerify.mockResolvedValue({ success: false, error: "Verification failed" });
    sessionStorage.clear();
    localStorage.clear();
    consoleSpies = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "error"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "info"),
    ];
  });

  afterEach(() => {
    for (const spy of consoleSpies) spy.mockRestore();
  });

  it("waits for the session check and shows a loading state before verifying", async () => {
    setParams({ token: TOKEN, email: "student@example.com" });
    mockAuthStatus = "loading";

    render(<VerifyMagicLinkClient />);

    expect(screen.getByText(/verifying your sign-in link/i)).toBeVisible();
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("verifies a valid token through the existing auth flow and navigates to the app", async () => {
    setParams({ token: TOKEN, email: "student@example.com" });
    mockAuthStatus = "guest";
    mockVerify.mockResolvedValue({ success: true });

    render(<VerifyMagicLinkClient />);

    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalledWith("student@example.com", TOKEN);
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/app/home");
    });
    // Success state is shown (with a manual fallback link) while redirecting.
    await waitFor(() => {
      expect(screen.getByText(/verification complete/i)).toBeVisible();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("verifies even when the visitor already holds a session (explicit sign-in intent)", async () => {
    setParams({ token: TOKEN, email: "student@example.com" });
    mockAuthStatus = "authenticated";
    mockVerify.mockResolvedValue({ success: true });

    render(<VerifyMagicLinkClient />);

    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalledWith("student@example.com", TOKEN);
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/app/home");
    });
  });

  it("routes an already-authenticated visitor into the app when the link has no token", async () => {
    setParams({});
    mockAuthStatus = "authenticated";

    render(<VerifyMagicLinkClient />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/app/home");
    });
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("shows the broken-link state (not an API call) when the token is missing", async () => {
    setParams({ email: "student@example.com" });
    mockAuthStatus = "guest";

    render(<VerifyMagicLinkClient />);

    await waitFor(() => {
      expect(screen.getByText(/this sign-in link is incomplete/i)).toBeVisible();
    });
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /return to sign in/i })).toHaveAttribute(
      "href",
      "/auth/sign-in"
    );
  });

  it("shows the broken-link state when the email is missing (API requires both values)", async () => {
    setParams({ token: TOKEN });
    mockAuthStatus = "guest";

    render(<VerifyMagicLinkClient />);

    await waitFor(() => {
      expect(screen.getByText(/this sign-in link is incomplete/i)).toBeVisible();
    });
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("shows the failure state with a way back to sign-in for an invalid or expired token", async () => {
    setParams({ token: "expired_token.signature", email: "student@example.com" });
    mockAuthStatus = "guest";
    mockVerify.mockResolvedValue({
      success: false,
      error: "Invalid or expired verification token",
    });

    render(<VerifyMagicLinkClient />);

    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalledWith("student@example.com", "expired_token.signature");
    });
    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeVisible();
    });
    expect(
      screen.getByText(/invalid or has expired/i)
    ).toBeVisible();
    const backLink = screen.getByRole("link", { name: /return to sign in/i });
    expect(backLink).toHaveAttribute("href", "/auth/sign-in");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows the failure state when the verification API errors", async () => {
    setParams({ token: TOKEN, email: "student@example.com" });
    mockAuthStatus = "guest";
    mockVerify.mockResolvedValue({ success: false, error: "Verification failed" });

    render(<VerifyMagicLinkClient />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /verification failed/i })).toBeVisible();
    });
    expect(screen.getByText(/couldn't verify your sign-in link/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /return to sign in/i })).toHaveAttribute(
      "href",
      "/auth/sign-in"
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("stays on the failure state when the verify call itself throws (transport failure)", async () => {
    setParams({ token: TOKEN, email: "student@example.com" });
    mockAuthStatus = "guest";
    mockVerify.mockRejectedValue(new Error("network down"));

    render(<VerifyMagicLinkClient />);

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeVisible();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("runs the verification attempt exactly once despite re-renders", async () => {
    setParams({ token: TOKEN, email: "student@example.com" });
    mockAuthStatus = "guest";
    // Defer resolution so the component re-renders while the call is pending.
    let resolveVerify: (v: { success: boolean }) => void = () => {};
    mockVerify.mockReturnValue(
      new Promise((resolve) => {
        resolveVerify = resolve;
      })
    );

    const { rerender } = render(<VerifyMagicLinkClient />);
    rerender(<VerifyMagicLinkClient />);
    rerender(<VerifyMagicLinkClient />);

    resolveVerify({ success: true });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/app/home");
    });
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it("never logs, persists, or renders the raw token", async () => {
    setParams({ token: TOKEN, email: "student@example.com" });
    mockAuthStatus = "guest";
    mockVerify.mockResolvedValue({ success: false, error: "Invalid or expired verification token" });

    const { container } = render(<VerifyMagicLinkClient />);

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeVisible();
    });

    // Token must not appear in the DOM in any form.
    expect(container.innerHTML).not.toContain(TOKEN);
    expect(container.innerHTML).not.toContain("valid_magic_link_token_payload");
    // Nor in any storage.
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
    // Nor in any console output.
    const allConsoleText = consoleSpies
      .flatMap((spy) => spy.mock.calls.map((c) => c.map(String).join(" ")))
      .join("\n");
    expect(allConsoleText).not.toContain(TOKEN);
  });
});
