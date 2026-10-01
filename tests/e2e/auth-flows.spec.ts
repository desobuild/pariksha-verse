import { test, expect, request as apiRequest } from "@playwright/test";
import {
  createAccountWithEmail,
  demoSignIn,
  getAuthStrategy,
  signInWithEmail,
  skipOnStaging,
} from "./support/auth";

test.describe("Phase 3 Authentication & Guest Mode E2E Flows (Phase 5 semantics)", () => {
  test.describe.configure({ mode: "serial" });

  const testEmail = `student_${Date.now()}@parikshaverse.in`;

  test("Flow 1: Landing -> Continue as guest -> guest session established", async ({ page }) => {
    await page.goto("/");

    // Get Started continues the device-local (guest) path
    const guestBtn = page.getByRole("link", { name: /get started/i });
    await expect(guestBtn).toBeVisible();
    await guestBtn.click();

    // Verify navigation to exam selection / guest workspace
    await expect(page).toHaveURL(/\/exam\/select/);

    // A guest without a workspace entering /app/home is routed into setup
    await page.goto("/app/home");
    await expect(page).toHaveURL(/\/exam\/select/);
  });

  test("Flow 2 & Flow 3: Create account -> onboarding -> authenticated session persists on refresh", async ({ page }) => {
    // Validates the real passwordless email account flow end to end (form ->
    // magic-link token -> verify -> session). Staging intentionally has no
    // email delivery and serves the demo panel instead; its authenticated
    // session/persistence equivalent lives in tests/e2e/staging/demo-auth.spec.ts.
    skipOnStaging(
      "Email account creation is staging-incompatible by design (no email delivery); staging auth coverage: tests/e2e/staging/demo-auth.spec.ts"
    );

    await createAccountWithEmail(page, testEmail);

    // Home routes account users without a workspace into exam setup
    await expect(page).toHaveURL(/\/exam\/select/, { timeout: 15000 });

    // Complete onboarding to establish the authenticated workspace
    await page.getByRole("radio", { name: /neet/i }).click();
    await page.getByRole("button", { name: /continue with neet 2027/i }).click();
    await expect(page).toHaveURL(/\/exam\/personalize/);
    await page.getByRole("radio", { name: "2 hrs" }).click();
    await page.getByRole("radio", { name: /building fundamentals/i }).click();
    await page.getByRole("button", { name: /create my preparation space/i }).click();

    // Verify authenticated state in app header on the preparation home
    await expect(page).toHaveURL(/\/app\/home/, { timeout: 15000 });
    await expect(page.getByText(testEmail)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

    // Flow 3: Refresh page -> still authenticated, workspace restored
    await page.reload();
    await expect(page.getByText(testEmail)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  });

  test("Flow 4: Authenticated -> sign out -> guest state restored", async ({ page }) => {
    if (getAuthStrategy() === "demo") {
      // Staging: authenticate through the demo panel (no email flow there).
      await demoSignIn(page, "Friend 2");
    } else {
      // Navigate to app home while authenticated
      await page.goto("/app/home");

      // Ensure user is authenticated first
      const emailBadge = page.getByText(testEmail);
      if (!(await emailBadge.isVisible())) {
        await signInWithEmail(page, testEmail);
        await expect(page).toHaveURL(/\/app\/home/, { timeout: 15000 });
      }
    }

    // Click Sign Out
    const signOutBtn = page.getByRole("button", { name: /sign out/i });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Guest state restored: the device-local guest has no workspace, so the
    // preparation home routes into setup. The More screen confirms guest mode.
    await expect(page).toHaveURL(/\/exam\/select/);
    await page.goto("/app/more");
    await expect(page.getByText(/guest mode/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in to sync/i })).toBeVisible();
  });

  test("Flow 5: Guest -> create/sign into account -> guest migration executes cleanly", async ({ page }) => {
    // Validates guest→account migration triggered by email account creation.
    // Staging exercises the same migration contract against demo auth in
    // tests/e2e/staging/guest-migration.spec.ts — no email attempt there.
    skipOnStaging(
      "Email-triggered guest migration; staging equivalent: tests/e2e/staging/guest-migration.spec.ts"
    );

    const studentB = `aspirant_${Date.now()}@parikshaverse.in`;

    // 1. Enter as guest and populate sample guest data in IndexedDB
    await page.goto("/app/home");
    await page.evaluate(async () => {
      const guestWs = [
        {
          id: "guest_e2e_ws",
          userId: "guest_default",
          examAttemptId: "attempt_neet_2027",
          isActive: true,
          startedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      return new Promise<void>((resolve) => {
        const req = window.indexedDB.open("pariksha_verse_db", 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains("keyvalue")) {
            req.result.createObjectStore("keyvalue");
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("keyvalue", "readwrite");
          const store = tx.objectStore("keyvalue");
          store.put(guestWs, "pv:guest:workspaces");
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        };
        req.onerror = () => resolve();
      });
    });

    // 2. Sign in to account
    await createAccountWithEmail(page, studentB);

    // 3. Migration carries the guest workspace in; home keeps the user
    //    (no bounce to onboarding) and shows the migrated attempt
    await expect(page).toHaveURL(/\/app\/home/, { timeout: 15000 });
    await expect(page.getByText(studentB)).toBeVisible();
    await expect(page.getByText("NEET 2027").first()).toBeVisible();

    // 4. Poll/verify that local guest workspaces were safely migrated and cleared from IndexedDB
    await expect.poll(async () => {
      return page.evaluate(async () => {
        return new Promise<unknown>((resolve) => {
          const req = window.indexedDB.open("pariksha_verse_db", 1);
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("keyvalue")) {
              resolve(null);
              return;
            }
            const tx = db.transaction("keyvalue", "readonly");
            const store = tx.objectStore("keyvalue");
            const getReq = store.get("pv:guest:workspaces");
            getReq.onsuccess = () => resolve(getReq.result ?? null);
            getReq.onerror = () => resolve(null);
          };
          req.onerror = () => resolve(null);
        });
      });
    }).toBeNull();
  });
});

test.describe("Phase 14B — Magic-link verification page (/auth/verify)", () => {
  test.describe.configure({ mode: "serial" });

  const linkEmail = `linkflow_${Date.now()}@parikshaverse.in`;

  test("opening the emailed verification URL signs the user in", async ({ page }) => {
    skipOnStaging(
      "Local magic-link flow — staging has no email delivery by design; staging auth coverage: tests/e2e/staging/demo-auth.spec.ts"
    );

    // Create the account and capture the out-of-band token from the sanctioned
    // local test field (ENABLE_TEST_AUTH_MOCK=true on the local dev server).
    await page.goto("/auth/create-account");
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/auth/create-account") && res.request().method() === "POST"
    );
    await page.getByLabel(/email address/i).fill(linkEmail);
    await page.getByRole("button", { name: /create account with email/i }).click();
    const body = (await (await responsePromise).json()) as { _testToken?: string };
    const token = body._testToken;
    expect(token, "local dev server must run with ENABLE_TEST_AUTH_MOCK=true").toBeTruthy();

    // Open the verification URL exactly as the transactional email link does,
    // instead of pasting the token into the sign-in form.
    await page.goto(
      `/auth/verify?token=${encodeURIComponent(token!)}&email=${encodeURIComponent(linkEmail)}`
    );

    // Success establishes the pv_session and navigates into the app (fresh
    // accounts without a workspace are routed into onboarding).
    await expect(page).toHaveURL(/\/app\/home|\/exam\/select/, { timeout: 20_000 });

    // Session actually established. Assert on the More screen: the compact
    // mobile header does not render the account email on /exam/select.
    await page.goto("/app/more");
    const main = page.locator("main");
    await expect(main.getByText(linkEmail)).toBeVisible({ timeout: 15_000 });
    await expect(main.getByRole("button", { name: /sign out/i })).toBeVisible();
  });

  test("a verification link without a token shows the broken-link state", async ({ page }) => {
    skipOnStaging(
      "Local magic-link flow — staging has no email delivery by design; staging auth coverage: tests/e2e/staging/demo-auth.spec.ts"
    );

    await page.goto("/auth/verify");
    await expect(page.getByText(/this sign-in link is incomplete/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /return to sign in/i })).toHaveAttribute(
      "href",
      "/auth/sign-in"
    );
  });

  test("an invalid token shows the failure state and keeps the visitor unauthenticated", async ({
    page,
  }) => {
    skipOnStaging(
      "Local magic-link flow — staging has no email delivery by design; staging auth coverage: tests/e2e/staging/demo-auth.spec.ts"
    );

    await page.goto(
      `/auth/verify?token=${encodeURIComponent("bogus_token.bad_signature")}&email=${encodeURIComponent("nobody@example.com")}`
    );

    await expect(
      page.getByRole("heading", { name: /verification failed/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /return to sign in/i })).toBeVisible();

    // No session was established by the failed attempt.
    await page.goto("/app/home");
    await expect(page).toHaveURL(/\/exam\/select/);
  });
});

