// Screenshots the implemented screens at the Phase 4.5 QA widths.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "design", "qa");
mkdirSync(outDir, { recursive: true });

const BASE = "http://localhost:3000";
const widths = [
  { label: "375x812", w: 375, h: 812 },
  { label: "390x844", w: 390, h: 844 },
  { label: "430x932", w: 430, h: 932 },
  { label: "1280", w: 1280, h: 900 },
  { label: "1440", w: 1440, h: 1000 },
];
const routes = [
  { name: "landing", path: "/" },
  { name: "exam-select", path: "/exam/select" },
  { name: "personalize", path: "/exam/personalize" },
  { name: "home", path: "/app/home" },
  { name: "study", path: "/app/study" },
  { name: "planner", path: "/app/planner" },
  { name: "progress", path: "/app/progress" },
  { name: "resources", path: "/app/resources" },
  { name: "mock-tests", path: "/app/mock-tests" },
  { name: "more", path: "/app/more" },
];

const browser = await chromium.launch();
for (const vp of widths) {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    try {
      await page.goto(BASE + route.path, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(400);
      // Detect horizontal overflow
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      await page.screenshot({ path: join(outDir, `${route.name}--${vp.label}.png`), fullPage: true });
      if (overflow > 1) console.log(`!! overflow ${overflow}px on ${route.name} @ ${vp.label}`);
    } catch (e) {
      console.log(`ERR ${route.name} @ ${vp.label}: ${e.message.split("\n")[0]}`);
    }
    await page.close();
  }
  console.log(`done ${vp.label}`);
}
await browser.close();
