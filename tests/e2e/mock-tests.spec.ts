import { test, expect, type Page } from "@playwright/test";

test.describe("Phase 11: Mock Tests & Exam Simulation E2E", () => {
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

  /** Navigate to last question by clicking Next repeatedly until it disappears */
  async function goToLastQuestion(page: Page) {
    for (let i = 0; i < 60; i++) {
      const nextBtn = page.getByRole("button", { name: "Next", exact: true });
      // count() returns immediately (no retry) — 0 means no "Next" = we're on last question
      if ((await nextBtn.count()) === 0) break;
      await nextBtn.click();
      await page.waitForTimeout(150);
    }
  }

  test("1. Full mock test flow: choose mock, view instructions, start, answer, mark review, jump via palette, submit, view results and review", async ({
    page,
  }) => {
    await completeGuestSetup(page);

    // 1. Open Mock Tests hub
    await page.goto("/app/mock-tests");
    await expect(page.getByRole("heading", { name: "Mock Tests", exact: true })).toBeVisible();

    // Verify stats and available mock cards exist
    await expect(page.getByText("Available Mock Tests")).toBeVisible();
    await expect(page.getByText("+4 / -1").first()).toBeVisible();

    // 2. Select the first available mock test via "Start Mock" link
    const startLink = page.getByRole("link", { name: "Start Mock" }).first();
    await expect(startLink).toBeVisible();
    await startLink.click();

    // 3. Instructions & Specifications Screen
    await expect(page).toHaveURL(/\/app\/mock-tests\/mock_/, { timeout: 10000 });
    await expect(page.getByText("Section Breakdown")).toBeVisible();
    await expect(page.getByText("Total Questions")).toBeVisible();
    await expect(page.getByText("Maximum Marks")).toBeVisible();
    await expect(page.getByText("Exam Simulation Instructions")).toBeVisible();

    // 4. Click Start Mock Test (scroll into view first, then click)
    const startTestBtn = page.getByRole("button", { name: /start mock test|resume mock test/i });
    await expect(startTestBtn).toBeVisible({ timeout: 10000 });
    await startTestBtn.scrollIntoViewIfNeeded();
    await startTestBtn.click();

    // 5. Exam Simulation Player
    await expect(page).toHaveURL(/\/app\/mock-tests\/mock_.*\/session\/sess_/, { timeout: 15000 });
    // Verify timer is displayed
    const timerElement = page.getByRole("timer");
    await expect(timerElement).toBeVisible();

    // Verify question counter visible in header
    await expect(page.getByText(/Q 1 of/i)).toBeVisible();

    // 6. Answer Question 1
    const radiosQ1 = page.getByRole("radio");
    await expect(radiosQ1.first()).toBeVisible();
    await radiosQ1.first().click();
    await expect(radiosQ1.first()).toHaveAttribute("aria-checked", "true");

    // 7. Mark Question 1 for review
    const markReviewBtn = page.getByRole("button", { name: /mark for review/i });
    await expect(markReviewBtn).toBeVisible();
    await markReviewBtn.click();
    await expect(page.getByRole("button", { name: /unmark review/i })).toBeVisible();

    // 8. Navigate to next question
    const nextBtnQ1 = page.getByRole("button", { name: "Next", exact: true });
    if (await nextBtnQ1.isEnabled()) {
      await nextBtnQ1.click();
      await expect(page.getByText(/Q 2 of/i)).toBeVisible();

      // Answer Question 2
      const radiosQ2 = page.getByRole("radio");
      await expect(radiosQ2.first()).toBeVisible();
      await radiosQ2.first().click();

      // Change answer: click second option
      if ((await radiosQ2.count()) >= 2) {
        await radiosQ2.nth(1).click();
        await expect(radiosQ2.nth(1)).toHaveAttribute("aria-checked", "true");
      }
    }

    // 9. Open Question Palette via bottom bar palette button
    const paletteBtn = page.getByRole("button", { name: /answered/i }).first();
    await expect(paletteBtn).toBeVisible();
    await paletteBtn.scrollIntoViewIfNeeded();
    await paletteBtn.click();

    const paletteDialog = page.getByRole("dialog");
    await expect(paletteDialog).toBeVisible();
    await expect(paletteDialog.getByText("Question Palette")).toBeVisible();

    // Jump to question 1 via palette (number button 1)
    const q1PaletteBtn = paletteDialog.getByRole("button", { name: "1" }).first();
    await q1PaletteBtn.click();

    // Palette closes; verify on Question 1
    await expect(page.getByText(/Q 1 of/i)).toBeVisible();

    // 10. Navigate to last question using Next loop
    await goToLastQuestion(page);

    // At last question: click header "Submit" button (always visible on desktop, sm:flex)
    // On mobile the footer "Review & Submit" button should be visible
    const submitBtn = page.getByRole("button", { name: /^Submit$/ }).first();
    const reviewSubmitBtn = page.getByRole("button", { name: /Review.*Submit/ }).first();

    const isSubmitVisible = await submitBtn.isVisible();
    const isReviewVisible = await reviewSubmitBtn.isVisible();

    if (isSubmitVisible) {
      await submitBtn.click();
    } else if (isReviewVisible) {
      await reviewSubmitBtn.scrollIntoViewIfNeeded();
      await reviewSubmitBtn.click();
    }

    const submitModal = page.getByRole("dialog");
    await expect(submitModal).toBeVisible({ timeout: 5000 });
    await expect(submitModal.getByRole("heading", { name: "Submit Mock Test?" })).toBeVisible();
    await expect(submitModal.getByText("Answered", { exact: true })).toBeVisible();

    // Cancel and return to test
    await submitModal.getByRole("button", { name: "Continue Test" }).click();
    await expect(submitModal).not.toBeVisible();

    // Re-open and confirm submit using header "Submit" button again
    if (isSubmitVisible) {
      await submitBtn.click();
    } else if (isReviewVisible) {
      await reviewSubmitBtn.scrollIntoViewIfNeeded();
      await reviewSubmitBtn.click();
    }
    await expect(submitModal).toBeVisible();
    await submitModal.getByRole("button", { name: "Submit Mock Test" }).click();

    // 11. Result and Evaluation Screen
    await expect(page).toHaveURL(/\/app\/mock-tests\/mock_.*\/session\/sess_.*\/result/, { timeout: 10000 });
    await expect(page.getByText(/Result Summary/)).toBeVisible();
    await expect(page.getByText("Final Raw Score")).toBeVisible();
    await expect(page.getByText("Section Performance")).toBeVisible();
    await expect(page.getByText("Question-by-Question Review")).toBeVisible();

    // Test filter pills
    const incorrectPill = page.getByRole("button", { name: /incorrect/i });
    if (await incorrectPill.isVisible()) {
      await incorrectPill.click();
    }

    // 12. Return to Mock Hub
    await page.getByRole("link", { name: "Mock Hub" }).first().click();
    await expect(page).toHaveURL(/\/app\/mock-tests/);
    await expect(page.getByText("Attempt History")).toBeVisible();
    await expect(page.getByText("Mocks Taken")).toBeVisible();
  });

  test("2. Session persistence across browser reload during active mock test", async ({
    page,
  }) => {
    await completeGuestSetup(page);

    // Navigate to a mock test
    await page.goto("/app/mock-tests");
    await expect(page.getByRole("heading", { name: "Mock Tests", exact: true })).toBeVisible();

    const startLink = page.getByRole("link", { name: "Start Mock" }).first();
    await expect(startLink).toBeVisible();
    await startLink.click();

    await expect(page).toHaveURL(/\/app\/mock-tests\/mock_/, { timeout: 10000 });
    const startTestBtn = page.getByRole("button", { name: /start mock test|resume mock test/i });
    await expect(startTestBtn).toBeVisible({ timeout: 10000 });
    await startTestBtn.scrollIntoViewIfNeeded();
    await startTestBtn.click();

    await expect(page).toHaveURL(/\/app\/mock-tests\/mock_.*\/session\/sess_/, { timeout: 15000 });
    await expect(page.getByRole("timer")).toBeVisible();

    // Answer Question 1
    const radios = page.getByRole("radio");
    await expect(radios.first()).toBeVisible();
    await radios.first().click();
    await expect(radios.first()).toHaveAttribute("aria-checked", "true");

    // Note current URL
    const sessionUrl = page.url();

    // Reload browser page
    await page.reload();
    await page.waitForURL(sessionUrl, { timeout: 10000 });

    // Verify still on session screen
    await expect(page.getByRole("timer")).toBeVisible();
    // Answer should be persisted (radio stays checked)
    await expect(radios.first()).toHaveAttribute("aria-checked", "true");
  });
});
