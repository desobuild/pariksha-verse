import { test, expect, type Page } from "@playwright/test";
import {
  attachHealthCollector,
  demoSignIn,
  demoSignOut,
  ensureTopicNotStarted,
  formatIssues,
  markCurrentTopicLearned,
  markTopicLearned,
  openTopic,
  readTopicStatus,
  skipIfProject,
  CHAPTER_KINEMATICS,
  CHAPTER_PHYSICS_AND_MEASUREMENT,
  TOPIC_MOTION_LABEL,
  TOPIC_UNITS_LABEL,
} from "./helpers";

/**
 * Phase 4 — USER ISOLATION (release blocker if violated).
 *
 * Friend 1 and Friend 2 are server-backed demo accounts, so any leakage here
 * would mean cross-user data exposure in the real auth path. Everything runs
 * through the normal UI: no D1 access, no API forging.
 *
 * Demo profiles on staging are shared and sticky, so the baseline resets both
 * probe topics through the UI before the probe begins.
 *
 * Probe topics:
 *  - Topic A: "Units of Measurement, SI Units & Derived Units" (Friend 1 writes)
 *  - Topic B: "Frame of Reference, Uniform & Non-Uniform Motion" (Friend 2 writes)
 */
test.describe("Staging User Isolation", () => {
  skipIfProject(/Mobile/);
  test.describe.configure({ mode: "serial" });

  /**
   * Waits for any in-flight topic-progress write to complete before the test
   * navigates away: a full-page navigation aborts in-flight fetches, which
   * would otherwise silently drop the write.
   */
  async function waitForProgressWrite(page: Page): Promise<void> {
    // Progress writes fire inside markCurrentTopicLearned / status resets; a
    // short settle wait plus the optimistic UI check covers the request
    // round-trip. No navigation happens inside those helpers.
    await page.waitForTimeout(1_500);
  }

  test("baseline: both demo profiles start clean for the probe topics", async ({ page }) => {
    for (const friend of ["Friend 1", "Friend 2"] as const) {
      await demoSignIn(page, friend);
      // Shared demo profiles are sticky: reset any state left by earlier
      // runs/sessions through the normal UI so the probe starts clean.
      await ensureTopicNotStarted(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_UNITS_LABEL);
      await ensureTopicNotStarted(page, CHAPTER_KINEMATICS, TOPIC_MOTION_LABEL);
      const statusA = await readTopicStatus(
        page,
        CHAPTER_PHYSICS_AND_MEASUREMENT,
        TOPIC_UNITS_LABEL
      );
      expect(statusA, `${friend} probe topic A should be clean`).toBe("Not Started");
      const statusB = await readTopicStatus(page, CHAPTER_KINEMATICS, TOPIC_MOTION_LABEL);
      expect(statusB, `${friend} probe topic B should be clean`).toBe("Not Started");
      await demoSignOut(page);
    }
  });

  test("Friend 1 creates user-specific state via the normal UI", async ({ page }) => {
    const health = attachHealthCollector(page);
    await demoSignIn(page, "Friend 1");

    await openTopic(page, CHAPTER_PHYSICS_AND_MEASUREMENT, TOPIC_UNITS_LABEL);

    // Create study activity: manual 15-minute session. The today aggregate
    // ("· N sessions") is asserted instead of the per-session duration so the
    // check is independent of previously accumulated sessions.
    await page.getByRole("button", { name: /log time manually/i }).click();
    await page.getByRole("spinbutton", { name: /duration in minutes/i }).fill("15");
    await page.getByRole("button", { name: /save session/i }).click();
    await expect(page.getByText(/· \d+ sessions?/).first()).toBeVisible({ timeout: 15_000 });

    // Complete the topic.
    await markCurrentTopicLearned(page);
    await waitForProgressWrite(page);

    await demoSignOut(page);
    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });

  test("Friend 2 cannot see Friend 1's topic status, study sessions, or revision schedule", async ({
    page,
  }) => {
    const health = attachHealthCollector(page);
    await demoSignIn(page, "Friend 2");

    // Topic status did not leak.
    const statusA = await readTopicStatus(
      page,
      CHAPTER_PHYSICS_AND_MEASUREMENT,
      TOPIC_UNITS_LABEL
    );
    expect(statusA, "Friend 1's topic completion leaked to Friend 2").toBe("Not Started");

    // Study sessions did not leak: the topic still shows its empty state.
    await expect(page.getByText(/no study sessions recorded yet/i)).toBeVisible();

    // Revision schedule did not leak: nothing is upcoming for the probe topic.
    await page.goto("/app/revision");
    await expect(page.getByRole("heading", { name: "Revision", exact: true })).toBeVisible();
    await expect(page.getByText("Units of Measurement, SI Units & Derived Units")).toHaveCount(0);

    // Friend 2 creates its own state.
    await markTopicLearned(page, CHAPTER_KINEMATICS, TOPIC_MOTION_LABEL);
    await waitForProgressWrite(page);

    await demoSignOut(page);
    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });

  test("Friend 1 retains own state and cannot see Friend 2's state", async ({ page }) => {
    const health = attachHealthCollector(page);
    await demoSignIn(page, "Friend 1");

    // Own state persists (server-backed).
    const statusA = await readTopicStatus(
      page,
      CHAPTER_PHYSICS_AND_MEASUREMENT,
      TOPIC_UNITS_LABEL
    );
    expect(statusA, "Friend 1's own topic completion was lost").toBe("Learned");

    // Friend 2's state did not leak.
    const statusB = await readTopicStatus(page, CHAPTER_KINEMATICS, TOPIC_MOTION_LABEL);
    expect(statusB, "Friend 2's topic completion leaked to Friend 1").toBe("Not Started");

    await demoSignOut(page);
    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });
});
