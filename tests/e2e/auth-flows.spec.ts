import { test, expect } from "@playwright/test";

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
    await page.goto("/auth/create-account");

    // Enter email
    await page.getByLabel(/email address/i).fill(testEmail);
    await page.getByRole("button", { name: /create account/i }).click();

    // Verification automatically completes in test environment;
    // home routes account users without a workspace into exam setup
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
    // Navigate to app home while authenticated
    await page.goto("/app/home");

    // Ensure user is authenticated first
    const emailBadge = page.getByText(testEmail);
    if (!(await emailBadge.isVisible())) {
      await page.goto("/auth/sign-in");
      await page.getByLabel(/email address/i).fill(testEmail);
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/app\/home/);
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
    await page.goto("/auth/create-account");
    await page.getByLabel(/email address/i).fill(studentB);
    await page.getByRole("button", { name: /create account/i }).click();

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
