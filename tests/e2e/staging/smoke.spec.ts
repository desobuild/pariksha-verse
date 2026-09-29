import { test, expect } from "@playwright/test";
import {
  attachHealthCollector,
  formatIssues,
  skipIfProject,
  STAGING_FRIENDS,
} from "./helpers";

/**
 * Phase 2 — Staging smoke test.
 * Verifies every entry route loads cleanly (no uncaught page errors, no
 * console errors, no unexpected failed requests, no unexpected 4xx/5xx) and
 * that protected routes follow the intended auth design (workspace-less
 * visitors are routed into exam setup — never a 401/500 page).
 */
test.describe("Staging Smoke", () => {
  skipIfProject(/Mobile/);

  const PUBLIC_ROUTES = ["/", "/auth/sign-in", "/auth/create-account", "/exam/select", "/legal/privacy"];

  for (const route of PUBLIC_ROUTES) {
    test(`public route ${route} loads cleanly`, async ({ page }) => {
      const health = attachHealthCollector(page);
      const response = await page.goto(route);
      expect(response?.status(), `${route} should return a success/redirect status`).toBeLessThan(400);
      await expect(page.locator("body")).toBeVisible();

      // Landing renders the brand; sign-in renders the staging demo panel.
      if (route === "/") {
        await expect(page.getByRole("heading", { name: /complete exam prep companion/i })).toBeVisible();
        await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
        await expect(page.getByRole("link", { name: /already have an account/i })).toBeVisible();
      }
      if (route === "/auth/sign-in") {
        await expect(page.getByText("Pick a demo profile")).toBeVisible();
        for (const friend of STAGING_FRIENDS) {
          await expect(page.getByRole("button", { name: friend, exact: true })).toBeVisible();
        }
        await expect(page.getByRole("button", { name: /continue as guest/i })).toBeVisible();
        // Staging disclaimer is visible.
        await expect(page.getByText(/staging preview for evaluation only/i)).toBeVisible();
      }
      if (route === "/exam/select") {
        await expect(page.getByRole("heading", { name: "Choose Your Exam" })).toBeVisible();
        await expect(page.getByText("NEET").first()).toBeVisible();
      }

      await health.stop();
      expect(health.unexpected(), `Unexpected runtime issues on ${route}:\n${formatIssues(health.issues)}`).toEqual([]);
    });
  }

  test("protected /app routes follow the auth design for workspace-less visitors", async ({ page }) => {
    const health = attachHealthCollector(page);

    // Workspace-less visitors are routed into exam setup from preparation home.
    await page.goto("/app/home");
    await expect(page).toHaveURL(/\/exam\/select/);
    await expect(page.getByRole("heading", { name: "Choose Your Exam" })).toBeVisible();

    // More is reachable for guests (guest-mode state is shown).
    await page.goto("/app/more");
    await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
    await expect(page.getByText(/guest mode/i).first()).toBeVisible();

    await health.stop();
    expect(health.unexpected(), `Unexpected runtime issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });

  test("health API reports healthy", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(JSON.stringify(body).toLowerCase()).not.toContain('"ok":false');
  });

  test("demo auth endpoint rejects unknown slots without leaking details", async ({ request }) => {
    // Supported-flow probe: an unknown slot must 400 with a generic error —
    // never a 500 or an implementation detail.
    const res = await request.post("/api/auth/demo", { data: { slot: "not-a-friend" } });
    expect([400, 404]).toContain(res.status());
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    expect(body.error).toBeTruthy();
    expect(body.error).not.toMatch(/usr_|d1|database|sql/i);

    // Strict schema: smuggled claims are rejected.
    const smuggled = await request.post("/api/auth/demo", {
      data: { slot: "friend-1", userId: "usr_attacker", environment: "staging" },
    });
    expect([400, 404]).toContain(smuggled.status());
  });
});
