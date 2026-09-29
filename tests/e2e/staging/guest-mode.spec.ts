import { test, expect } from "@playwright/test";
import {
  attachHealthCollector,
  completeGuestSetup,
  continueAsGuestFromLanding,
  formatIssues,
  markTopicLearned,
  runPracticeSession,
  skipIfProject,
  CHAPTER_PHYSICS_AND_MEASUREMENT,
  TOPIC_UNITS_LABEL,
} from "./helpers";

/**
 * Phase 5 — Guest mode on a fresh browser context.
 * Guest data lives in the context's IndexedDB (the app's intended
 * device-local behavior), so a fresh Playwright context behaves like a fresh
 * device — it is NOT a real browser profile and that difference is expected.
 */
test.describe("Staging Guest Mode", () => {
  skipIfProject(/Mobile/);
  test.describe.configure({ mode: "serial" });

  test("guest journey: enter, onboard NEET 2027, study, practice, revision, mocks, progress — with refresh persistence", async ({
    page,
  }) => {
    const health = attachHealthCollector(page);

    // Enter Guest via the landing page and onboard NEET 2027.
    await continueAsGuestFromLanding(page);
    await completeGuestSetup(page);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    // Study: complete a topic.
    await markTopicLearned(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_UNITS_LABEL);

    // Practice: run a 5-question mixed session, answering 3 of 5.
    await runPracticeSession(page, { questionCount: 5, answered: 3 });
    // Score card renders as "<correct> / 5" — the exact correct count depends
    // on the answer key, but the out-of-5 display must render.
    await expect(page.getByText("/ 5", { exact: true })).toBeVisible();

    // Practice history: mixed sessions are split per-topic by design, so the
    // Performance Snapshot aggregate is the deterministic check (fresh guest:
    // exactly 3 attempted questions).
    await page.goto("/app/practice");
    const snapshot = page.getByRole("region", { name: "Performance Snapshot" });
    await expect(snapshot.getByText("Questions Attempted", { exact: true })).toBeVisible();
    await expect(snapshot.getByText(/^3$/).first()).toBeVisible();

    // Revision: the completed topic schedules its first revision.
    await page.goto("/app/revision");
    await expect(
      page.getByText("Units of Measurement, SI Units & Derived Units").first()
    ).toBeVisible();

    // Mock Tests hub opens.
    await page.goto("/app/mock-tests");
    await expect(page.getByRole("heading", { name: "Mock Tests", exact: true })).toBeVisible();
    await expect(page.getByText("Available Mock Tests")).toBeVisible();

    // Progress/Analytics opens and reflects the covered topic. The mixed
    // practice may touch additional topics, so only assert the learned topic
    // is counted (≥1) and that the value is stable across reload.
    await page.goto("/app/progress");
    await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();
    const coverageText = await page
      .getByText(/\d+\s*\/\s*139 topics covered/)
      .first()
      .textContent();
    const covered = Number((coverageText ?? "0").match(/(\d+)\s*\/\s*139/)?.[1] ?? 0);
    expect(
      covered,
      `coverage should include the learned topic (got: ${coverageText?.trim()})`
    ).toBeGreaterThanOrEqual(1);

    // Guest state persists across refresh (IndexedDB) — identical coverage.
    await page.reload();
    await expect(page.getByText(new RegExp(`${covered}\\s*/\\s*139 topics covered`))).toBeVisible();
    await page.goto("/app/study");
    await page.getByRole("button", { name: CHAPTER_PHYSICS_AND_MEASUREMENT }).click();
    await expect(
      page
        .locator("ul[id^='chapter-topics-']")
        .getByRole("link", { name: TOPIC_UNITS_LABEL })
        .getByText("Learned")
    ).toBeVisible();

    const unexpected = health.stop();
    expect(unexpected, `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });

  test("a brand-new context (fresh device) starts with no guest state", async ({ page }) => {
    // New test = new storage-isolated context. The app must treat it as a
    // fresh device: no workspace, no session, routed into exam setup.
    const health = attachHealthCollector(page);
    await page.goto("/app/home");
    await expect(page).toHaveURL(/\/exam\/select/);
    await page.goto("/app/more");
    await expect(page.getByText(/guest mode/i).first()).toBeVisible();
    await page.goto("/app/progress");
    await expect(page).toHaveURL(/\/exam\/select/);
    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });
});
