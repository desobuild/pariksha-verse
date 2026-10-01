import { test, expect, request as apiRequest } from "@playwright/test";
import {
  attachHealthCollector,
  demoSignIn,
  demoSignOut,
  formatIssues,
  gotoSignInPanel,
  skipIfProject,
  STAGING_FRIENDS,
  type StagingFriend,
} from "./helpers";

/**
 * Phase 3 — Staging demo authentication.
 * Friend 1 and Friend 2 run the full supported loop: sign in via the panel,
 * land on /app/home with the NEET 2027 workspace, keep the session across
 * refresh and section navigation, then sign out and confirm protected content
 * is gone. Only the supported Friend 1–5 slots are exercised.
 */
test.describe("Staging Demo Authentication", () => {
  skipIfProject(/Mobile/);

  for (const friend of ["Friend 1", "Friend 2"] as StagingFriend[]) {
    test(`${friend}: sign in, workspace, session persistence, sign out`, async ({ page }) => {
      const health = attachHealthCollector(page);

      await demoSignIn(page, friend);
      await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

      // Session persists across refresh.
      await page.reload();
      await expect(page.getByText("NEET 2027").first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/friend/i).first()).toBeVisible();

      // Navigate between sections; the session must hold everywhere.
      for (const [route, heading] of [
        ["/app/study", "Study"],
        ["/app/progress", "Progress"],
        ["/app/resources", "Resources"],
        ["/app/home", /welcome back/i],
      ] as const) {
        await page.goto(route);
        await expect(
          page.getByRole("heading", { name: heading }).first(),
          `${route} should render its heading for ${friend}`
        ).toBeVisible({ timeout: 20_000 });
      }

      // The More screen identifies the signed-in demo profile.
      await page.goto("/app/more");
      await expect(page.getByText(/friend/i).first()).toBeVisible();

      // Sign out.
      await demoSignOut(page);

      // Protected content is no longer accessible: preparation home bounces
      // into exam setup for the (new, workspace-less) guest.
      await page.goto("/app/home");
      await expect(page).toHaveURL(/\/exam\/select/);

      await health.stop();
      expect(
        health.unexpected(),
        `Unexpected runtime issues for ${friend}:\n${formatIssues(health.issues)}`
      ).toEqual([]);
    });
  }

  test("all five demo slots are selectable and the panel disables nothing silently", async ({ page }) => {
    await gotoSignInPanel(page);
    for (const friend of STAGING_FRIENDS) {
      const btn = page.getByRole("button", { name: friend, exact: true });
      await expect(btn).toBeVisible();
      await btn.click();
      await expect(btn).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("sign-out invalidates the demo session server-side — a stolen cookie dies", async ({ page }) => {
    // Phase 14E: logout must revoke the pv_session record in D1, so the same
    // cookie can never authenticate again — not merely clear it from the
    // browser. A standalone API context (its own cookie jar) replays the
    // captured "stolen" cookie before and after sign-out.
    await demoSignIn(page, "Friend 1");

    const sessionCookie = (await page.context().cookies()).find(
      (c) => c.name === "pv_session"
    );
    expect(sessionCookie, "pv_session cookie must exist after demo sign-in").toBeTruthy();

    const origin = new URL(page.url()).origin;
    const stolen = await apiRequest.newContext({
      baseURL: origin,
      extraHTTPHeaders: { cookie: `pv_session=${sessionCookie!.value}` },
    });
    const before = await stolen.get("/api/auth/session");
    expect(before.status()).toBe(200);
    const beforeBody = (await before.json()) as { user: { id: string } | null };
    expect(beforeBody.user?.id).toBeTruthy();

    await demoSignOut(page);

    const after = await stolen.get("/api/auth/session");
    expect(after.status()).toBe(200);
    const afterBody = (await after.json()) as { user: unknown };
    expect(afterBody.user).toBeNull();

    await stolen.dispose();
  });

  test("arbitrary slot values are not accepted by the panel UI", async ({ page }) => {
    // The UI only renders the fixed roster — there is no way to type a slot,
    // so the client surface cannot request arbitrary identities.
    await gotoSignInPanel(page);
    const buttons = await page
      .locator("button", { hasText: /^Friend/ })
      .allTextContents();
    expect(buttons.sort()).toEqual([...STAGING_FRIENDS].sort());
  });
});
