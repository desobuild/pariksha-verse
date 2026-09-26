/**
 * Phase 12 responsive QA capture.
 *
 * Boots a headless Chromium, completes guest onboarding once, seeds the
 * deterministic analytics fixtures, then screenshots /app/progress at every
 * breakpoint required by the phase spec (plus the empty state at 375px).
 *
 * Usage: node scripts/capture-analytics-qa.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = "test-results/qa-screenshots";

const T_UNITS = "exam_neet_physics_physics-and-measurement_units-and-measurements";
const T_MOTION = "exam_neet_physics_kinematics_motion-in-straight-line";
const T_MOLE = "exam_neet_chemistry_basic-concepts-of-chemistry_matter-and-mole-concept";

async function seedAnalyticsFixtures(page) {
  await page.evaluate(async ([units, motion, mole]) => {
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
        const tx = db.transaction("keyvalue", "readonly");
        const req = tx.objectStore("keyvalue").get(key);
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
    const workspaces = (await read(db, "pv:guest:workspaces")) ?? [];
    const ws = workspaces.find((w) => w.isActive) ?? workspaces[0];
    if (!ws) throw new Error("No guest workspace found");
    const wsId = ws.id;
    const day = (offset, hour = 10) => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, 0, 0, 0).toISOString();
    };

    const progressRow = (topicId, status, extra) => ({
      id: `prog_qa_${topicId}`,
      workspaceId: wsId,
      topicId,
      status,
      startedAt: day(-6),
      learnedAt: null,
      practicedAt: null,
      revisedAt: null,
      masteredAt: null,
      practiceAttempts: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      accuracy: 0,
      lastStudiedAt: day(-1),
      lastRevisedAt: null,
      nextRevisionAt: null,
      notes: null,
      createdAt: day(-6),
      updatedAt: day(-1),
      ...extra,
    });

    await write(db, "pv:guest:topic_progress", [
      progressRow(units, "practiced", {
        practicedAt: day(-1),
        practiceAttempts: 20,
        correctAnswers: 8,
        incorrectAnswers: 12,
        accuracy: 4000,
      }),
      progressRow(motion, "learned", { learnedAt: day(-2) }),
      progressRow(mole, "revised", {
        lastRevisedAt: day(-1, 11),
        revisedAt: day(-1, 11),
        nextRevisionAt: day(3, 8),
      }),
    ]);

    await write(db, "pv:guest:practice_sessions", [
      { id: "prac_qa_units", workspaceId: wsId, topicId: units, questionCount: 20, correct: 8, incorrect: 12, unattempted: 0, durationMinutes: 15, completedAt: day(-1, 12), createdAt: day(-1, 12), updatedAt: day(-1, 12) },
      { id: "prac_qa_motion", workspaceId: wsId, topicId: motion, questionCount: 10, correct: 10, incorrect: 0, unattempted: 0, durationMinutes: 8, completedAt: day(-2, 15), createdAt: day(-2, 15), updatedAt: day(-2, 15) },
      { id: "prac_qa_old", workspaceId: wsId, topicId: mole, questionCount: 10, correct: 3, incorrect: 7, unattempted: 0, durationMinutes: 12, completedAt: day(-20, 15), createdAt: day(-20, 15), updatedAt: day(-20, 15) },
    ]);

    await write(db, "pv:guest:study_sessions", [
      { id: "study_qa_1", workspaceId: wsId, plannerTaskId: null, topicId: units, startedAt: day(-1, 9), endedAt: day(-1, 10), durationMinutes: 60, sessionType: "focused", createdAt: day(-1, 9), updatedAt: day(-1, 10) },
      { id: "study_qa_2", workspaceId: wsId, plannerTaskId: null, topicId: motion, startedAt: day(0, 9), endedAt: day(0, 10), durationMinutes: 30, sessionType: "focused", createdAt: day(0, 9), updatedAt: day(0, 10) },
    ]);

    await write(db, "pv:guest:revision_items", [
      { id: "rev_qa_units", workspaceId: wsId, topicId: units, revisionNumber: 2, lastRevisedAt: day(-8), nextRevisionAt: day(-1, 8), status: "scheduled", createdAt: day(-8), updatedAt: day(-1, 8) },
      { id: "rev_qa_mole", workspaceId: wsId, topicId: mole, revisionNumber: 2, lastRevisedAt: day(-1, 11), nextRevisionAt: day(3, 8), status: "scheduled", createdAt: day(-8), updatedAt: day(-1, 11) },
    ]);

    const mockResult = (id, title, rawScore, totalMarks, accuracyBps, completedAt) => ({
      id,
      mockTestId: `mock_${id}`,
      sessionId: `msess_${id}`,
      workspaceId: wsId,
      mockTitle: title,
      rawScore,
      totalMarks,
      totalQuestions: 20,
      attempted: 15,
      correct: 12,
      incorrect: 3,
      unattempted: 5,
      markedForReviewCount: 1,
      accuracy: accuracyBps,
      accuracyPct: Math.round(accuracyBps / 100),
      timeSpentSeconds: 5400,
      submissionStatus: "completed",
      completedAt,
      notes: null,
      sections: [
        { sectionId: "sec_physics", name: "Physics", totalQuestions: 10, attempted: 8, correct: 6, incorrect: 2, unanswered: 2, rawScore: 22, maxScore: 40, accuracyBps: 7500, accuracyPct: 75 },
      ],
      questions: [],
    });

    await write(db, "pv:guest:mock_test_results", [
      mockResult("res_qa_1", "NEET Full Mock 01", 300, 720, 7000, day(-12)),
      mockResult("res_qa_2", "NEET Full Mock 02", 240, 600, 8000, day(-1, 14)),
    ]);
  }, [T_UNITS, T_MOTION, T_MOLE]);
}

async function completeGuestSetup(page) {
  await page.goto(`${BASE_URL}/exam/select`);
  await page.getByRole("radio", { name: /neet/i }).click();
  await page.getByRole("button", { name: /continue with neet 2027/i }).click();
  await page.getByRole("radio", { name: "1 hr" }).click();
  await page.getByRole("radio", { name: /just starting/i }).click();
  await page.getByRole("button", { name: /create my preparation space/i }).click();
  await page.waitForURL(/\/app\/home/, { timeout: 30000 });
}

const WIDTHS = [375, 390, 430, 768, 1280, 1440];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

await completeGuestSetup(page);

// Empty state at 375px first (no seeded data yet).
await page.setViewportSize({ width: 375, height: 2400 });
await page.goto(`${BASE_URL}/app/progress`);
await page.getByRole("heading", { name: "Progress", exact: true }).waitFor({ timeout: 30000 });
await page.waitForTimeout(800);
mkdirSync(OUT_DIR, { recursive: true });
await page.screenshot({ path: `${OUT_DIR}/progress-empty-375.png`, fullPage: true });
console.log("captured progress-empty-375.png");

await seedAnalyticsFixtures(page);

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: Math.round((width / 375) * 1200) });
  await page.goto(`${BASE_URL}/app/progress`);
  await page.getByRole("heading", { name: "Progress", exact: true }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/progress-${width}.png`, fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  console.log(`captured progress-${width}.png (horizontal overflow: ${overflow})`);
}

await browser.close();
console.log("done");
