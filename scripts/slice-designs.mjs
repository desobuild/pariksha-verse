// Renders each Stitch SVG, auto-detects the phone frame, and emits readable slices.
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

const srcDir = join(process.cwd(), "design", "screens");
const outDir = join(process.cwd(), "design", "slices");
mkdirSync(outDir, { recursive: true });

const files = readdirSync(srcDir).filter((f) => f.endsWith(".svg") && !f.includes("Icon"));

const browser = await chromium.launch();

for (const file of files) {
  const raw = readFileSync(join(srcDir, file), "utf8");
  // Find the largest rounded-rect (the phone frame): scan <rect> with rx
  let best = null;
  for (const m of raw.matchAll(/<rect[^>]*rx="([\d.]+)"[^>]*>/g)) {
    const tag = m[0];
    const x = parseFloat(tag.match(/x="([-\d.]+)"/)?.[1] ?? "0");
    const y = parseFloat(tag.match(/y="([-\d.]+)"/)?.[1] ?? "0");
    const w = parseFloat(tag.match(/ width="([\d.]+)"/)?.[1] ?? "0");
    const h = parseFloat(tag.match(/ height="([\d.]+)"/)?.[1] ?? "0");
    if (w < 300 || w > 600 || h < 500) continue;
    if (!best || w * h > best.w * best.h) best = { x, y, w, h };
  }
  const vm = raw.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const vw = parseFloat(vm[1]), vh = parseFloat(vm[2]);
  if (!best) { console.log(`!! no frame found in ${file}`); best = { x: vw / 2 - 215, y: 0, w: 430, h: vh }; }

  const frame = best;
  const page = await browser.newPage({
    viewport: { width: Math.round(vw), height: Math.round(vh) },
    deviceScaleFactor: 2,
  });
  await page.goto("file:///" + join(srcDir, file).replace(/\\/g, "/").replace(/ /g, "%20").replace(/&/g, "%26"));
  await page.waitForTimeout(250);

  const base = basename(file, ".svg").replace(/[^A-Za-z0-9]+/g, "-");
  const sliceH = 880; // css px per slice
  const n = Math.ceil(frame.h / sliceH);
  for (let i = 0; i < n; i++) {
    const y = frame.y + i * sliceH;
    const h = Math.min(sliceH, frame.y + frame.h - y);
    await page.screenshot({
      path: join(outDir, `${base}--${i + 1}of${n}.png`),
      clip: { x: frame.x, y, width: frame.w, height: h },
    });
  }
  console.log(`${file}: frame ${JSON.stringify(frame)} -> ${n} slices`);
  await page.close();
}
await browser.close();
