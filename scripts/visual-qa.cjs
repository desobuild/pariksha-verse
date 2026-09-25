/* Phase 7 visual QA capture — scratch script, not part of any test suite. */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "test-results", "visual-qa");

const VIEWPORTS = [
  { name: "375", width: 375, height: 667 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

async function onboard(page) {
  await page.goto(`${BASE}/exam/select`);
  await page.getByRole("radio", { name: /neet/i }).click();
  await page.getByRole("button", { name: /continue with neet 2027/i }).click();
  await page.getByRole("radio", { name: "1 hr" }).click();
  await page.getByRole("radio", { name: /just starting/i }).click();
  await page.getByRole("button", { name: /create my preparation space/i }).click();
  await page.waitForURL(/\/app\/home/, { timeout: 20000 });
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await onboard(page);

    await page.goto(`${BASE}/app/study`);
    await page.getByRole("heading", { name: "Study", exact: true }).waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `study-${vp.name}.png`), fullPage: false });

    // Expanded chapter state
    await page.getByRole("button", { name: /physics and measurement/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `study-expanded-${vp.name}.png`) });

    // Search + filter active
    await page.getByRole("searchbox", { name: /search physics syllabus/i }).fill("current");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `study-search-${vp.name}.png`) });
    await page.getByRole("button", { name: "Clear search" }).click();

    // Topic detail
    await page
      .locator("ul[id^='chapter-topics-']")
      .getByRole("link", { name: /units of measurement/i })
      .first()
      .click();
    await page.getByRole("heading", { name: /units of measurement/i }).waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `topic-detail-${vp.name}.png`), fullPage: true });

    await context.close();
  }

  // Dark mode pass on one mobile + one desktop viewport
  for (const vp of [VIEWPORTS[1], VIEWPORTS[5]]) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: "dark",
    });
    await context.addInitScript(() => localStorage.setItem("theme", "dark"));
    const page = await context.newPage();
    await onboard(page);
    await page.goto(`${BASE}/app/study`);
    await page.getByRole("heading", { name: "Study", exact: true }).waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `study-dark-${vp.name}.png`) });
    await context.close();
  }

  await browser.close();
  console.log(`Saved screenshots to ${OUT}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
