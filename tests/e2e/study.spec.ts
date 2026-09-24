import { test, expect, type Page } from "@playwright/test";

test.describe("Phase 7 Study Module & Syllabus Navigator E2E", () => {
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

  async function openStudy(page: Page) {
    await completeGuestSetup(page);
    await page.goto("/app/study");
    await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible();
  }

  // Topic rows live inside expanded chapter lists; scoping avoids collisions
  // with the "Suggested next" card, which links to the same first topic.
  function topicRowLink(page: Page) {
    return page
      .locator("ul[id^='chapter-topics-']")
      .getByRole("link", { name: /units of measurement, si units & derived units/i });
  }

  test("1. Guest can open Study and see the syllabus overview", async ({ page }) => {
    await openStudy(page);

    await expect(page.getByText("NEET 2027").first()).toBeVisible();
    // Canonical Phase 2 taxonomy surfaced with real workspace progress
    await expect(page.getByText(/139 topics/)).toBeVisible();
    await expect(page.getByText(/139 remaining/)).toBeVisible();
    await expect(
      page.getByText(/start studying a topic to begin tracking your progress/i)
    ).toBeVisible();
  });

  test("2. Subject navigation switches Physics / Chemistry / Biology with shareable URLs", async ({ page }) => {
    await openStudy(page);

    // Physics is the default active subject
    await expect(page.getByRole("tab", { name: /physics/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.getByRole("tab", { name: /chemistry/i }).click();
    await expect(page).toHaveURL(/\/app\/study\?subject=chemistry/);
    await expect(page.getByRole("tab", { name: /chemistry/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText(/40 topics/i).first()).toBeVisible();

    await page.getByRole("tab", { name: /biology/i }).click();
    await expect(page).toHaveURL(/\/app\/study\?subject=biology/);
    await expect(page.getByText("Human Reproduction")).toBeVisible();

    // URL is shareable/bookmarkable: direct load restores the subject
    await page.goto("/app/study?subject=chemistry");
    await expect(page.getByRole("tab", { name: /chemistry/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("3. Chapter list renders with progress for every chapter", async ({ page }) => {
    await openStudy(page);

    await expect(page.getByRole("button", { name: /physics and measurement/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /current electricity/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /experimental skills/i })).toBeVisible();

    // Untouched chapters show zero progress with derived status
    await expect(page.getByText("0 / 3 topics").first()).toBeVisible();
    await expect(page.getByText("Not Started").first()).toBeVisible();
  });

  test("4. Chapter expands via an accessible disclosure control", async ({ page }) => {
    await openStudy(page);

    const chapterButton = page.getByRole("button", { name: /physics and measurement/i });
    await expect(chapterButton).toHaveAttribute("aria-expanded", "false");
    await chapterButton.click();
    await expect(chapterButton).toHaveAttribute("aria-expanded", "true");
  });

  test("5. Topics render inside the expanded chapter", async ({ page }) => {
    await openStudy(page);

    await page.getByRole("button", { name: /physics and measurement/i }).click();
    await expect(
      page.getByRole("link", { name: /units of measurement, si units & derived units/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /least count, significant figures/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /dimensions of physical quantities/i }).first()
    ).toBeVisible();
  });

  test("6. Topic status displays on syllabus rows", async ({ page }) => {
    await openStudy(page);

    await page.getByRole("button", { name: /physics and measurement/i }).click();
    const topicLink = topicRowLink(page);
    await expect(topicLink).toBeVisible();
    await expect(topicLink.getByText("Not Started")).toBeVisible();
  });

  test("7. Topic status can be changed and persists for guests", async ({ page }) => {
    await openStudy(page);

    await page.getByRole("button", { name: /physics and measurement/i }).click();
    await topicRowLink(page).click();
    await expect(page).toHaveURL(/\/app\/study\/exam_neet_physics/);

    // Open the compact status control and pick "Learned"
    await page.getByRole("button", { name: /change status/i }).click();
    await page.getByRole("menuitemradio", { name: /^learned/i }).click();

    // UI updates immediately
    await expect(page.getByText("Learned").first()).toBeVisible();

    // Persists through IndexedDB across reloads
    await page.reload();
    await expect(page.getByText("Learned").first()).toBeVisible();
  });

  test("8. Search narrows the syllabus and clear restores it", async ({ page }) => {
    await openStudy(page);

    const search = page.getByRole("searchbox", { name: /search physics syllabus/i });
    await search.fill("current");

    // Matching chapter stays, non-matching chapters disappear
    await expect(page.getByRole("button", { name: /current electricity/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /physics and measurement/i })).not.toBeVisible();

    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(page.getByRole("button", { name: /physics and measurement/i })).toBeVisible();

    // Empty search results show a friendly empty state
    await search.fill("zzzznope");
    await expect(page.getByText(/no topics match your search/i)).toBeVisible();
  });

  test("9. Status filters narrow visible topics", async ({ page }) => {
    await openStudy(page);

    // Mark the first topic of the first chapter as Learned
    await page.getByRole("button", { name: /physics and measurement/i }).click();
    await topicRowLink(page).click();
    await page.getByRole("button", { name: /change status/i }).click();
    await page.getByRole("menuitemradio", { name: /^learned/i }).click();
    await expect(page.getByText("Learned").first()).toBeVisible();

    // Back on the syllabus, the Learned filter shows exactly that topic
    await page.goto("/app/study?subject=physics");
    await page.getByRole("button", { name: /^learned/i }).click();
    await expect(page.getByRole("button", { name: /physics and measurement/i })).toBeVisible();
    await expect(topicRowLink(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /current electricity/i })).not.toBeVisible();

    // Combined search + filter keeps only matching learned topics
    await page.getByRole("searchbox", { name: /search physics syllabus/i }).fill("dimensions");
    await expect(page.getByText(/no topics match your search/i)).toBeVisible();
  });

  test("10. Topic detail opens with full context", async ({ page }) => {
    await openStudy(page);

    await page.getByRole("button", { name: /physics and measurement/i }).click();
    await topicRowLink(page).click();

    await expect(page).toHaveURL(/\/app\/study\/exam_neet_physics_physics-and-measurement/);
    await expect(
      page.getByRole("heading", { name: /units of measurement, si units & derived units/i })
    ).toBeVisible();
    await expect(page.getByText("Physics · Physics and Measurement").first()).toBeVisible();

    // Empty activity states use calm copy
    await expect(page.getByText(/no study sessions recorded yet/i)).toBeVisible();
    await expect(page.getByText(/no revision scheduled yet/i)).toBeVisible();
    await expect(page.getByText(/no practice attempts yet/i)).toBeVisible();

    // Back navigation returns to the subject syllabus
    await page.getByRole("link", { name: /back to physics/i }).click();
    await expect(page).toHaveURL(/\/app\/study\?subject=physics/);
  });

  test("11. Study session can be recorded (live timer and manual entry)", async ({ page }) => {
    await openStudy(page);

    await page.getByRole("button", { name: /physics and measurement/i }).click();
    await topicRowLink(page).click();

    // Live timer flow
    await page.getByRole("button", { name: /start study session/i }).click();
    await expect(page.getByLabel(/elapsed time/i)).toBeVisible();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /finish session/i }).click();
    await expect(page.getByText("Today").first()).toBeVisible();
    await expect(page.getByText("1 min").first()).toBeVisible();

    // Manual duration fallback. Around local midnight the back-dated manual
    // session lands on yesterday, so accept either grouping.
    await page.getByRole("button", { name: /log time manually/i }).click();
    await page.getByRole("spinbutton", { name: /duration in minutes/i }).fill("15");
    await page.getByRole("button", { name: /save session/i }).click();
    await expect(page.getByText(/15 min|16 min/).first()).toBeVisible();
  });

  test("12. Dashboard Study action navigates into the Study module", async ({ page }) => {
    await completeGuestSetup(page);

    // Fresh workspace: Today's Focus recommends the next untouched topic
    const startStudying = page.getByRole("link", { name: /start studying/i });
    await expect(startStudying).toBeVisible();
    await startStudying.click();
    await expect(page).toHaveURL(/\/app\/study\/exam_neet_/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: /units of measurement, si units & derived units/i })
    ).toBeVisible();
  });

  test("13. No horizontal overflow across responsive viewports", async ({ page }) => {
    await openStudy(page);

    await page.getByRole("button", { name: /physics and measurement/i }).click();

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
      await page.waitForTimeout(100);
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(
        hasHorizontalScroll,
        `Detected horizontal overflow at viewport ${vp.width}x${vp.height}`
      ).toBe(false);
    }
  });
});
