import { test, expect } from "@playwright/test";
import {
  attachHealthCollector,
  completeGuestSetup,
  formatIssues,
  markTopicLearned,
  openTopic,
  skipIfProject,
  CHAPTER_PHYSICS_AND_MEASUREMENT,
  TOPIC_UNITS_LABEL,
} from "./helpers";

/**
 * Phase 11 — Analytics additions beyond the existing (reused) analytics spec:
 * all four time ranges against activity generated live through the UI, weak
 * topic surfacing, and the no-prediction-language guarantee.
 */
test.describe("Staging Analytics (extended)", () => {
  skipIfProject(/Mobile/);
  test.describe.configure({ mode: "serial" });

  test("time range filters reflect live guest activity in every window", async ({ page }) => {
    const health = attachHealthCollector(page);
    await completeGuestSetup(page);

    // Generate activity through the normal UI:
    // 1) a completed topic (coverage)
    await markTopicLearned(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_UNITS_LABEL);

    // 2) recorded practice on the same topic: 20 attempted / 8 correct (40%)
    await openTopic(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_UNITS_LABEL);
    await page.getByRole("link", { name: "Record Practice" }).click();
    await expect(page).toHaveURL(/\/app\/practice\?topicId=/);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.locator("#questions-attempted").fill("20");
    await page.locator("#correct-answers").fill("8");
    await page.getByRole("button", { name: "Save Practice" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });

    // 3) a 15-minute study session today
    await openTopic(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_UNITS_LABEL);
    await page.getByRole("button", { name: /log time manually/i }).click();
    await page.getByRole("spinbutton", { name: /duration in minutes/i }).fill("15");
    await page.getByRole("button", { name: /save session/i }).click();
    await expect(page.getByText(/15 min/).first()).toBeVisible({ timeout: 10_000 });

    // Analytics open with the default window and render the live dataset.
    await page.goto("/app/progress");
    await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible({
      timeout: 20_000,
    });

    // Coverage includes the completed topic.
    await expect(page.getByText(/1\s*\/\s*139 topics covered/)).toBeVisible();

    // Subject performance surfaces the weak topic (40% < 60%).
    await expect(
      page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "Subject Performance" }) })
        .getByRole("heading", { name: "Physics" })
    ).toBeVisible();
    await expect(page.getByText("Weak topics").first()).toBeVisible();

    // Study time includes today's 15-minute session.
    await expect(page.getByText("15 min").first()).toBeVisible();

    // All four time ranges must render the correct dataset. All activity was
    // generated today, so the 20 recorded questions appear in every window.
    for (const range of ["7 days", "30 days", "90 days", "All time"] as const) {
      await page.getByRole("tab", { name: `Time range: ${range}` }).click();
      await expect(
        page.getByText(/^20$/).first(),
        `practice total should be 20 in the ${range} window`
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("15 min").first()).toBeVisible();
    }

    // The consistency copy is range-aware: bounded windows say "of the last
    // N days", All time says "in total".
    await page.getByRole("tab", { name: "Time range: 30 days" }).click();
    await expect(page.getByText(/Studied on 1 of the last 30 days\./)).toBeVisible();
    await page.getByRole("tab", { name: "Time range: All time" }).click();
    await expect(page.getByText(/Studied on 1 days? in total\./)).toBeVisible();

    // No readiness score/rank/percentile language anywhere.
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/readiness score|percentile|predicted rank|you will (qualify|clear)/i);

    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });
});
