// Phase 5 visual QA: onboarding flow screenshots at the required widths.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "design", "qa-phase5");
mkdirSync(outDir, { recursive: true });

const BASE = "http://localhost:3000";
const widths = [
  { label: "375x812", w: 375, h: 812 },
  { label: "390x844", w: 390, h: 844 },
  { label: "430x932", w: 430, h: 932 },
  { label: "1280", w: 1280, h: 900 },
  { label: "1440", w: 1440, h: 1000 },
];

const browser = await chromium.launch();
let issues = 0;

for (const vp of widths) {
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await context.newPage();

  const snap = async (name, fullPage = true) => {
    await page.waitForTimeout(350);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (overflow > 1) {
      console.log(`!! overflow ${overflow}px on ${name} @ ${vp.label}`);
      issues++;
    }
    await page.screenshot({ path: join(outDir, `${name}--${vp.label}.png`), fullPage });
  };

  // Landing
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await snap("landing");

  // Exam select (fresh)
  await page.goto(BASE + "/exam/select", { waitUntil: "networkidle" });
  await snap("exam-select");

  // Choose NEET -> attempt section appears
  await page.getByRole("radio", { name: /neet/i }).click();
  await snap("exam-select-attempt");

  // Continue -> personalize
  await page.getByRole("button", { name: /continue with neet 2027/i }).click();
  await page.waitForURL(/personalize/);
  await snap("personalize");

  // Fill personalization
  await page.getByRole("radio", { name: "2 hrs" }).click();
  await page.getByRole("radio", { name: /building fundamentals/i }).click();
  await snap("personalize-filled");

  // Submit -> home
  await page.getByRole("button", { name: /create my preparation space/i }).click();
  await page.waitForURL(/app\/home/, { timeout: 20000 });
  await snap("home");

  await context.close();
  console.log(`done ${vp.label}`);
}

await browser.close();
console.log(issues === 0 ? "NO OVERFLOW ISSUES" : `${issues} overflow issues`);
