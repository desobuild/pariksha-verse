import { test, expect } from "@playwright/test";

test.describe("Phase 6 Real Preparation Dashboard E2E", () => {
  async function completeGuestSetup(
    page: import("@playwright/test").Page,
    opts = { goal: "1 hr", stage: /just starting/i }
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

  test("1. Guest can open dashboard and view active exam with countdown", async ({ page }) => {
    await completeGuestSetup(page);

    // Active exam target is visible with provisional notice and countdown
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByText("NEET 2027").first()).toBeVisible();
    await expect(page.getByText(/provisional syllabus/i)).toBeVisible();
    await expect(page.getByText(/remaining/i).first()).toBeVisible();

    // Personalization summary indicators
    await expect(page.getByText("1 hr").first()).toBeVisible();
    await expect(page.getByText("Just starting").first()).toBeVisible();
  });

  test("2. Today's Focus and empty state render for fresh workspace", async ({ page }) => {
    await completeGuestSetup(page);

    // Today's focus section with explainable reason
    await expect(page.getByText("Next in Syllabus").first()).toBeVisible();
    await expect(page.getByText(/Why this today\?/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /start studying/i })).toBeVisible();

    // Today's study plan empty state
    await expect(page.getByText(/no study tasks planned for today/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /plan today's study/i })).toBeVisible();

    // Attention needed peaceful empty state
    await expect(page.getByText(/all caught up/i)).toBeVisible();

    // Recent activity empty state
    await expect(page.getByText(/your study activity will appear here as you prepare/i)).toBeVisible();
  });

  test("3. Progress data renders matching Phase 2 taxonomy (139 topics)", async ({ page }) => {
    await completeGuestSetup(page);

    // Header & Overall count
    await expect(page.getByText("Preparation Progress")).toBeVisible();
    await expect(page.getByText(/0 \/ 139 topics covered/i)).toBeVisible();

    // Subject breakdown
    await expect(page.getByText("Physics").first()).toBeVisible();
    await expect(page.getByText("0 / 61")).toBeVisible();

    await expect(page.getByText("Chemistry").first()).toBeVisible();
    await expect(page.getByText("0 / 40")).toBeVisible();

    await expect(page.getByText("Biology").first()).toBeVisible();
    await expect(page.getByText("0 / 38")).toBeVisible();
  });

  test("4. Today's tasks can be displayed and completed", async ({ page }) => {
    await completeGuestSetup(page);

    // Inject a planner task scheduled for today into IndexedDB
    const todayStr = new Date().toISOString().split("T")[0];
    await page.evaluate(async (date) => {
      const req = indexedDB.open("pariksha_verse_db", 1);
      await new Promise<void>((resolve) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("keyvalue", "readwrite");
          const store = tx.objectStore("keyvalue");

          // Read workspace ID
          const wsReq = store.get("pv:guest:workspaces");
          wsReq.onsuccess = () => {
            const workspaces = wsReq.result || [];
            const wsId = workspaces[0]?.id || "ws_test";
            const sampleTask = {
              id: "task_e2e_1",
              workspaceId: wsId,
              type: "study",
              title: "Kinematics 1D Speed & Velocity",
              subjectId: "exam_neet_physics",
              chapterId: null,
              topicId: "exam_neet_physics_kinematics_motion-in-straight-line",
              scheduledDate: date,
              startTime: "17:00",
              durationMinutes: 45,
              status: "upcoming",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            store.put([sampleTask], "pv:guest:planner_tasks");
          };

          tx.oncomplete = () => resolve();
        };
      });
    }, todayStr);

    // Reload page to reflect stored task
    await page.reload();

    // Verify task is visible in Today's Study Plan (and recommended in Today's Focus)
    await expect(page.getByText("Kinematics 1D Speed & Velocity").first()).toBeVisible();
    await expect(page.getByText("45 min").first()).toBeVisible();

    // Click completion toggle
    const toggleButton = page.getByRole("button", { name: /mark "kinematics 1d speed & velocity" complete/i });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    // Verify button label changes to incomplete
    await expect(
      page.getByRole("button", { name: /mark "kinematics 1d speed & velocity" incomplete/i })
    ).toBeVisible();
  });

  test("5. Authenticated user can view dashboard with personal data", async ({ page }) => {
    const email = `dashboard_auth_${Date.now()}@parikshaverse.in`;
    await page.goto("/auth/create-account");
    await page.getByLabel(/email address/i).fill(email);
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/exam\/select/, { timeout: 15000 });
    await page.getByRole("radio", { name: /neet/i }).click();
    await page.getByRole("button", { name: /continue with neet 2027/i }).click();
    await page.getByRole("radio", { name: "2 hrs" }).click();
    await page.getByRole("radio", { name: /practicing regularly/i }).click();
    await page.getByRole("button", { name: /create my preparation space/i }).click();

    await expect(page).toHaveURL(/\/app\/home/, { timeout: 15000 });
    await expect(page.getByText("NEET 2027").first()).toBeVisible();
    await expect(page.getByText("2 hrs").first()).toBeVisible();
    await expect(page.getByText("Practicing regularly").first()).toBeVisible();
  });

  test("6. No horizontal overflow across multiple responsive viewports", async ({ page }) => {
    await completeGuestSetup(page);

    const viewports = [
      { width: 375, height: 667 }, // iPhone SE
      { width: 390, height: 844 }, // iPhone 14
      { width: 430, height: 932 }, // iPhone 14 Pro Max
      { width: 768, height: 1024 }, // iPad
      { width: 1280, height: 800 }, // Desktop small
      { width: 1440, height: 900 }, // Desktop large
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(100);

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      expect(
        hasHorizontalScroll,
        `Detected horizontal overflow at viewport ${vp.width}x${vp.height}`
      ).toBe(false);
    }
  });
});
