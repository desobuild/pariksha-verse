import { test, expect } from "@playwright/test";

/**
 * Phase 5 — Exam Selection + Preparation Onboarding flows.
 * Serial within the file: guest state builds up across flows on a shared
 * browser context is NOT shared, so each flow seeds what it needs.
 */
test.describe("Phase 5 Onboarding Flows", () => {
  test.describe.configure({ mode: "serial" });

  /** Completes the full guest setup flow from a clean context. */
  async function completeGuestSetup(
    page: import("@playwright/test").Page,
    opts: { goal: string; stage: RegExp }
  ) {
    await page.goto("/exam/select");
    await page.getByRole("radio", { name: /neet/i }).click();
    await page.getByRole("button", { name: /continue with neet 2027/i }).click();
    await expect(page).toHaveURL(/\/exam\/personalize/);
    await page.getByRole("radio", { name: opts.goal }).click();
    await page.getByRole("radio", { name: opts.stage }).click();
    await page.getByRole("button", { name: /create my preparation space/i }).click();
    await expect(page).toHaveURL(/\/app\/home/, { timeout: 15000 });
  }

  test("Flow 1: Guest setup — landing to preparation home", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/exam\/select/);

    // NEET is supported; the single NEET 2027 attempt auto-selects
    await page.getByRole("radio", { name: /neet/i }).click();
    const attempt = page.getByRole("radio", { name: /neet 2027/i });
    await expect(attempt).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: /continue with neet 2027/i }).click();
    await expect(page).toHaveURL(/\/exam\/personalize\?attempt=attempt_neet_2027/);

    // Personalization: attempt summary is visible with provisional notice
    await expect(page.getByText("NEET 2027").first()).toBeVisible();
    await expect(page.getByText(/provisional/i).first()).toBeVisible();

    // Daily goal + preparation stage
    await page.getByRole("radio", { name: "1 hr" }).click();
    await page.getByRole("radio", { name: /just starting/i }).click();

    await page.getByRole("button", { name: /create my preparation space/i }).click();

    // Workspace created -> preparation home with real data
    await expect(page).toHaveURL(/\/app\/home/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByText("NEET 2027").first()).toBeVisible();
    await expect(page.getByText("Just starting").first()).toBeVisible();
    await expect(page.getByText("1 hr").first()).toBeVisible();
  });

  test("Flow 2: Returning guest — refresh keeps workspace, onboarding not shown again", async ({ page }) => {
    await completeGuestSetup(page, { goal: "2 hrs", stage: /revising/i });
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByText("NEET 2027").first()).toBeVisible();
    await expect(page).not.toHaveURL(/\/exam\/select/);

    // Landing resolves the existing workspace and continues preparation
    await page.goto("/");
    await expect(page.getByRole("link", { name: /continue preparation/i })).toBeVisible();
  });

  test("Flow 3: Authenticated setup — account onboarding creates a server workspace", async ({ page }) => {
    const email = `authsetup_${Date.now()}@parikshaverse.in`;
    await page.goto("/auth/create-account");
    await page.getByLabel(/email address/i).fill(email);
    await page.getByRole("button", { name: /create account/i }).click();

    // No workspace yet -> preparation home routes into setup
    await expect(page).toHaveURL(/\/exam\/select/, { timeout: 15000 });

    await page.getByRole("radio", { name: /neet/i }).click();
    await page.getByRole("button", { name: /continue with neet 2027/i }).click();
    await page.getByRole("radio", { name: "3 hrs" }).click();
    await page.getByRole("radio", { name: /revising/i }).click();
    await page.getByRole("button", { name: /create my preparation space/i }).click();

    await expect(page).toHaveURL(/\/app\/home/, { timeout: 15000 });
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText("NEET 2027").first()).toBeVisible();

    // Server-backed workspace survives a reload
    await page.reload();
    await expect(page.getByText("NEET 2027").first()).toBeVisible();
  });

  test("Flow 4: Duplicate prevention — retrying onboarding reuses the single workspace", async ({ page }) => {
    // Start fresh guest setup
    await completeGuestSetup(page, { goal: "2 hrs", stage: /building fundamentals/i });

    // Replay the full onboarding (back navigation + resubmit)
    await page.goto("/exam/personalize?attempt=attempt_neet_2027");
    await page.getByRole("radio", { name: "2 hrs" }).click();
    await page.getByRole("radio", { name: /final preparation/i }).click();
    await page.getByRole("button", { name: /create my preparation space/i }).click();
    await expect(page).toHaveURL(/\/app\/home/, { timeout: 15000 });

    // Exactly one guest workspace for the attempt exists in IndexedDB
    const count = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const req = window.indexedDB.open("pariksha_verse_db", 1);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("keyvalue")) {
            resolve(-1);
            return;
          }
          const tx = db.transaction("keyvalue", "readonly");
          const getReq = tx.objectStore("keyvalue").get("pv:guest:workspaces");
          getReq.onsuccess = () => {
            const list = (getReq.result as { examAttemptId: string }[]) ?? [];
            resolve(list.filter((w) => w.examAttemptId === "attempt_neet_2027").length);
          };
          getReq.onerror = () => resolve(-1);
        };
        req.onerror = () => resolve(-1);
      });
    });
    expect(count).toBe(1);
  });

  test("Flow 5: Unsupported exam — JEE is visibly coming soon and not selectable", async ({ page }) => {
    await page.goto("/exam/select");

    const jeeCard = page.getByText("JEE").first();
    await expect(jeeCard).toBeVisible();
    await expect(page.getByText("Coming soon").first()).toBeVisible();

    // JEE is not rendered as a selectable radio
    expect(await page.getByRole("radio", { name: /jee/i }).count()).toBe(0);

    // The continue CTA stays inert without a supported selection
    await expect(page.getByRole("button", { name: /select an exam to continue/i })).toBeDisabled();

    // No workspace can exist for an unsupported attempt id
    const response = await page.request.post("/api/workspaces", {
      data: { examAttemptId: "attempt_jee_2028", isActive: true, ensure: true },
    });
    expect([401, 422]).toContain(response.status());
  });

  test("Flow 6: Guest migration — guest workspace becomes the account workspace without duplicates", async ({ page }) => {
    const email = `migration_${Date.now()}@parikshaverse.in`;

    // Guest completes setup (local workspace + preferences)
    await completeGuestSetup(page, { goal: "1.5 hrs", stage: /practicing regularly/i });

    // Sign in: migration moves the guest workspace to the account
    await page.goto("/auth/create-account");
    await page.getByLabel(/email address/i).fill(email);
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/app\/home/, { timeout: 15000 });
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText("NEET 2027").first()).toBeVisible();

    // Exactly one server workspace for the attempt (duplicates impossible by ensure)
    const list = await page.request.get("/api/workspaces");
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as { workspaces: { examAttemptId: string }[] };
    const forAttempt = body.workspaces.filter((w) => w.examAttemptId === "attempt_neet_2027");
    expect(forAttempt.length).toBe(1);

    // Local guest data cleared after successful migration
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          return new Promise<unknown>((resolve) => {
            const req = window.indexedDB.open("pariksha_verse_db", 1);
            req.onsuccess = () => {
              const db = req.result;
              if (!db.objectStoreNames.contains("keyvalue")) {
                resolve(null);
                return;
              }
              const getReq = db
                .transaction("keyvalue", "readonly")
                .objectStore("keyvalue")
                .get("pv:guest:workspaces");
              getReq.onsuccess = () => resolve(getReq.result ?? null);
              getReq.onerror = () => resolve(null);
            };
            req.onerror = () => resolve(null);
          });
        })
      )
      .toBeNull();
  });
});
