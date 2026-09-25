/* Phase 8 visual QA capture — revision queue + topic detail revision states. */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "test-results", "visual-qa-phase8");

const VIEWPORTS = [
  { name: "375", width: 375, height: 667 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

const T_DUE = "exam_neet_physics_physics-and-measurement_units-and-measurements";
const T_OVERDUE = "exam_neet_physics_kinematics_motion-in-straight-line";
const T_UPCOMING = "exam_neet_chemistry_basic-concepts-of-chemistry_matter-and-mole-concept";
const T_RECENT = "exam_neet_biology_diversity-in-living-world_living-world-and-taxonomy";

async function onboard(page) {
  await page.goto(`${BASE}/exam/select`);
  await page.getByRole("radio", { name: /neet/i }).click();
  await page.getByRole("button", { name: /continue with neet 2027/i }).click();
  await page.getByRole("radio", { name: "1 hr" }).click();
  await page.getByRole("radio", { name: /just starting/i }).click();
  await page.getByRole("button", { name: /create my preparation space/i }).click();
  await page.waitForURL(/\/app\/home/, { timeout: 20000 });
}

async function seed(page) {
  await page.evaluate(
    async ([due, overdue, upcoming, recent]) => {
      const openDb = () =>
        new Promise((resolve, reject) => {
          const req = window.indexedDB.open("pariksha_verse_db", 1);
          req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains("keyvalue")) {
              req.result.createObjectStore("keyvalue");
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      const read = (db, key) =>
        new Promise((resolve) => {
          const req = db.transaction("keyvalue", "readonly").objectStore("keyvalue").get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        });
      const write = (db, key, value) =>
        new Promise((resolve) => {
          const tx = db.transaction("keyvalue", "readwrite");
          tx.objectStore("keyvalue").put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });

      const db = await openDb();
      const workspaces = (await read(db, "pv:guest:workspaces")) || [];
      const ws = workspaces.find((w) => w.isActive) || workspaces[0];
      const now = new Date();
      const at = (dayOffset, hour) =>
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, 0, 0, 0).toISOString();
      const row = (topicId, status, extra) => ({
        id: `prog_vq_${topicId}`,
        workspaceId: ws.id,
        topicId,
        status,
        startedAt: at(-5, 10),
        learnedAt: at(-5, 10),
        practicedAt: null,
        revisedAt: null,
        masteredAt: null,
        practiceAttempts: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        accuracy: 0,
        lastStudiedAt: at(-1, 10),
        lastRevisedAt: null,
        nextRevisionAt: null,
        notes: null,
        createdAt: at(-5, 10),
        updatedAt: at(-1, 10),
        ...extra,
      });
      await write(db, "pv:guest:topic_progress", [
        row(due, "learned", { nextRevisionAt: at(0, 9) }),
        row(overdue, "learned", { nextRevisionAt: at(-3, 9) }),
        row(upcoming, "learned", { nextRevisionAt: at(1, 8) }),
        row(recent, "revised", { lastRevisedAt: at(0, 10), revisedAt: at(0, 10), nextRevisionAt: at(4, 8) }),
      ]);
    },
    [T_DUE, T_OVERDUE, T_UPCOMING, T_RECENT]
  );
}

function section(page, title) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let overflowFailures = 0;

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await onboard(page);
    await seed(page);

    // Full seeded queue
    await page.goto(`${BASE}/app/revision`);
    await page.getByRole("heading", { name: "Revision", exact: true }).waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `revision-seeded-${vp.name}.png`), fullPage: true });

    // Overdue filter + subject filter combined
    await page.getByRole("tab", { name: "Overdue" }).click();
    await page.getByRole("combobox", { name: "Filter by subject" }).click();
    await page.getByRole("option", { name: "Physics" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `revision-filtered-${vp.name}.png`) });

    // Topic detail with due revision + Mark as Revised action
    await page.goto(`${BASE}/app/revision`);
    await section(page, "Due Today").getByRole("link", { name: /review topic/i }).click();
    await page.waitForURL(/\/app\/study\//, { timeout: 20000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `topic-detail-due-${vp.name}.png`), fullPage: true });

    // Overflow check
    await page.goto(`${BASE}/app/revision`);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    if (overflow) {
      overflowFailures++;
      console.error(`HORIZONTAL OVERFLOW at ${vp.width}x${vp.height}`);
    }

    await context.close();
  }

  // Empty state pass (fresh guest) at one mobile + one desktop viewport
  for (const vp of [VIEWPORTS[0], VIEWPORTS[4]]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await onboard(page);
    await page.goto(`${BASE}/app/revision`);
    await page.getByRole("heading", { name: "Revision", exact: true }).waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `revision-empty-${vp.name}.png`), fullPage: true });
    await context.close();
  }

  // Dark mode pass (seeded) on one mobile + one desktop viewport
  for (const vp of [VIEWPORTS[1], VIEWPORTS[5]]) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: "dark",
    });
    await context.addInitScript(() => localStorage.setItem("theme", "dark"));
    const page = await context.newPage();
    await onboard(page);
    await seed(page);
    await page.goto(`${BASE}/app/revision`);
    await page.getByRole("heading", { name: "Revision", exact: true }).waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `revision-dark-${vp.name}.png`), fullPage: true });
    await context.close();
  }

  await browser.close();
  console.log(`Visual QA captures written to ${OUT}`);
  console.log(`Overflow failures: ${overflowFailures}`);
  if (overflowFailures > 0) process.exit(1);
}

run().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
