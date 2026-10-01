import { expect, test, type Page, type Response } from "@playwright/test";
import { isLocalAuthEnvironment, isStagingTarget } from "./target";

/**
 * Environment-aware authentication helpers for the E2E suite.
 *
 * Two auth strategies exist, matching the product's environments:
 *
 * - "email" (local/dev): the real passwordless magic-link flow. The locally
 *   started dev server runs with ENABLE_TEST_AUTH_MOCK=true, so the
 *   sign-in/create-account API responses carry the sanctioned `_testToken`;
 *   tests complete verification through the UI's own token form. Test tokens
 *   fail closed on staging/production (enforced server-side).
 * - "demo" (staging): the staging demo panel (Friend 1–5) backed by
 *   /api/auth/demo. No email flow is attempted on staging.
 *
 * Specs that validate the email implementation itself must skip on staging
 * (see skipOnStaging); specs that just need "an authenticated user" branch on
 * getAuthStrategy() and use the appropriate strategy for the environment.
 */

export type AuthStrategy = "email" | "demo";

export const BRAND_NAME = "ParikshaVerse";

export function getAuthStrategy(): AuthStrategy {
  return isStagingTarget() ? "demo" : "email";
}

/**
 * Skips a test on staging. Use for specs whose purpose is validating the
 * real email/magic-link implementation — there is no email delivery on
 * staging by design, and no test-token escape hatch is permitted there.
 * Always pass the reason (and, where one exists, the staging spec that covers
 * the equivalent behaviour).
 */
export function skipOnStaging(reason: string): void {
  test.skip(isStagingTarget(), reason);
}

// ---------------------------------------------------------------------------
// Demo auth (staging strategy)
// ---------------------------------------------------------------------------

/** Opens /auth/sign-in and waits for the staging demo panel. */
export async function gotoSignInPanel(page: Page): Promise<void> {
  await page.goto("/auth/sign-in");
  await expect(
    page.getByText("Pick a demo profile"),
    [
      "STAGING DEMO AUTH IS NOT AVAILABLE on this deployment.",
      "The sign-in page rendered the email form instead of the Friend 1-5 panel.",
      "Server reports demoAuth.enabled=false (see GET /api/auth/session);",
      "/api/auth/demo fails closed. Check that the deployed worker resolves",
      "ENVIRONMENT=staging through getCloudflareEnv() — GET /api/health must",
      "report environment=staging and GET /api/health/ready must return ok.",
    ].join(" ")
  ).toBeVisible();
}

/**
 * Signs in as one of the fixed staging demo profiles through the UI.
 * Verifies the landing on /app/home with the NEET 2027 workspace.
 */
export async function demoSignIn(page: Page, friend: string): Promise<void> {
  await gotoSignInPanel(page);
  const slotBtn = page.getByRole("button", { name: friend, exact: true });
  await slotBtn.click();
  await expect(slotBtn).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: new RegExp(`continue to ${BRAND_NAME}`, "i") }).click();
  await expect(page).toHaveURL(/\/app\/home/, { timeout: 20_000 });
  await expect(page.getByText("NEET 2027").first()).toBeVisible({ timeout: 20_000 });
}

/** Signs out through the More screen and verifies the signed-out state. */
export async function demoSignOut(page: Page): Promise<void> {
  await page.goto("/app/more");
  // Scope to <main>: the app header also carries a "Sign Out" button.
  const signOutBtn = page.locator("main").getByRole("button", { name: /sign out/i });
  await expect(signOutBtn).toBeVisible();
  await signOutBtn.click();
  await expect(page.getByRole("link", { name: /sign in to sync/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/guest mode/i).first()).toBeVisible();
}

/** Enters guest mode from the staging sign-in panel. */
export async function continueAsGuestFromPanel(page: Page): Promise<void> {
  await gotoSignInPanel(page);
  await page.getByRole("button", { name: /continue as guest/i }).click();
  await expect(page).toHaveURL(/\/app\/home|\/exam\/select/, { timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Email auth (local/dev strategy)
// ---------------------------------------------------------------------------

/**
 * Extracts the sanctioned test token from a local auth API response. The
 * token exists only when the dev server runs with ENABLE_TEST_AUTH_MOCK=true
 * (playwright.config.ts sets this for the webServer it starts itself) and the
 * server-side guard refuses it on staging/production.
 */
async function extractTestToken(response: Response, endpoint: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { _testToken?: string };
  if (!body._testToken) {
    if (!isLocalAuthEnvironment()) {
      throw new Error(
        `${endpoint} returned no _testToken and this is a non-local target. ` +
          "Test tokens are intentionally unavailable on staging/production — " +
          "use the demo auth strategy there (tests/e2e/support/auth.ts)."
      );
    }
    throw new Error(
      `${endpoint} returned no _testToken. Email-auth E2E tests require the local dev ` +
        "server to run with ENABLE_TEST_AUTH_MOCK=true. The webServer started by " +
        "playwright.config.ts sets this automatically — if you reuse an already-running " +
        "dev server, restart it with the flag enabled."
    );
  }
  return body._testToken;
}

/**
 * Completes sign-in through the UI's own verification step: pastes the
 * out-of-band token (delivered by the real email provider locally; captured
 * from the sanctioned test field here) into the verify form. The app awaits
 * guest→account migration before navigating, so the landing URL is the
 * authoritative "authenticated" signal: /app/home when a workspace exists,
 * /exam/select when onboarding should start.
 */
async function completeVerification(page: Page, token: string): Promise<void> {
  await page.getByLabel(/verification code/i).fill(token);
  await page.getByRole("button", { name: /confirm & sign in/i }).click();
  await expect(page).toHaveURL(/\/app\/home|\/exam\/select/, { timeout: 20_000 });
}

/**
 * Creates an account through the real email UI: fills the form, submits,
 * captures the test token from the create-account response, and completes the
 * verification step. Local/dev only (see extractTestToken).
 */
export async function createAccountWithEmail(page: Page, email: string): Promise<void> {
  await page.goto("/auth/create-account");
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/auth/create-account") && res.request().method() === "POST"
  );
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole("button", { name: /create account with email/i }).click();
  const token = await extractTestToken(await responsePromise, "POST /api/auth/create-account");
  await completeVerification(page, token);
}

/**
 * Signs in through the real email UI: fills the form, submits, captures the
 * test token from the sign-in response, and completes the verification step.
 * The account must already exist (create it with createAccountWithEmail).
 */
export async function signInWithEmail(page: Page, email: string): Promise<void> {
  await page.goto("/auth/sign-in");
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/auth/sign-in") && res.request().method() === "POST"
  );
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole("button", { name: /sign in with email/i }).click();
  const token = await extractTestToken(await responsePromise, "POST /api/auth/sign-in");
  await completeVerification(page, token);
}
