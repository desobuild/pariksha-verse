import { test, expect } from "@playwright/test";
import {
  attachHealthCollector,
  completeGuestSetup,
  formatIssues,
  skipIfProject,
  T_MOTION,
} from "./helpers";

/**
 * Phase 8 — Practice engine additions beyond the existing local specs:
 * 10-question mixed practice with previous-navigation and answer-change
 * checks, a topic with fewer available questions than requested (clamping),
 * and result consistency (attempted/unanswered accounting).
 */
test.describe("Staging Practice Engine (extended)", () => {
  skipIfProject(/Mobile/);

  test("10-question mixed practice: previous navigation, answer change, full result", async ({
    page,
  }) => {
    const health = attachHealthCollector(page);
    await completeGuestSetup(page);

    await page.goto("/app/practice");
    await page.getByRole("button", { name: "Practice Questions" }).click();
    await expect(page.getByText("Start Question Practice")).toBeVisible();
    await page.getByRole("button", { name: /Mixed \(All\)/i }).click();
    await page.getByRole("button", { name: "10 Questions" }).click();
    await page.getByRole("button", { name: "Start Practice Session" }).click();
    await expect(page).toHaveURL(/\/app\/practice\/session\/q_sess_/, { timeout: 20_000 });
    await expect(page.getByText(/Question 1 of 10/i)).toBeVisible();

    // Q1: answer, move forward, come back, change answer.
    const radiosQ1 = page.getByRole("radio");
    await expect(radiosQ1.first()).toBeVisible();
    await radiosQ1.nth(0).click();
    await expect(radiosQ1.nth(0)).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText(/Question 2 of 10/i)).toBeVisible();

    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.getByText(/Question 1 of 10/i)).toBeVisible();
    // Selection survives the round trip.
    await expect(page.getByRole("radio").nth(0)).toHaveAttribute("aria-checked", "true");

    // Change the answer on Q1.
    const q1Radios = page.getByRole("radio");
    if ((await q1Radios.count()) > 1) {
      await q1Radios.nth(1).click();
      await expect(q1Radios.nth(1)).toHaveAttribute("aria-checked", "true");
    }

    // Answer the remaining questions.
    for (let q = 1; q <= 10; q++) {
      if (q > 1) {
        const radios = page.getByRole("radio");
        await expect(radios.first()).toBeVisible();
        await radios.first().click();
      }
      if (q < 10) {
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page.getByText(new RegExp(`Question ${q + 1} of 10`, "i"))).toBeVisible();
      }
    }

    // Review + submit.
    await page.getByRole("button", { name: "Review practice session" }).first().click();
    await expect(page.getByText("Practice Session Review")).toBeVisible();
    await expect(page.getByText("Answered", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Submit Practice" }).click();

    // Result.
    await expect(page).toHaveURL(/\/app\/practice\/session\/q_sess_.*\/result/, {
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Practice Session Summary" })).toBeVisible();
    await expect(page.getByText("/ 10", { exact: true })).toBeVisible();
    await expect(page.getByText("Accuracy", { exact: true })).toBeVisible();
    await expect(page.getByText("Duration", { exact: true })).toBeVisible();

    // Full review with explanations.
    await expect(page.getByRole("heading", { name: "Question-by-Question Review" })).toBeVisible();
    await expect(page.getByText("All (10)")).toBeVisible();
    await expect(page.getByText(/^Explanation:/i).first()).toBeVisible();

    // History: mixed sessions are split per-topic into practice sessions by
    // design (src/repositories/guest-repositories.ts submitSession), so the
    // Recent Practice rows won't total 10 in one row. The Performance
    // Snapshot aggregates them: all 10 answered questions must be counted.
    await page.getByRole("link", { name: "Practice Hub" }).click();
    await expect(page).toHaveURL("/app/practice");
    const snapshot = page.getByRole("region", { name: "Performance Snapshot" });
    await expect(snapshot.getByText("Questions Attempted", { exact: true })).toBeVisible();
    await expect(snapshot.getByText(/^10$/).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent Practice" }).getByText(/sessions logged/i)).toBeVisible();

    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });

  test("topic practice clamps to the available question count", async ({ page }) => {
    const health = attachHealthCollector(page);
    await completeGuestSetup(page);

    await page.goto("/app/practice");
    await page.getByRole("button", { name: "Practice Questions" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.locator("#topic-subject-select").selectOption("physics");
    await page.locator("#topic-chapter-select").selectOption("exam_neet_physics_kinematics");
    await page.locator("#topic-topic-select").selectOption(T_MOTION);

    // Read the authoritative available count from the dialog.
    const availabilityNote = dialog.getByText(/questions available in bank/i);
    await expect(availabilityNote).toBeVisible();
    const noteText = (await availabilityNote.textContent()) ?? "";
    const available = Number(noteText.match(/(\d+)/)?.[1] ?? "0");
    expect(available, "dialog should report the available question count").toBeGreaterThan(0);

    // The dialog only offers fixed counts [5, 10, 20]; requesting more than
    // the bank holds clamps the session to the available count.
    await page.getByRole("button", { name: "5 Questions" }).click();
    if (available < 5) {
      await expect(dialog.getByText(new RegExp(`Session will include all ${available} available`, "i"))).toBeVisible();
    }
    await page.getByRole("button", { name: "Start Practice Session" }).click();

    await expect(page).toHaveURL(/\/app\/practice\/session\/q_sess_/, { timeout: 20_000 });
    // The session must never promise more questions than the bank holds.
    const expectedCount = Math.min(5, available);
    await expect(
      page.getByText(new RegExp(`Question 1 of ${expectedCount}`, "i"))
    ).toBeVisible();

    // Unanswered submission accounting.
    await page.getByRole("button", { name: "Review practice session" }).first().click();
    await expect(page.getByText("Practice Session Review")).toBeVisible();
    await expect(page.getByText(/You have \d+ unanswered questions/i)).toBeVisible();
    await page.getByRole("button", { name: "Submit Practice" }).click();
    await expect(page).toHaveURL(/\/result$/, { timeout: 20_000 });
    // Score card renders "<correct> / <total>" with a space before the slash.
    await expect(page.getByText(`/ ${expectedCount}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`All (${expectedCount})`)).toBeVisible();

    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });
});
