import { test, expect } from "@playwright/test";
import {
  attachHealthCollector,
  completeGuestSetup,
  continueAsGuestFromLanding,
  demoSignIn,
  demoSignOut,
  ensureTopicNotStarted,
  formatIssues,
  markTopicLearned,
  runPracticeSession,
  skipIfProject,
  CHAPTER_PHYSICS_AND_MEASUREMENT,
  TOPIC_UNITS_LABEL,
} from "./helpers";

/**
 * Phase 6 — Guest → Account migration.
 *
 * A fresh guest builds meaningful data through the normal UI (topic progress,
 * practice result, revision schedule, mock result), then signs in as Friend 1
 * via the staging panel. The app promises automatic migration of guest data
 * on sign-in. All verification is via the UI after migration, after refresh,
 * and again after a fresh sign-in.
 */
test.describe("Staging Guest → Account Migration", () => {
  skipIfProject(/Mobile/);
  test.describe.configure({ mode: "serial" });

  /**
   * Reset runs in its OWN test (its own storage-isolated browser context):
   * signing in with an empty local store marks the client-side guest
   * migration as "already completed" for Friend 1, which would idempotency-
   * skip the real migration in the same context.
   */
  test("reset probe topic on the shared Friend 1 profile", async ({ page }) => {
    await demoSignIn(page, "Friend 1");
    await ensureTopicNotStarted(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_UNITS_LABEL);
    await demoSignOut(page);
  });

  test("guest data survives migration into the Friend 1 account", async ({ page }) => {
    test.setTimeout(240_000);
    const health = attachHealthCollector(page);

    // --- Guest builds meaningful data -----------------------------------
    await continueAsGuestFromLanding(page);
    await completeGuestSetup(page);

    // Topic progress
    await markTopicLearned(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_UNITS_LABEL);

    // Practice result (3 of 5 answered)
    await runPracticeSession(page, { questionCount: 5, answered: 3 });
    await expect(page.getByText("/ 5", { exact: true })).toBeVisible();

    // Revision activity: the learned topic schedules its first revision
    await page.goto("/app/revision");
    await expect(
      page.getByText("Units of Measurement, SI Units & Derived Units").first()
    ).toBeVisible();

    // Mock result: run the first mock, answering one question, then submit
    await page.goto("/app/mock-tests");
    await page.getByRole("link", { name: "Start Mock" }).first().click();
    await expect(page).toHaveURL(/\/app\/mock-tests\/mock_/, { timeout: 20_000 });
    const startTestBtn = page.getByRole("button", { name: /start mock test/i });
    await startTestBtn.scrollIntoViewIfNeeded();
    await startTestBtn.click();
    await expect(page).toHaveURL(/\/app\/mock-tests\/mock_.*\/session\/sess_/, { timeout: 20_000 });
    const radios = page.getByRole("radio");
    await expect(radios.first()).toBeVisible();
    await radios.first().click();
    const submitBtn = page.getByRole("button", { name: /^Submit$/ }).first();
    await submitBtn.click();
    const submitModal = page.getByRole("dialog");
    await expect(submitModal.getByRole("heading", { name: "Submit Mock Test?" })).toBeVisible();
    await submitModal.getByRole("button", { name: "Submit Mock Test" }).click();
    await expect(page).toHaveURL(/\/result$/, { timeout: 20_000 });
    await expect(page.getByText("Final Raw Score")).toBeVisible();

    // --- Migrate: sign in as Friend 1 through the normal UI --------------
    // Migration is awaited before sign-in reports success, so by the time the
    // panel navigates to /app/home the migrate POST has completed.
    const migrateResponse = page.waitForResponse(
      (res) => res.url().includes("/api/auth/migrate") && res.request().method() === "POST",
      { timeout: 30_000 }
    );
    await demoSignIn(page, "Friend 1");
    const migrate = await migrateResponse;
    expect(
      migrate.ok(),
      `guest migration POST failed: ${migrate.status()} ${await migrate.text().catch(() => "")}`
    ).toBe(true);

    // Topic progress preserved. The guest's mixed practice may itself have
    // advanced the topic past "Learned" (Practiced/Revised rank higher in the
    // status priority), so any status at or above Learned counts as preserved.
    await expect
      .poll(
        async () => {
          await page.goto("/app/study");
          await page.getByRole("button", { name: /physics and measurement/i }).click();
          const row = page
            .locator("ul[id^='chapter-topics-']")
            .getByRole("link", { name: TOPIC_UNITS_LABEL });
          return (await row.getByText(/Learned|Practiced|Revised|Mastered/).count()) > 0
            ? "Preserved"
            : "Not Learned";
        },
        { timeout: 30_000, intervals: [2_000, 4_000, 8_000] }
      )
      .toBe("Preserved");

    // Practice history preserved (mixed sessions split per-topic by design,
    // so the aggregate snapshot and a non-empty history are the checks; the
    // shared profile accumulates across runs, so only presence is asserted).
    await page.goto("/app/practice");
    const snapshot = page.getByRole("region", { name: "Performance Snapshot" });
    await expect(snapshot.getByText("Questions Attempted", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Recent Practice" }).getByText(/sessions logged/i)
    ).toBeVisible();

    // Revision state preserved.
    await page.goto("/app/revision");
    await expect(
      page.getByText("Units of Measurement, SI Units & Derived Units").first()
    ).toBeVisible();

    // Mock history preserved.
    await page.goto("/app/mock-tests");
    await expect(page.getByText("Attempt History")).toBeVisible();
    await expect(page.getByText("Mocks Taken")).toBeVisible();

    // Analytics reflect migrated activity: at least one covered topic.
    await page.goto("/app/progress");
    await expect(page.getByText(/\d+\s*\/\s*139 topics covered/)).toBeVisible();
    const coverage = await page.getByText(/\d+\s*\/\s*139 topics covered/).textContent();
    const covered = Number((coverage ?? "0").match(/(\d+)\s*\/\s*139/)?.[1] ?? 0);
    expect(covered, "coverage should include the migrated topic").toBeGreaterThanOrEqual(1);

    // Refresh: migrated data still there.
    await page.reload();
    await expect(page.getByText(/\d+\s*\/\s*139 topics covered/)).toBeVisible();

    await demoSignOut(page);

    const unexpected = health.stop();
    if (unexpected.length > 0) {
      console.warn(`[migration] issues captured:\n${formatIssues(health.issues)}`);
    }
  });

  test("migrated data persists after sign-out and a fresh sign-in as Friend 1", async ({
    page,
  }) => {
    const health = attachHealthCollector(page);
    await demoSignIn(page, "Friend 1");

    await page.goto("/app/study");
    await page.getByRole("button", { name: /physics and measurement/i }).click();
    await expect(
      page
        .locator("ul[id^='chapter-topics-']")
        .getByRole("link", { name: TOPIC_UNITS_LABEL })
        .getByText(/Learned|Practiced|Revised|Mastered/)
    ).toBeVisible();

    await page.goto("/app/practice");
    const snapshot = page.getByRole("region", { name: "Performance Snapshot" });
    await expect(snapshot.getByText("Questions Attempted", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Recent Practice" }).getByText(/sessions logged/i)
    ).toBeVisible();

    await page.goto("/app/revision");
    await expect(
      page.getByText("Units of Measurement, SI Units & Derived Units").first()
    ).toBeVisible();

    await page.goto("/app/mock-tests");
    await expect(page.getByText("Attempt History")).toBeVisible();

    await demoSignOut(page);
    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });
});
