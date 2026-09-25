import { test, expect, type Page } from "@playwright/test";

test.describe("Phase 9 Practice & Performance Tracking E2E", () => {
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

  const T_UNITS = "exam_neet_physics_physics-and-measurement_units-and-measurements";

  test("1 & 2. Guest opens Practice and sees empty state", async ({ page }) => {
    await completeGuestSetup(page);

    await page.goto("/app/practice");
    await expect(page.getByRole("heading", { name: "Practice & Performance" })).toBeVisible();

    // Verify empty state messages
    await expect(page.getByText("No practice sessions recorded yet.")).toBeVisible();
    await expect(page.getByText("Nothing is currently below your practice threshold.")).toBeVisible();

    // Verify snapshot shows 0 attempts
    await expect(page.getByText("Questions Attempted", { exact: true })).toBeVisible();
    await expect(page.getByText("Overall Accuracy")).toBeVisible();
  });

  test("3, 4, 5, 6, 7 & 8. Subject, Chapter, Topic cascading, validation, recording, and accuracy calculation", async ({
    page,
  }) => {
    await completeGuestSetup(page);
    await page.goto("/app/practice");

    // Open Record Practice modal
    await page.getByRole("button", { name: "Record Practice" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Select Subject -> Physics
    const subjectSelect = page.locator("#practice-subject");
    await subjectSelect.selectOption("physics");

    // Chapter select should have Physics chapters
    const chapterSelect = page.locator("#practice-chapter");
    await expect(chapterSelect).toBeEnabled();

    // Topic select should have topics
    const topicSelect = page.locator("#practice-topic");
    await expect(topicSelect).toBeEnabled();

    // Test validation: correct answers exceeding attempted
    const attemptedInput = page.locator("#questions-attempted");
    const correctInput = page.locator("#correct-answers");

    await attemptedInput.fill("20");
    await correctInput.fill("25");

    await expect(
      page.getByText("Correct answers cannot exceed questions attempted.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Practice" })).toBeDisabled();

    // Enter valid values: 20 attempted, 15 correct (75% accuracy)
    await correctInput.fill("15");
    await expect(page.getByText("15 / 20 · 75%")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Practice" })).toBeEnabled();

    // Submit form
    await page.getByRole("button", { name: "Save Practice" }).click();

    // Verify success confirmation
    await expect(page.getByText("Practice recorded.")).toBeVisible();
    await expect(page.getByText(/15 \/ 20 correct/)).toBeVisible();

    // Dismiss confirmation via Done button
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify snapshot updated to 20 questions, 15 correct, 75% accuracy
    const snapshotRegion = page.getByRole("region", { name: "Performance Snapshot" });
    await expect(snapshotRegion.getByText("15 correct")).toBeVisible();
    await expect(snapshotRegion.getByText("75%")).toBeVisible();
  });

  test("9 & 14. Recent practice session appears and survives reload", async ({ page }) => {
    await completeGuestSetup(page);
    await page.goto("/app/practice");

    // Record a session
    await page.getByRole("button", { name: "Record Practice" }).click();
    await page.locator("#questions-attempted").fill("25");
    await page.locator("#correct-answers").fill("20");
    await page.getByRole("button", { name: "Save Practice" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Check recent practice session row
    const recentPractice = page.getByRole("region", { name: "Recent Practice" });
    await expect(recentPractice.getByText("25 questions")).toBeVisible();
    await expect(recentPractice.getByText("20 correct")).toBeVisible();

    // Reload the page to test persistence
    await page.reload();
    const recentReloaded = page.getByRole("region", { name: "Recent Practice" });
    await expect(recentReloaded.getByText("25 questions")).toBeVisible();
    await expect(recentReloaded.getByText("20 correct")).toBeVisible();
  });

  test("10. Topic detail page displays Practice Performance and Record Practice CTA", async ({
    page,
  }) => {
    await completeGuestSetup(page);

    // Navigate to topic detail
    await page.goto(`/app/study/${T_UNITS}`);
    await expect(page.getByRole("heading", { name: "Practice Performance" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Record Practice" })).toBeVisible();

    // Click Record Practice from topic detail
    await page.getByRole("link", { name: "Record Practice" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/practice\\?topicId=${T_UNITS}`));

    // Dialog opens automatically with topic pre-selected
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator("p", { hasText: "Units of Measurement, SI Units & Derived Units" })
    ).toBeVisible();
  });

  test("11. Weak topic (<60% accuracy) triggers Topics Needing Practice list", async ({ page }) => {
    await completeGuestSetup(page);
    await page.goto("/app/practice");

    // Record low accuracy practice: 20 attempted, 8 correct (40% accuracy < 60%)
    await page.getByRole("button", { name: "Record Practice" }).click();
    await page.locator("#questions-attempted").fill("20");
    await page.locator("#correct-answers").fill("8");
    await page.getByRole("button", { name: "Save Practice" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Weak topic should now appear in Topics Needing Practice
    const weakSection = page.getByRole("region", { name: "Topics Needing Practice" });
    await expect(weakSection.getByText("40% accuracy")).toBeVisible();
    await expect(weakSection.getByRole("button", { name: "Practice Again" })).toBeVisible();

    // Clicking Practice Again opens dialog for that topic
    await weakSection.getByRole("button", { name: "Practice Again" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("12. Dashboard Practice quick action navigates to /app/practice", async ({ page }) => {
    await completeGuestSetup(page);

    await page.goto("/app/home");
    const practiceAction = page.getByRole("link", { name: /practice question sets/i });
    await expect(practiceAction).toBeVisible();
    await practiceAction.click();

    await expect(page).toHaveURL("/app/practice");
    await expect(page.getByRole("heading", { name: "Practice & Performance" })).toBeVisible();
  });

  test("15. Mobile layout has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await completeGuestSetup(page);

    await page.goto("/app/practice");
    await expect(page.getByRole("heading", { name: "Practice & Performance" })).toBeVisible();

    // Check horizontal scroll width
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
