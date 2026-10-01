import { test, expect } from "@playwright/test";
import { isStagingTarget } from "./support/target";

/**
 * Phase 14F (PARTS I/J/K) — browser-level security-header verification.
 *
 * Runs in BOTH targets and asserts real HTTP responses received by the
 * browser: HTML documents, API responses, redirects, 404s, and the absence of
 * CSP violations on pages that exercise the client runtime. The staging-only
 * complement (demo login, logout, session rejection, static-asset _headers)
 * lives in tests/e2e/staging/security-headers.spec.ts.
 */

const SECURITY_HEADERS: Array<[string, RegExp]> = [
  ["content-security-policy", /default-src 'self'/],
  ["x-content-type-options", /^nosniff$/],
  ["x-frame-options", /^DENY$/],
  ["referrer-policy", /^strict-origin-when-cross-origin$/],
  ["permissions-policy", /camera=\(\)/],
];

function expectSecurityHeaders(
  response: { headers(): Record<string, string> },
  label: string
): void {
  const headers = response.headers();
  for (const [name, pattern] of SECURITY_HEADERS) {
    expect.soft(headers[name], `${label}: ${name}`).toMatch(pattern);
  }
}

test.describe("Phase 14F — security headers", () => {
  let cspViolations: string[] = [];

  test.beforeEach(({ page }) => {
    cspViolations = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        /content.security.policy|refused to (load|execute|apply|connect|frame|send)/i.test(msg.text())
      ) {
        cspViolations.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      if (/content.security.policy|refused to /i.test(String(err))) {
        cspViolations.push(String(err));
      }
    });
  });

  test("HTML document response carries the full security-header set", async ({ page }) => {
    const response = await page.goto("/");
    expect(response, "landing page response").not.toBeNull();
    expectSecurityHeaders(response!, "GET /");

    const csp = response!.headers()["content-security-policy"];
    expect(csp).toContain("script-src");
    expect(csp).not.toMatch(/script-src[^(]*\*/); // no wildcard script sources
    expect(csp).toContain("'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");

    // Local HTTP must never receive HSTS; HTTPS deployments always do.
    if (isStagingTarget()) {
      expect(response!.headers()["strict-transport-security"]).toMatch(/^max-age=/);
    } else {
      expect(response!.headers()["strict-transport-security"]).toBeUndefined();
    }
  });

  test("API responses carry the security headers and advertise no CORS", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expectSecurityHeaders(response, "GET /api/health");
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();

    const body = (await response.json()) as { status?: string };
    expect(body.status).toBe("healthy");
  });

  test("error (404) responses carry the security headers", async ({ request }) => {
    const response = await request.get("/definitely-not-a-real-page");
    expect(response.status()).toBe(404);
    expectSecurityHeaders(response, "GET /definitely-not-a-real-page");
  });

  test("redirect chains end on a fully-protected response", async ({ request }) => {
    // The framework's bare trailing-slash 308 carries no body and no document
    // controls (identical in next dev and vinext — redirect precedes
    // middleware). Every response with content a browser could render — the
    // redirect target — must carry the full set.
    const response = await request.get("/auth/sign-in/");
    expect(response.status()).toBe(200);
    expectSecurityHeaders(response, "GET /auth/sign-in/ (followed)");
  });

  test("auth endpoints served with the app's security headers", async ({ request }) => {
    const response = await request.get("/api/auth/session");
    expect(response.status()).toBe(200);
    expectSecurityHeaders(response, "GET /api/auth/session");
  });

  test("no CSP violations while exercising the client runtime", async ({ page }) => {
    // Public shell pages (no auth required in either target).
    for (const path of ["/", "/auth/sign-in", "/exam/select", "/legal/terms"]) {
      await page.goto(path);
      await page.waitForLoadState("load");
    }

    // Authenticated shell pages: staging signs in via the demo panel; local
    // uses guest mode, which mounts the same client bundles.
    if (isStagingTarget()) {
      const { demoSignIn } = await import("./support/auth");
      await demoSignIn(page, "Friend 1");
    } else {
      await page.goto("/");
      await page.getByRole("link", { name: /get started/i }).click();
      await expect(page).toHaveURL(/\/exam\/select/);
      await page.getByRole("radio", { name: /neet/i }).click();
      await page.getByRole("button", { name: /continue with neet/i }).click();
      await expect(page).toHaveURL(/\/exam\/personalize/);
      await page.getByRole("radio", { name: "1 hr" }).click();
      await page.getByRole("radio", { name: /just starting/i }).click();
      await page.getByRole("button", { name: /create my preparation space/i }).click();
      await expect(page).toHaveURL(/\/app\/home/, { timeout: 20_000 });
    }

    for (const path of [
      "/app/home",
      "/app/study",
      "/app/practice",
      "/app/mock-tests",
      "/app/revision",
      "/app/progress",
      "/app/planner",
      "/app/resources",
      "/app/more",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("load");
    }

    expect(cspViolations, "console CSP violations").toEqual([]);
  });
});
