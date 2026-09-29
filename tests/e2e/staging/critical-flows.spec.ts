import { test, expect } from "@playwright/test";
import {
  attachHealthCollector,
  completeGuestSetup,
  demoSignIn,
  demoSignOut,
  formatIssues,
  markTopicLearned,
  runPracticeSession,
  skipIfProject,
  CHAPTER_PHYSICS_AND_MEASUREMENT,
  TOPIC_LEAST_COUNT_LABEL,
} from "./helpers";

/**
 * Phase 13 — Critical flows on every configured desktop browser
 * (Desktop Chrome + Desktop Firefox).
 *
 * Two variants:
 *  - demo auth flow (Friend 3): the primary staging auth path.
 *  - guest flow: device-local auth alternative; keeps nav/study/practice/mock
 *    coverage meaningful in browsers even while demo auth is unavailable.
 */
test.describe("Staging Critical Flows (desktop cross-browser)", () => {
  skipIfProject(/Mobile/);

  test("demo auth critical flow: auth → navigation → study → practice → mock → logout", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const health = attachHealthCollector(page);

    // Auth: demo sign-in.
    await demoSignIn(page, "Friend 3");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    // Navigation across all sections.
    for (const route of ["/app/study", "/app/progress", "/app/resources", "/app/home"]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
    }

    // Study: complete a topic (distinct from the isolation probe topics).
    await markTopicLearned(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_LEAST_COUNT_LABEL);

    // Practice: full 5-question session.
    await runPracticeSession(page, { questionCount: 5, answered: 5 });
    await expect(page.getByText("/ 5", { exact: true })).toBeVisible();

    // Mock: start the first mock, answer one question, submit, see the result.
    await page.goto("/app/mock-tests");
    await expect(page.getByRole("heading", { name: "Mock Tests", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Start Mock" }).first().click();
    await expect(page).toHaveURL(/\/app\/mock-tests\/mock_/, { timeout: 20_000 });
    await expect(page.getByText("Section Breakdown")).toBeVisible();
    const startBtn = page.getByRole("button", { name: /start mock test|resume mock test/i });
    await startBtn.scrollIntoViewIfNeeded();
    await startBtn.click();
    await expect(page).toHaveURL(/\/app\/mock-tests\/mock_.*\/session\/sess_/, { timeout: 20_000 });
    await expect(page.getByRole("timer")).toBeVisible();
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

    // Logout.
    await demoSignOut(page);
    await page.goto("/app/home");
    await expect(page).toHaveURL(/\/exam\/select/);

    const unexpected = health.stop();
    expect(unexpected, `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });

  test("guest critical flow: onboarding → navigation → study → practice → mock → persistence", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const health = attachHealthCollector(page);

    // Guest auth path: onboarding creates the device-local workspace.
    await completeGuestSetup(page);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    // Session persists across refresh (IndexedDB workspace).
    await page.reload();
    await expect(page.getByText("NEET 2027").first()).toBeVisible({ timeout: 20_000 });

    // Navigation across all sections.
    for (const route of ["/app/study", "/app/progress", "/app/resources", "/app/home"]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
    }

    // Study: complete a topic (distinct from the isolation probe topics).
    await markTopicLearned(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_LEAST_COUNT_LABEL);

    // Practice: full 5-question session.
    await runPracticeSession(page, { questionCount: 5, answered: 5 });
    await expect(page.getByText("/ 5", { exact: true })).toBeVisible();

    // Mock: start the first mock, answer one question, submit, see the result.
    await page.goto("/app/mock-tests");
    await expect(page.getByRole("heading", { name: "Mock Tests", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Start Mock" }).first().click();
    await expect(page).toHaveURL(/\/app\/mock-tests\/mock_/, { timeout: 20_000 });
    const startBtn = page.getByRole("button", { name: /start mock test|resume mock test/i });
    await startBtn.scrollIntoViewIfNeeded();
    await startBtn.click();
    await expect(page).toHaveURL(/\/app\/mock-tests\/mock_.*\/session\/sess_/, { timeout: 20_000 });
    await expect(page.getByRole("timer")).toBeVisible();
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

    // Guest persistence across refresh.
    await page.goto("/app/study");
    await page.getByRole("button", { name: /physics and measurement/i }).click();
    await expect(
      page
        .locator("ul[id^='chapter-topics-']")
        .getByRole("link", { name: TOPIC_LEAST_COUNT_LABEL })
        .getByText("Learned")
    ).toBeVisible();

    const unexpected = health.stop();
    expect(unexpected, `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });
});