test.describe("Phase 14E — one-time tokens & server-side session revocation (local)", () => {
  test.describe.configure({ mode: "serial" });

  const replayEmail = `replay_${Date.now()}@parikshaverse.in`;
  const revocationEmail = `revoke_${Date.now()}@parikshaverse.in`;

  /** Signs out through the More screen and confirms guest state. */
  async function signOutViaUi(page: import("@playwright/test").Page): Promise<void> {
    await page.goto("/app/more");
    const signOutBtn = page.locator("main").getByRole("button", { name: /sign out/i });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();
    await expect(page.getByText(/guest mode/i).first()).toBeVisible({ timeout: 15_000 });
  }

  test("a verification link can be used exactly once — replay is rejected", async ({ page }) => {
    skipOnStaging(
      "Local magic-link flow — staging has no email delivery by design; staging auth coverage: tests/e2e/staging/demo-auth.spec.ts"
    );

    // Capture the out-of-band token from the sanctioned local test field.
    await page.goto("/auth/create-account");
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/auth/create-account") && res.request().method() === "POST"
    );
    await page.getByLabel(/email address/i).fill(replayEmail);
    await page.getByRole("button", { name: /create account with email/i }).click();
    const body = (await (await responsePromise).json()) as { _testToken?: string };
    const token = body._testToken;
    expect(token, "local dev server must run with ENABLE_TEST_AUTH_MOCK=true").toBeTruthy();
    const verifyUrl = `/auth/verify?token=${encodeURIComponent(token!)}&email=${encodeURIComponent(replayEmail)}`;

    // First use signs the user in.
    await page.goto(verifyUrl);
    await expect(page).toHaveURL(/\/app\/home|\/exam\/select/, { timeout: 20_000 });
    await signOutViaUi(page);

    // Replay of the SAME link is rejected with the generic failure state and
    // establishes no session.
    await page.goto(verifyUrl);
    await expect(
      page.getByRole("heading", { name: /verification failed/i })
    ).toBeVisible({ timeout: 15_000 });
    await page.goto("/app/home");
    await expect(page).toHaveURL(/\/exam\/select/);
  });

  test("sign-out invalidates the session server-side — a stolen cookie dies", async ({ page }) => {
    skipOnStaging(
      "Local magic-link flow — staging has no email delivery by design; staging equivalent lives in the staging demo-auth spec"
    );

    // Authenticate through the real UI.
    await createAccountWithEmail(page, revocationEmail);

    // Capture the session cookie — the "stolen" credential.
    const sessionCookie = (await page.context().cookies()).find(
      (c) => c.name === "pv_session"
    );
    expect(sessionCookie, "pv_session cookie must exist after sign-in").toBeTruthy();

    // A standalone API context (its own cookie jar) replays exactly that
    // stolen cookie: the session endpoint must accept it while it is live.
    const origin = new URL(page.url()).origin;
    const stolen = await apiRequest.newContext({
      baseURL: origin,
      extraHTTPHeaders: { cookie: `pv_session=${sessionCookie!.value}` },
    });
    const before = await stolen.get("/api/auth/session");
    expect(before.status()).toBe(200);
    const beforeBody = (await before.json()) as { user: { email: string } | null };
    expect(beforeBody.user?.email).toBe(revocationEmail);

    // Sign out through the UI.
    await signOutViaUi(page);

    // The SAME stolen cookie no longer authenticates: revocation was
    // server-side, not just a cookie clear.
    const after = await stolen.get("/api/auth/session");
    expect(after.status()).toBe(200);
    const afterBody = (await after.json()) as { user: unknown };
    expect(afterBody.user).toBeNull();

    await stolen.dispose();
  });
});
