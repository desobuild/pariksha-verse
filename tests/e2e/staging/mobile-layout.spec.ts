import { test, expect, type Page } from "@playwright/test";
import {
  attachHealthCollector,
  completeGuestSetup,
  formatIssues,
  skipUnlessProject,
} from "./helpers";

/**
 * Phase 12 — Mobile (390×844) layout QA via Playwright emulation.
 *
 * NOTE: this complements — but does NOT replace — the physical Pixel 10 smoke
 * test. Touch targets, real scroll physics, safe-area insets, and IME behavior
 * can only be verified on hardware.
 *
 * The app shell design (src/app/app/layout.tsx): on mobile the document is
 * the single scroll container, and a spacer inside <main> guarantees the last
 * content can scroll clear of the fixed bottom nav. These tests encode that
 * contract.
 */

interface PageProbe {
  path: string;
  /** Text that must be visible and unobscured at the very bottom of the page. */
  requires?: RegExp;
  /** Whether the fixed mobile bottom nav is expected (app shell pages only). */
  expectBottomNav: boolean;
  setup?: "onboarded";
}

test.describe("Staging Mobile Layout (390x844)", () => {
  skipUnlessProject(/Mobile/);

  const MOBILE_VIEWPORT = { width: 390, height: 844 };

  async function expectNoHorizontalOverflow(page: Page, label: string) {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow, `${label}: horizontal overflow detected`).toBeLessThanOrEqual(1);
  }

  async function expectSingleScrollContainer(page: Page, label: string) {
    const nested = await page.evaluate(() => {
      const offenders: string[] = [];
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const style = window.getComputedStyle(el);
        const scrollableY =
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 4;
        if (scrollableY) {
          offenders.push(
            `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}`
          );
        }
      }
      return offenders;
    });
    expect(
      nested,
      `${label}: the document must be the single scroll container, found nested scrollers`
    ).toEqual([]);
  }

  async function scrollToAbsoluteBottom(page: Page) {
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    );
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            window.scrollY + window.innerHeight >=
            document.documentElement.scrollHeight - 2
        )
      )
      .toBe(true);
  }

  /**
   * The product contract: when scrolled to the very bottom, no page content
   * sits behind the fixed bottom nav (the spacer guarantees clearance).
   */
  async function expectContentClearOfBottomNav(page: Page, label: string) {
    const nav = page.getByRole("navigation", { name: "Mobile Bottom Navigation" });
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    expect(navBox, `${label}: bottom nav should have a bounding box`).toBeTruthy();

    const result = await page.evaluate((navTop) => {
      const main = document.querySelector("main");
      if (!main) return { ok: false, reason: "no <main>" };
      let maxContentBottom = -Infinity;
      let worst = "";
      for (const el of Array.from(main.querySelectorAll("*"))) {
        const rect = el.getBoundingClientRect();
        const hasOwnText = Array.from(el.childNodes).some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
        );
        if (rect.height > 0 && rect.width > 0 && hasOwnText) {
          if (rect.bottom > maxContentBottom) {
            maxContentBottom = rect.bottom;
            worst = (el.textContent ?? "").trim().slice(0, 60);
          }
        }
      }
      return { ok: maxContentBottom <= navTop + 2, maxContentBottom, navTop, worst };
    }, navBox!.y);

    expect(
      result.ok,
      `${label}: content "${result.worst}" (bottom=${result.maxContentBottom}) is hidden behind the bottom nav (top=${result.navTop})`
    ).toBe(true);
  }

  async function expectBottomNavUsable(page: Page) {
    const nav = page.getByRole("navigation", { name: "Mobile Bottom Navigation" });
    await nav.getByRole("link", { name: "More" }).click();
    await expect(page).toHaveURL(/\/app\/more/);
    await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
    await nav.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/app\/home/);
  }

  test("landing page: CTA discoverability and clean mobile layout", async ({ page }) => {
    const health = attachHealthCollector(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/");

    expect(page.viewportSize()).toEqual(MOBILE_VIEWPORT);

    // Continue CTA is discoverable without scrolling.
    const cta = page.getByRole("link", { name: /get started/i });
    await expect(cta).toBeVisible();
    const ctaBox = await cta.boundingBox();
    expect(ctaBox, "Get Started CTA should have a bounding box").toBeTruthy();
    expect(
      ctaBox!.y + ctaBox!.height,
      "Get Started CTA should be reachable in the initial viewport"
    ).toBeLessThanOrEqual(MOBILE_VIEWPORT.height);
    expect(ctaBox!.x, "CTA must not be clipped on the left").toBeGreaterThanOrEqual(0);
    expect(
      ctaBox!.x + ctaBox!.width,
      "CTA must not be clipped on the right"
    ).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);

    await expectNoHorizontalOverflow(page, "landing");
    await expectSingleScrollContainer(page, "landing");
    // Public marketing/auth pages have no app-shell bottom nav.
    await expect(page.getByRole("navigation", { name: "Mobile Bottom Navigation" })).toHaveCount(0);

    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });

  test("exam selection: no overflow, CTA visible", async ({ page }) => {
    const health = attachHealthCollector(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/exam/select");
    await expect(page.getByRole("heading", { name: "Choose Your Exam" })).toBeVisible();
    await expect(page.getByText("NEET").first()).toBeVisible();

    const continueBtn = page.getByRole("button", { name: /select an exam to continue/i });
    await expect(continueBtn).toBeVisible();

    await expectNoHorizontalOverflow(page, "exam select");
    await expectSingleScrollContainer(page, "exam select");

    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });

  test("auth page: Continue CTA and staging disclaimer fully visible", async ({ page }) => {
    const health = attachHealthCollector(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/auth/sign-in");

    // The staging demo panel carries the disclaimer; if demo auth is disabled
    // on this deployment the email form renders instead (release blocker
    // tracked separately) — layout checks still apply to whatever renders.
    const demoPanelVisible = await page.getByText("Pick a demo profile").isVisible();
    const cta = demoPanelVisible
      ? page.getByRole("button", { name: /continue to parikshaverse/i })
      : page.getByRole("button", { name: /continue as guest/i });
    await expect(cta).toBeVisible();
    const ctaBox = await cta.boundingBox();
    expect(ctaBox, "Continue CTA should have a bounding box").toBeTruthy();
    expect(ctaBox!.y, "Continue CTA should be in the initial viewport").toBeLessThan(
      MOBILE_VIEWPORT.height
    );
    expect(
      ctaBox!.x + ctaBox!.width,
      "Continue CTA must not be clipped"
    ).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);

    if (demoPanelVisible) {
      // Disclaimer visible, not clipped.
      const disclaimer = page.getByText(/staging preview for evaluation only/i);
      await expect(disclaimer).toBeVisible();
      const disclaimerBox = await disclaimer.boundingBox();
      expect(disclaimerBox, "disclaimer should have a bounding box").toBeTruthy();
      expect(
        disclaimerBox!.x + disclaimerBox!.width,
        "disclaimer must not be clipped horizontally"
      ).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
      // The full disclaimer must be reachable — scroll it into view.
      await disclaimer.scrollIntoViewIfNeeded();
      await expect(disclaimer).toBeInViewport();
    } else {
      // Guest note on the email form variant.
      await expect(page.getByText(/guest mode stores all syllabus/i)).toBeVisible();
    }

    await expectNoHorizontalOverflow(page, "auth sign-in");
    await expectSingleScrollContainer(page, "auth sign-in");

    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });

  for (const probe of [
    { path: "/app/home", requires: /study activity will appear here|recent activity/i, expectBottomNav: true, setup: "onboarded" },
    { path: "/app/study", requires: /experimental skills/i, expectBottomNav: true, setup: "onboarded" },
    { path: "/app/progress", requires: /topics covered/i, expectBottomNav: true, setup: "onboarded" },
    { path: "/app/resources", expectBottomNav: true, setup: "onboarded" },
    { path: "/app/more", requires: /sign in to sync/i, expectBottomNav: true, setup: "onboarded" },
  ] as PageProbe[]) {
    test(`app page ${probe.path}: bottom content clears the nav, no overflow`, async ({
      page,
    }) => {
      const health = attachHealthCollector(page);
      await page.setViewportSize(MOBILE_VIEWPORT);
      await completeGuestSetup(page);

      await page.goto(probe.path);
      await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
      await page.waitForLoadState("networkidle").catch(() => {});

      if (probe.requires) {
        await expect(page.getByText(probe.requires).first()).toBeVisible();
      }

      // Record the initial viewport.
      expect(page.viewportSize()).toEqual(MOBILE_VIEWPORT);

      // Scroll to the actual bottom.
      await scrollToAbsoluteBottom(page);

      // The final visible content must not be hidden behind the bottom nav.
      await expectContentClearOfBottomNav(page, probe.path);

      // The bottom nav remains visible and usable from the scrolled state.
      await expectBottomNavUsable(page);

      await expectNoHorizontalOverflow(page, probe.path);
      await expectSingleScrollContainer(page, probe.path);

      expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
    });
  }

  test("active practice session hides the bottom nav by design", async ({ page }) => {
    const health = attachHealthCollector(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await completeGuestSetup(page);

    await page.goto("/app/practice");
    await page.getByRole("button", { name: "Practice Questions" }).click();
    await page.getByRole("button", { name: /Mixed \(All\)/i }).click();
    await page.getByRole("button", { name: "5 Questions" }).click();
    await page.getByRole("button", { name: "Start Practice Session" }).click();
    await expect(page).toHaveURL(/\/app\/practice\/session\/q_sess_/, { timeout: 20_000 });

    // Focused session mode: no bottom nav, and no horizontal overflow.
    await expect(page.getByRole("navigation", { name: "Mobile Bottom Navigation" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page, "practice session");
    await expectSingleScrollContainer(page, "practice session");

    expect(health.stop(), `Unexpected issues:\n${formatIssues(health.issues)}`).toEqual([]);
  });
});
