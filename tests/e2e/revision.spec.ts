import { test, expect, type Page } from "@playwright/test";
import { createAccountWithEmail, demoSignIn, getAuthStrategy } from "./support/auth";
import {
  ensureTopicNotStarted,
  CHAPTER_PHYSICS_AND_MEASUREMENT,
  TOPIC_UNITS_LABEL,
} from "./staging/helpers";

test.describe("Phase 8 Revision Queue & Spaced Review E2E", () => {
  async function completeGuestSetup(page: Page) {
    await page.goto("/exam/select");
    await page.getByRole("radio", { name: /neet/i }).click();
    await page.getByRole("button", { name: /continue with neet 2027/i }).click();
    await expect(page).toHaveURL(/\/exam\/personalize/);
    await page.getByRole("radio", { name: "1 hr" }).click();
    await page.getByRole("radio", { name: /just starting/i }).click();
    await page.getByRole("button", { name: /create my preparation space/i }).click();
    await expect(page).toHaveURL(/\/app\/home/, { timeout: 15000 });
  }

  // Canonical NEET topics used as isolated fixtures (one per bucket).
  const T_DUE = "exam_neet_physics_physics-and-measurement_units-and-measurements";
  const T_OVERDUE = "exam_neet_physics_kinematics_motion-in-straight-line";
  const T_UPCOMING = "exam_neet_chemistry_basic-concepts-of-chemistry_matter-and-mole-concept";
  const T_RECENT = "exam_neet_biology_diversity-in-living-world_living-world-and-taxonomy";

  /**
   * Seeds guest topic progress directly into the IndexedDB guest store with
   * one topic per revision bucket. Dates are computed in the page's local
   * timezone so due/overdue classification matches what the app renders.
   */
  async function seedRevisionFixtures(page: Page) {
    await page.evaluate(
      async ([due, overdue, upcoming, recent]) => {
        const openDb = () =>
          new Promise<IDBDatabase>((resolve, reject) => {
            const req = window.indexedDB.open("pariksha_verse_db", 1);
            req.onupgradeneeded = () => {
              if (!req.result.objectStoreNames.contains("keyvalue")) {
                req.result.createObjectStore("keyvalue");
              }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

        const read = <T,>(db: IDBDatabase, key: string) =>
          new Promise<T | null>((resolve) => {
            const tx = db.transaction("keyvalue", "readonly");
            const req = tx.objectStore("keyvalue").get(key);
            req.onsuccess = () => resolve((req.result as T) ?? null);
            req.onerror = () => resolve(null);
          });

        const write = (db: IDBDatabase, key: string, value: unknown) =>
          new Promise<void>((resolve) => {
            const tx = db.transaction("keyvalue", "readwrite");
            tx.objectStore("keyvalue").put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });

        const db = await openDb();
        type Workspace = { id: string; isActive: boolean };
        const workspaces = (await read<Workspace[]>(db, "pv:guest:workspaces")) ?? [];
        const ws = workspaces.find((w) => w.isActive) ?? workspaces[0];
        if (!ws) throw new Error("No guest workspace found");

        const now = new Date();
        const at = (dayOffset: number, hour: number) => {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, 0, 0, 0);
          return d.toISOString();
        };

        type ProgressRow = Record<string, unknown>;
        const row = (topicId: string, status: string, extra: Record<string, unknown>): ProgressRow => ({
          id: `prog_e2e_${topicId}`,
          workspaceId: ws.id,
          topicId,
          status,
          startedAt: at(-5, 10),
          learnedAt: at(-5, 10),
          practicedAt: null,
          revisedAt: null,
          masteredAt: null,
          practiceAttempts: 0,
          correctAnswers: 0,
          incorrectAnswers: 0,
          accuracy: 0,
          lastStudiedAt: at(-1, 10),
          lastRevisedAt: null,
          nextRevisionAt: null,
          notes: null,
          createdAt: at(-5, 10),
          updatedAt: at(-1, 10),
          ...extra,
        });

        const progress = [
          row(due, "learned", { nextRevisionAt: at(0, 9) }),
          row(overdue, "learned", { nextRevisionAt: at(-3, 9) }),
          row(upcoming, "learned", { nextRevisionAt: at(1, 8) }),
          row(recent, "revised", { lastRevisedAt: at(0, 10), revisedAt: at(0, 10), nextRevisionAt: at(4, 8) }),
        ];

        await write(db, "pv:guest:topic_progress", progress);
      },
      [T_DUE, T_OVERDUE, T_UPCOMING, T_RECENT] as const
    );
  }

  async function openRevision(page: Page, opts: { seeded?: boolean } = {}) {
    await completeGuestSetup(page);
    if (opts.seeded) await seedRevisionFixtures(page);
    await page.goto("/app/revision");
    await expect(page.getByRole("heading", { name: "Revision", exact: true })).toBeVisible();
  }

  function section(page: Page, title: string) {
    return page.locator("section").filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    });
  }

  test("1. Guest opens Revision page and empty states render", async ({ page }) => {
    await openRevision(page);

    await expect(page.getByText("NEET 2027").first()).toBeVisible();
    // Calm, real empty states — no fabricated activity
    await expect(page.getByText("You're all caught up.")).toBeVisible();
    await expect(page.getByText("No upcoming revisions scheduled.")).toBeVisible();
    await expect(page.getByText("No revision sessions recorded yet.")).toBeVisible();
    // Zeroed summary counts
    await expect(page.getByText("0 topics due")).toBeVisible();
  });

  test("2. Due, overdue, upcoming and recently revised render from real data", async ({ page }) => {
    await openRevision(page, { seeded: true });

    // Due Today leads with the physics topic
    const due = section(page, "Due Today");
    await expect(due.getByText("Units of Measurement, SI Units & Derived Units")).toBeVisible();
    await expect(due.getByText("Due today", { exact: true })).toBeVisible();
    await expect(due.getByRole("link", { name: /review topic/i })).toBeVisible();

    // Overdue is distinguishable with calm copy
    const overdue = section(page, "Overdue");
    await expect(overdue.getByText("Frame of Reference, Uniform & Non-Uniform Motion")).toBeVisible();
    await expect(overdue.getByText("3 days overdue")).toBeVisible();

    // Upcoming groups by date starting with Tomorrow
    const upcoming = section(page, "Upcoming");
    await expect(upcoming.getByRole("heading", { name: "Tomorrow", exact: true })).toBeVisible();
    await expect(upcoming.getByText("Matter, Laws of Chemical Combination & Mole Concept")).toBeVisible();

    // Recently revised shows today's completion
    const recent = section(page, "Recently Revised");
    await expect(recent.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
    await expect(recent.getByText("What is Living, Biodiversity & Binomial Nomenclature")).toBeVisible();

    // Real counts in the summary stats
    await expect(page.getByText("1 topic due")).toBeVisible();
  });

  test("3. Status filters narrow the queue", async ({ page }) => {
    await openRevision(page, { seeded: true });

    // Overdue tab keeps only the overdue section
    await page.getByRole("tab", { name: "Overdue" }).click();
    await expect(section(page, "Overdue")).toBeVisible();
    await expect(section(page, "Due Today")).toHaveCount(0);
    await expect(section(page, "Upcoming")).toHaveCount(0);
    await expect(section(page, "Recently Revised")).toHaveCount(0);

    // Due tab restores just Due Today
    await page.getByRole("tab", { name: "Due", exact: true }).click();
    await expect(section(page, "Due Today")).toBeVisible();
    await expect(section(page, "Overdue")).toHaveCount(0);

    // All restores the full page
    await page.getByRole("tab", { name: "All" }).click();
    await expect(section(page, "Due Today")).toBeVisible();
    await expect(section(page, "Overdue")).toBeVisible();
    await expect(section(page, "Upcoming")).toBeVisible();
  });

  test("4. Subject filter combines with revision state", async ({ page }) => {
    await openRevision(page, { seeded: true });

    // Physics + Overdue shows only the overdue physics topic
    await page.getByRole("tab", { name: "Overdue" }).click();
    await page.getByRole("combobox", { name: "Filter by subject" }).click();
    await page.getByRole("option", { name: "Physics" }).click();

    const overdue = section(page, "Overdue");
    await expect(overdue.getByText("Frame of Reference, Uniform & Non-Uniform Motion")).toBeVisible();
    await expect(overdue.getByText("Matter, Laws of Chemical Combination & Mole Concept")).toHaveCount(0);
  });

  test("5. Review Topic navigates to the Phase 7 topic detail", async ({ page }) => {
    await openRevision(page, { seeded: true });

    await section(page, "Due Today").getByRole("link", { name: /review topic/i }).click();
    // First hit pays the dev-server route compile; allow generous time.
    await expect(page).toHaveURL(new RegExp(`/app/study/${T_DUE}`), { timeout: 20000 });
    await expect(
      page.getByRole("heading", { name: "Units of Measurement, SI Units & Derived Units" })
    ).toBeVisible();
  });

  test("6. Mark as Revised completes, reschedules and clears the due queue", async ({ page }) => {
    await openRevision(page, { seeded: true });

    await section(page, "Due Today").getByRole("link", { name: /review topic/i }).click();
    await expect(page).toHaveURL(new RegExp(`/app/study/${T_DUE}`));

    // Due topic exposes the completion action
    await expect(page.getByText("Due today").first()).toBeVisible();
    await page.getByRole("button", { name: /mark as revised/i }).click();

    // Clear success feedback with the next interval
    await expect(page.getByText("Revision completed. Next review in 3 days.")).toBeVisible();

    // Back on the queue the topic has left Due Today…
    await page.goto("/app/revision");
    await expect(section(page, "Due Today").getByText("You're all caught up.")).toBeVisible();
    // …moved into Recently Revised…
    await expect(
      section(page, "Recently Revised").getByText("Units of Measurement, SI Units & Derived Units")
    ).toBeVisible();
    // …and into Upcoming with the next date (+3 days).
    await expect(
      section(page, "Upcoming").getByText("Units of Measurement, SI Units & Derived Units")
    ).toBeVisible();

    // Guest persistence: the completion survives a reload (IndexedDB)
    await page.reload();
    await expect(section(page, "Due Today").getByText("You're all caught up.")).toBeVisible();
    await expect(
      section(page, "Recently Revised").getByText("Units of Measurement, SI Units & Derived Units")
    ).toBeVisible();
  });

  test("7. Overdue topic can be revised from the Overdue section", async ({ page }) => {
    await openRevision(page, { seeded: true });

    await section(page, "Overdue").getByRole("link", { name: /review topic/i }).click();
    await expect(page).toHaveURL(new RegExp(`/app/study/${T_OVERDUE}`));
    await expect(page.getByText(/overdue by 3 days/i).first()).toBeVisible();

    await page.getByRole("button", { name: /mark as revised/i }).click();
    await expect(page.getByText("Revision completed. Next review in 3 days.")).toBeVisible();

    await page.goto("/app/revision");
    await expect(section(page, "Overdue").getByText(/nothing overdue/i)).toBeVisible();
  });

  test("8. Topic detail displays upcoming and unscheduled revision states", async ({ page }) => {
    await openRevision(page, { seeded: true });

    // Upcoming topic shows the next revision date
    await page.goto(`/app/study/${T_UPCOMING}`);
    await expect(
      page.getByRole("heading", { name: "Matter, Laws of Chemical Combination & Mole Concept" })
    ).toBeVisible();
    await expect(page.getByText("Next revision")).toBeVisible();
    await expect(page.getByText(/due tomorrow/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /mark as revised/i })).toHaveCount(0);

    // Unscheduled topic keeps the calm Phase 7 copy
    await page.goto("/app/study/exam_neet_physics_laws-of-motion_newtons-laws-and-inertia");
    await expect(page.getByText("No revision scheduled yet.")).toBeVisible();
  });

  test("9. Marking a topic learned schedules its first revision", async ({ page }) => {
    await completeGuestSetup(page);

    // Study a fresh topic and mark it learned through the Phase 7 UI
    await page.goto("/app/study");
    await page.getByRole("button", { name: /physics and measurement/i }).click();
    await page
      .locator("ul[id^='chapter-topics-']")
      .getByRole("link", { name: /least count, significant figures/i })
      .click();
    await page.getByRole("button", { name: /change status/i }).click();
    await page.getByRole("menuitemradio", { name: /^learned/i }).click();

    // Revision emerges naturally: scheduled for tomorrow
    await page.goto("/app/revision");
    const upcoming = section(page, "Upcoming");
    await expect(upcoming.getByRole("heading", { name: "Tomorrow", exact: true })).toBeVisible();
    await expect(upcoming.getByText("Least Count, Significant Figures & Errors in Measurement")).toBeVisible();
    await expect(section(page, "Due Today").getByText("You're all caught up.")).toBeVisible();
  });

  test("10. Dashboard revision CTAs navigate to the revision queue", async ({ page }) => {
    await openRevision(page, { seeded: true });

    // Today's Focus recommends the revision with a deep link into the topic
    await page.goto("/app/home");
    const startRevision = page.getByRole("link", { name: /start revision/i });
    await expect(startRevision).toBeVisible();
    await startRevision.click();
    await expect(page).toHaveURL(new RegExp(`/app/study/${T_OVERDUE}`));

    // Generic quick action lands on the queue
    await page.goto("/app/home");
    await page.getByRole("link", { name: /^revise/i }).first().click();
    await expect(page).toHaveURL(/\/app\/revision/);
    await expect(page.getByRole("heading", { name: "Revision", exact: true })).toBeVisible();

    // Attention items route to the queue as well
    await page.goto("/app/home");
    const reviewLink = page.getByRole("link", { name: /^review$/i }).first();
    await expect(reviewLink).toBeVisible();
    await reviewLink.click();
    await expect(page).toHaveURL(/\/app\/revision/);
  });

  // Server-heavy authenticated flows run serially: both authenticate and
  // write server-backed state, and concurrent runs cause transient
  // workspace-resolution failures that redirect pages to onboarding.
  test.describe.serial("Authenticated revision API & persistence", () => {
    test("11. Revision API rejects unauthenticated and invalid requests", async ({ page }) => {
      // No session cookie -> 401 for both read and write
      const getRes = await page.request.get("/api/revision?workspaceId=ws_any");
      expect(getRes.status()).toBe(401);
      const putRes = await page.request.put("/api/revision", {
        data: { workspaceId: "ws_any", topicId: T_DUE, revisionNumber: 1 },
      });
      expect(putRes.status()).toBe(401);

      // Authenticate with the environment's strategy, then verify the
      // authenticated error semantics: nonexistent workspace -> 404,
      // invalid payload -> 400
      if (getAuthStrategy() === "demo") {
        // Staging: Friend 5's shared demo workspace (not used by other specs).
        await demoSignIn(page, "Friend 5");
      } else {
        await createAccountWithEmail(page, `rev_api_${Date.now()}@parikshaverse.in`);
      }

      const missing = await page.request.get("/api/revision?workspaceId=ws_missing");
      expect(missing.status()).toBe(404);

      const invalid = await page.request.put("/api/revision", {
        data: { workspaceId: "ws_missing", topicId: "", revisionNumber: 0 },
      });
      expect(invalid.status()).toBe(400);
    });

    test("12. Authenticated revision persists on the server", async ({ page }) => {
      test.setTimeout(150_000);
      const email = `rev_persist_${Date.now()}@parikshaverse.in`;

      if (getAuthStrategy() === "demo") {
        // Staging: Friend 5's shared demo profile is sticky across runs, so
        // the probe topic is reset first to start the schedule clean.
        await demoSignIn(page, "Friend 5");
        await ensureTopicNotStarted(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_UNITS_LABEL);
      } else {
        await createAccountWithEmail(page, email);
        await page.waitForURL(/\/exam\/select/, { timeout: 15000 });

        // Onboard an authenticated workspace
        await page.getByRole("radio", { name: /neet/i }).click();
        await page.getByRole("button", { name: /continue with neet 2027/i }).click();
        await page.getByRole("radio", { name: "1 hr" }).click();
        await page.getByRole("radio", { name: /just starting/i }).click();
        await page.getByRole("button", { name: /create my preparation space/i }).click();
        await page.waitForURL(/\/app\/home/, { timeout: 15000 });

        // Confirm the authenticated workspace is fully resolved (also warms
        // the compiled API routes) before deeper navigation.
        await expect(page.getByText(email).first()).toBeVisible({ timeout: 20000 });
      }

      // Mark a topic learned through the UI -> first revision scheduled via D1
      await page.goto("/app/study");
      await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: /physics and measurement/i }).click();
      await page
        .locator("ul[id^='chapter-topics-']")
        .getByRole("link", { name: /units of measurement/i })
        .click();
      await page.getByRole("button", { name: /change status/i }).click();
      await page.getByRole("menuitemradio", { name: /^learned/i }).click();
      await expect(page.getByText("Learned").first()).toBeVisible();

      await page.goto("/app/revision");
      const upcoming = section(page, "Upcoming");
      await expect(upcoming.getByText("Units of Measurement, SI Units & Derived Units")).toBeVisible();

      // Server persistence: schedule survives reload from D1
      await page.reload();
      await expect(
        section(page, "Upcoming").getByText("Units of Measurement, SI Units & Derived Units")
      ).toBeVisible();

      // Exercise the authenticated write path: make the revision due today
      // through the same API the app uses, then complete it in the UI.
      const seeded = await page.evaluate(
        async ([topicId]) => {
          const wsRes = await fetch("/api/workspaces", { credentials: "include" });
          const wsData = (await wsRes.json()) as { workspaces?: { id: string; isActive: boolean }[] };
          const ws = (wsData.workspaces ?? []).find((w) => w.isActive) ?? wsData.workspaces?.[0];
          if (!ws) throw new Error("no workspace");
          const today = new Date();
          const due = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0, 0);
          const putRes = await fetch("/api/revision", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              workspaceId: ws.id,
              topicId,
              revisionNumber: 1,
              nextRevisionAt: due.toISOString(),
              status: "scheduled",
            }),
          });
          return putRes.status;
        },
        [T_DUE] as const
      );
      expect(seeded).toBe(200);

      await page.goto("/app/revision");
      await expect(
        section(page, "Due Today").getByText("Units of Measurement, SI Units & Derived Units")
      ).toBeVisible();

      await section(page, "Due Today").getByRole("link", { name: /review topic/i }).click();
      await page.getByRole("button", { name: /mark as revised/i }).click();
      await expect(page.getByText("Revision completed. Next review in 3 days.")).toBeVisible();

      // Completion persisted server-side: still revised after a reload
      await page.goto("/app/revision");
      await expect(section(page, "Due Today").getByText("You're all caught up.")).toBeVisible();
      await expect(
        section(page, "Recently Revised").getByText("Units of Measurement, SI Units & Derived Units")
      ).toBeVisible();
    });
  });

  test("13. No horizontal overflow across responsive viewports", async ({ page }) => {
    await openRevision(page, { seeded: true });

    const viewports = [
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
      { width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(100);
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(
        hasHorizontalScroll,
        `Detected horizontal overflow at viewport ${vp.width}x${vp.height}`
      ).toBe(false);
    }
  });
});
