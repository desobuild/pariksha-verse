// Renders each Stitch SVG in design/screens to a PNG for visual inspection.
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

const srcDir = join(process.cwd(), "design", "screens");
const outDir = join(process.cwd(), "design", "renders");
mkdirSync(outDir, { recursive: true });

const files = readdirSync(srcDir).filter((f) => f.endsWith(".svg"));
const browser = await chromium.launch();
const manifest = {};

for (const file of files) {
  const raw = readFileSync(join(srcDir, file), "utf8");
  const m = raw.match(/width="([\d.]+)"[^>]*height="([\d.]+)"/);
  const w = Math.round(parseFloat(m[1]));
  const h = Math.round(parseFloat(m[2]));
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("file:///" + join(srcDir, file).replace(/\\/g, "/").replace(/ /g, "%20").replace(/&/g, "%26"));
  await page.waitForTimeout(300);
  const out = join(outDir, basename(file, ".svg") + ".png");
  await page.screenshot({ path: out, fullPage: false });
  manifest[file] = { width: w, height: h, render: out };
  await page.close();
  console.log(`rendered ${file} (${w}x${h})`);
}

await browser.close();
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
