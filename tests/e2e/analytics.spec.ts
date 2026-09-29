import { test, expect, type Page } from "@playwright/test";
import { createAccountWithEmail, demoSignIn, getAuthStrategy } from "./support/auth";
import {
  ensureTopicNotStarted,
  CHAPTER_PHYSICS_AND_MEASUREMENT,
  TOPIC_UNITS_LABEL,
} from "./staging/helpers";

/**
 * Phase 12 E2E — the analytics journey on the Progress screen.
 *
 * Data is seeded directly into the guest IndexedDB store (same technique as
 * the revision spec) so the analytics render from deterministic records —
 * no random data, no fabricated activity.
 */

test.describe("Phase 12 Analytics & Exam Readiness E2E", () => {
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

  // Canonical NEET topics used as fixtures.
  const T_UNITS = "exam_neet_physics_physics-and-measurement_units-and-measurements";
  const T_MOTION = "exam_neet_physics_kinematics_motion-in-straight-line";
  const T_MOLE = "exam_neet_chemistry_basic-concepts-of-chemistry_matter-and-mole-concept";

  /**
   * Seeds a deterministic analytics dataset:
   * - Units topic: weak (8/20 = 40%), practiced yesterday, revision overdue
   * - Motion topic: strong (10/10 = 100%), learned 2 days ago
   * - Mole topic: revised yesterday, next revision in 3 days
   * - Study: 60 min yesterday + 30 min today
   * - Mocks: two completed results with sections (one older, outside 7d)
   */
  async function seedAnalyticsFixtures(page: Page) {
    await page.evaluate(
      async ([units, motion, mole]) => {
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
        const wsId = ws.id;

        const day = (offset: number, hour = 10): string => {
          const now = new Date();
          return new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + offset,
            hour,
            0,
            0,
            0
          ).toISOString();
        };

        // ---- topic progress -------------------------------------------------
        const progressRow = (
          topicId: string,
          status: string,
          extra: Record<string, unknown>
        ) => ({
          id: `prog_e2e_${topicId}`,
          workspaceId: wsId,
          topicId,
          status,
          startedAt: day(-6),
          learnedAt: null,
          practicedAt: null,
          revisedAt: null,
          masteredAt: null,
          practiceAttempts: 0,
          correctAnswers: 0,
          incorrectAnswers: 0,
          accuracy: 0,
          lastStudiedAt: day(-1),
          lastRevisedAt: null,
          nextRevisionAt: null,
          notes: null,
          createdAt: day(-6),
          updatedAt: day(-1),
          ...extra,
        });

        await write(db, "pv:guest:topic_progress", [
          progressRow(units, "practiced", {
            practicedAt: day(-1),
            practiceAttempts: 20,
            correctAnswers: 8,
            incorrectAnswers: 12,
            accuracy: 4000,
          }),
          progressRow(motion, "learned", {
            learnedAt: day(-2),
          }),
          progressRow(mole, "revised", {
            lastRevisedAt: day(-1, 11),
            revisedAt: day(-1, 11),
            nextRevisionAt: day(3, 8),
          }),
        ]);

        // ---- practice sessions ----------------------------------------------
        await write(db, "pv:guest:practice_sessions", [
          {
            id: "prac_e2e_units",
            workspaceId: wsId,
            topicId: units,
            questionCount: 20,
            correct: 8,
            incorrect: 12,
            unattempted: 0,
            durationMinutes: 15,
            completedAt: day(-1, 12),
            createdAt: day(-1, 12),
            updatedAt: day(-1, 12),
          },
          {
            id: "prac_e2e_motion",
            workspaceId: wsId,
            topicId: motion,
            questionCount: 10,
            correct: 10,
            incorrect: 0,
            unattempted: 0,
            durationMinutes: 8,
            completedAt: day(-2, 15),
            createdAt: day(-2, 15),
            updatedAt: day(-2, 15),
          },
          {
            id: "prac_e2e_old",
            workspaceId: wsId,
            topicId: mole,
            questionCount: 10,
            correct: 3,
            incorrect: 7,
            unattempted: 0,
            durationMinutes: 12,
            completedAt: day(-20, 15), // inside 30d, outside 7d
            createdAt: day(-20, 15),
            updatedAt: day(-20, 15),
          },
        ]);

        // ---- study sessions --------------------------------------------------
        await write(db, "pv:guest:study_sessions", [
          {
            id: "study_e2e_1",
            workspaceId: wsId,
            plannerTaskId: null,
            topicId: units,
            startedAt: day(-1, 9),
            endedAt: day(-1, 10),
            durationMinutes: 60,
            sessionType: "focused",
            createdAt: day(-1, 9),
            updatedAt: day(-1, 10),
          },
          {
            id: "study_e2e_2",
            workspaceId: wsId,
            plannerTaskId: null,
            topicId: motion,
            startedAt: day(0, 9),
            endedAt: day(0, 10),
            durationMinutes: 30,
            sessionType: "focused",
            createdAt: day(0, 9),
            updatedAt: day(0, 10),
          },
        ]);

        // ---- revision items ---------------------------------------------------
        await write(db, "pv:guest:revision_items", [
          {
            id: "rev_e2e_units",
            workspaceId: wsId,
            topicId: units,
            revisionNumber: 2,
            lastRevisedAt: day(-8),
            nextRevisionAt: day(-1, 8), // overdue
            status: "scheduled",
            createdAt: day(-8),
            updatedAt: day(-1, 8),
          },
          {
            id: "rev_e2e_mole",
            workspaceId: wsId,
            topicId: mole,
            revisionNumber: 2,
            lastRevisedAt: day(-1, 11),
            nextRevisionAt: day(3, 8),
            status: "scheduled",
            createdAt: day(-8),
            updatedAt: day(-1, 11),
          },
        ]);

        // ---- mock results ------------------------------------------------------
        const mockResult = (
          id: string,
          title: string,
          rawScore: number,
          totalMarks: number,
          accuracyBps: number,
          completedAt: string
        ) => ({
          id,
          mockTestId: `mock_${id}`,
          sessionId: `msess_${id}`,
          workspaceId: wsId,
          mockTitle: title,
          rawScore,
          totalMarks,
          totalQuestions: 20,
          attempted: 15,
          correct: 12,
          incorrect: 3,
          unattempted: 5,
          markedForReviewCount: 1,
          accuracy: accuracyBps,
          accuracyPct: Math.round(accuracyBps / 100),
          timeSpentSeconds: 5400,
          submissionStatus: "completed",
          completedAt,
          notes: null,
          sections: [
            {
              sectionId: "sec_physics",
              name: "Physics",
              totalQuestions: 10,
              attempted: 8,
              correct: 6,
              incorrect: 2,
              unanswered: 2,
              rawScore: 22,
              maxScore: 40,
              accuracyBps: 7500,
              accuracyPct: 75,
            },
          ],
          questions: [],
        });

        await write(db, "pv:guest:mock_test_results", [
          mockResult("res_e2e_1", "NEET Full Mock 01", 300, 720, 7000, day(-12)),
          mockResult("res_e2e_2", "NEET Full Mock 02", 240, 600, 8000, day(-1, 14)),
        ]);
      },
      [T_UNITS, T_MOTION, T_MOLE] as const
    );
  }

  async function openProgress(page: Page, opts: { seeded?: boolean } = {}) {
    await completeGuestSetup(page);
    if (opts.seeded) await seedAnalyticsFixtures(page);
    await page.goto("/app/progress");
    await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible({
      timeout: 20000,
    });
  }

  function section(page: Page, name: string) {
    return page.locator("section").filter({
      has: page.getByRole("heading", { name, exact: true }),
    });
  }

  test("1. Empty workspace: coverage zeros and honest empty states", async ({ page }) => {
    await openProgress(page);

    // Coverage reflects the full syllabus with zero covered topics.
    await expect(page.getByText(/0\s*\/\s*139 topics covered \(0%\)/)).toBeVisible();

    // Sections without data say so plainly — no fabricated numbers.
    await expect(page.getByText("No practice questions recorded in the last 30 days.")).toBeVisible();
    await expect(
      page.getByText("No study sessions recorded in the last 30 days.")
    ).toBeVisible();
    await expect(
      page.getByText("No question sessions recorded yet. Start a practice session to see question analytics.")
    ).toBeVisible();
    await expect(section(page, "Mock Performance").getByText(/No mocks completed in this period/i)).toBeVisible();

    // Neutral consistency copy — factual zero.
    await expect(page.getByText("Studied on 0 of the last 30 days.")).toBeVisible();

    // No prediction language anywhere.
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/readiness score|percentile|predicted rank|you will (qualify|clear)/i);
  });

  test("2. Coverage, insights and performance render from seeded data", async ({ page }) => {
    await openProgress(page, { seeded: true });

    // Coverage: 3 covered topics (practiced + learned + revised) of 139.
    await expect(page.getByText(/3\s*\/\s*139 topics covered \(2%\)/)).toBeVisible();
    await expect(page.getByText("Topics by status")).toBeVisible();

    // Insights — deterministic and traceable.
    const insights = section(page, "Based on Your Recorded Activity");
    await expect(insights.getByText("40% accuracy across 20 questions")).toBeVisible();
    await expect(page.getByText("1 topic is overdue for revision.")).toBeVisible();
    await expect(
      page.getByText("Mock accuracy increased from 70% to 80% across your last two mocks.")
    ).toBeVisible();

    // Subject performance: Physics 18/30 = 60%, one weak topic.
    const physicsCard = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Subject Performance" }),
    }).getByRole("heading", { name: "Physics" });
    await expect(physicsCard).toBeVisible();
    await expect(page.getByText("Weak topics").first()).toBeVisible();

    // Practice trends totals: 30 questions inside the default 30-day window.
    await expect(page.getByText("Questions attempted").first()).toBeVisible();

    // Study activity totals: 60 + 30 minutes.
    await expect(page.getByText("1 hr 30 min").first()).toBeVisible();

    // Mock performance: raw score always next to its own maximum.
    await expect(page.getByText("300 / 720 marks").first()).toBeVisible();
    await expect(page.getByText("240 / 600 marks").first()).toBeVisible();

    // Section analytics appear (two mocks carry sections).
    const mockSection = section(page, "Mock Performance");
    await expect(mockSection.getByRole("rowheader", { name: "Physics" })).toBeVisible();

    // Consistency copy stays neutral.
    await expect(page.getByText("Studied on 2 of the last 30 days.")).toBeVisible();

    // Recent changes list real milestones.
    await expect(page.getByText(/Learned Frame of Reference, Uniform & Non-Uniform Motion/)).toBeVisible();
    await expect(page.getByText("Completed mock: NEET Full Mock 02")).toBeVisible();
  });

  test("3. Topic filters narrow the topic table", async ({ page }) => {
    await openProgress(page, { seeded: true });

    await section(page, "Topic Performance").getByRole("combobox", { name: "Filter topics by subject" }).click();
    await page.getByRole("option", { name: "Physics" }).click();
    await expect(section(page, "Topic Performance").getByText("Units of Measurement, SI Units & Derived Units").first()).toBeVisible();
    await expect(
      section(page, "Topic Performance").getByText("Matter, Laws of Chemical Combination & Mole Concept")
    ).toHaveCount(0);

    // Weak badge on the low-accuracy topic only.
    await expect(section(page, "Topic Performance").getByText("Below 60% accuracy")).toHaveCount(1);
    await expect(section(page, "Topic Performance").getByText("Revision overdue")).toBeVisible();
  });

  test("4. Time range switching changes practice totals", async ({ page }) => {
    await openProgress(page, { seeded: true });

    // Default 30-day window: 40 attempted questions (20 + 10 + 10 old ones).
    await expect(page.getByText(/^40$/).first()).toBeVisible();

    // Switch to 7 days: the -20d session leaves the window.
    await page.getByRole("tab", { name: "Time range: 7 days" }).click();
    await expect(page.getByText(/^30$/).first()).toBeVisible();

    // All time brings it back.
    await page.getByRole("tab", { name: "Time range: All time" }).click();
    await expect(page.getByText(/^40$/).first()).toBeVisible();
  });

  test("5. An insight navigates to its module", async ({ page }) => {
    await openProgress(page, { seeded: true });

    const insights = section(page, "Based on Your Recorded Activity");
    await insights.getByRole("link", { name: /Open Revision/i }).click();
    await expect(page).toHaveURL(/\/app\/revision/);
    await expect(page.getByRole("heading", { name: "Revision", exact: true })).toBeVisible();
  });

  test("6. Responsive layout: no horizontal overflow on any target viewport", async ({ page }) => {
    await openProgress(page, { seeded: true });

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
      await page.waitForTimeout(120);
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(hasHorizontalScroll, `Horizontal overflow at ${vp.width}x${vp.height}`).toBe(false);
    }
  });

  test.describe.serial("Authenticated analytics", () => {
    test("7. Authenticated progress reflects D1-backed data", async ({ page }) => {
      test.setTimeout(150_000);
      const email = `analytics_${Date.now()}@parikshaverse.in`;

      if (getAuthStrategy() === "demo") {
        // Staging: authenticate through the demo panel. Friend 4 is not used
        // by any other spec; its shared profile is sticky across runs, so the
        // probe topic is reset first to keep the coverage assertions exact.
        await demoSignIn(page, "Friend 4");
        await ensureTopicNotStarted(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_UNITS_LABEL);
      } else {
        await createAccountWithEmail(page, email);
        await page.waitForURL(/\/exam\/select/, { timeout: 15000 });

        await page.getByRole("radio", { name: /neet/i }).click();
        await page.getByRole("button", { name: /continue with neet 2027/i }).click();
        await page.getByRole("radio", { name: "1 hr" }).click();
        await page.getByRole("radio", { name: /just starting/i }).click();
        await page.getByRole("button", { name: /create my preparation space/i }).click();
        await page.waitForURL(/\/app\/home/, { timeout: 15000 });
        await expect(page.getByText(email).first()).toBeVisible({ timeout: 20000 });
      }

      // Record real progress through the Study UI.
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

      // Analytics render server-backed coverage.
      await page.goto("/app/progress");
      await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(/1\s*\/\s*139 topics covered \(1%\)/)).toBeVisible();
      await expect(page.getByText("Studied on 0 of the last 30 days.")).toBeVisible();
    });
  });
});
