import { test, expect, type Page } from "@playwright/test";

test.describe("Phase 10: Question Bank & Practice Engine E2E", () => {
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

  const T_VECTORS = "exam_neet_physics_kinematics_vectors-and-scalars";

  test("1. End-to-end question session journey: start, answer, navigate, review, submit, results, answer review", async ({
    page,
  }) => {
    await completeGuestSetup(page);

    // 1. Open Practice Hub
    await page.goto("/app/practice");
    await expect(page.getByRole("heading", { name: "Practice & Performance" })).toBeVisible();

    // 2. Click "Practice Questions" to open StartPracticeDialog
    await page.getByRole("button", { name: "Practice Questions" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Start Question Practice")).toBeVisible();

    // 3. Configure scope: Topic Practice -> Physics -> Kinematics -> Vectors & Scalars
    // Select Physics subject
    await page.locator("#topic-subject-select").selectOption("physics");
    // Select Kinematics chapter
    await page.locator("#topic-chapter-select").selectOption("exam_neet_physics_kinematics");
    // Select Vectors & Scalars topic
    await page.locator("#topic-topic-select").selectOption(T_VECTORS);

    // Select 5 questions
    await page.getByRole("button", { name: "5 Questions" }).click();

    // 4. Start Session
    await page.getByRole("button", { name: "Start Practice Session" }).click();

    // 5. Verify Player loaded
    await expect(page).toHaveURL(/\/app\/practice\/session\/q_sess_/);
    await expect(page.getByText(/Question 1 of 5/i)).toBeVisible();

    // 6. Answer Question 1
    const radiosQ1 = page.getByRole("radio");
    await expect(radiosQ1.first()).toBeVisible();
    await radiosQ1.first().click();

    // Navigate to Question 2 via exact Next button
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText(/Question 2 of 5/i)).toBeVisible();

    // Change answer test: select first, then switch to second
    const radiosQ2 = page.getByRole("radio");
    await radiosQ2.first().click();
    if ((await radiosQ2.count()) >= 2) {
      await radiosQ2.nth(1).click();
      await expect(radiosQ2.nth(1)).toHaveAttribute("aria-checked", "true");
    }

    // Navigate to Question 3 via exact Next button
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText(/Question 3 of 5/i)).toBeVisible();

    // Answer Question 3
    const radiosQ3 = page.getByRole("radio");
    await radiosQ3.first().click();

    // Leave Question 4 and 5 unanswered, go to Review dialog
    await page.getByRole("button", { name: "Review practice session" }).first().click();
    const reviewDialog = page.getByRole("dialog");
    await expect(reviewDialog).toBeVisible();
    await expect(page.getByText("Practice Session Review")).toBeVisible();
    await expect(reviewDialog.getByText("Answered", { exact: true })).toBeVisible();
    await expect(reviewDialog.getByText("Unanswered", { exact: true })).toBeVisible();
    await expect(reviewDialog.getByText(/You have 2 unanswered questions/i)).toBeVisible();

    // 7. Submit session
    await page.getByRole("button", { name: "Submit Practice" }).click();

    // 8. Result page loads
    await expect(page).toHaveURL(/\/app\/practice\/session\/q_sess_.*\/result/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Practice Session Summary" })).toBeVisible();

    // Check key score cards
    await expect(page.getByText("Accuracy", { exact: true })).toBeVisible();
    await expect(page.getByText("Duration", { exact: true })).toBeVisible();
    await expect(page.getByText("/ 5", { exact: true })).toBeVisible();

    // Check Question-by-Question Review list
    await expect(page.getByRole("heading", { name: "Question-by-Question Review" })).toBeVisible();
    await expect(page.getByText("All (5)")).toBeVisible();

    // 9. Navigate back to Practice Hub and verify session logged in Recent Practice
    await page.getByRole("link", { name: "Practice Hub" }).click();
    await expect(page).toHaveURL("/app/practice");
    const recentRegion = page.getByRole("region", { name: "Recent Practice" });
    await expect(recentRegion.getByText(/3 questions/i)).toBeVisible();
  });

  test("2. Topic detail page launches question practice session directly", async ({ page }) => {
    await completeGuestSetup(page);

    // Open Topic Detail
    await page.goto(`/app/study/${T_VECTORS}`);
    await expect(page.getByRole("heading", { name: "Practice Performance" })).toBeVisible();

    // Click "Practice Questions"
    const practiceQuestionsLink = page.getByRole("link", { name: "Practice Questions" });
    await expect(practiceQuestionsLink).toBeVisible();
    await practiceQuestionsLink.click();

    // Should navigate to /app/practice?topicId=...&mode=questions and open StartPracticeDialog with topic pre-selected
    await expect(page).toHaveURL(new RegExp(`/app/practice\\?topicId=${T_VECTORS}&mode=questions`));
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Start Question Practice")).toBeVisible();

    // Start practice directly
    await page.getByRole("button", { name: "Start Practice Session" }).click();
    await expect(page).toHaveURL(/\/app\/practice\/session\/q_sess_/);
    await expect(page.getByText(/Question 1 of/i)).toBeVisible();
  });

  test("3. Safe exit dialog prevents accidental abandonment", async ({ page }) => {
    await completeGuestSetup(page);

    // Start a mixed session
    await page.goto("/app/practice");
    await page.getByRole("button", { name: "Practice Questions" }).click();
    await page.getByRole("button", { name: /Mixed \(All\)/i }).click();
    await page.getByRole("button", { name: "5 Questions" }).click();
    await page.getByRole("button", { name: "Start Practice Session" }).click();
    await expect(page).toHaveURL(/\/app\/practice\/session\/q_sess_/);

    // Click Exit button
    await page.getByRole("button", { name: "Exit" }).click();
    await expect(page.getByText("Exit Practice Session?")).toBeVisible();

    // Cancel exit
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByText("Exit Practice Session?")).not.toBeVisible();
    await expect(page).toHaveURL(/\/app\/practice\/session\/q_sess_/);

    // Click Exit and Confirm
    await page.getByRole("button", { name: "Exit" }).click();
    await page.getByRole("button", { name: "Exit Practice" }).click();
    await expect(page).toHaveURL("/app/practice");
  });

  const REQUIRED_VIEWPORTS = [
    { width: 375, height: 667, name: "375px (Compact Mobile)" },
    { width: 390, height: 844, name: "390px (Standard Mobile)" },
    { width: 430, height: 932, name: "430px (Large Mobile)" },
    { width: 768, height: 1024, name: "768px (Tablet)" },
    { width: 1280, height: 800, name: "1280px (Desktop)" },
    { width: 1440, height: 900, name: "1440px (Wide Desktop)" },
  ];

  for (const vp of REQUIRED_VIEWPORTS) {
    test(`4. Responsive layout has no horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await completeGuestSetup(page);

      await page.goto("/app/practice");
      const practiceBody = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= document.documentElement.clientWidth;
      });
      expect(practiceBody).toBe(true);
    });
  }
});
