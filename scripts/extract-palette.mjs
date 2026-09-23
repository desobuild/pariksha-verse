// Extracts fill color frequency + gradient defs from each Stitch SVG.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const srcDir = join(process.cwd(), "design", "screens");
const files = readdirSync(srcDir).filter((f) => f.endsWith(".svg"));

const hexToHsl = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      default: h = ((r - g) / d + 4);
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

for (const file of files) {
  const c = readFileSync(join(srcDir, file), "utf8");
  // Strip embedded raster images (huge base64 blobs)
  const clean = c.replace(/<image[\s\S]*?<\/image>/g, "<image/>").replace(/<image[^>]*\/>/g, "<image/>");
  const counts = {};
  for (const m of clean.matchAll(/fill="(#[0-9A-Fa-f]{6,8})"/g)) {
    const h = m[1].slice(0, 7).toUpperCase();
    counts[h] = (counts[h] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 18);
  console.log("\n=== " + file + " ===");
  for (const [hex, n] of sorted) console.log(`  ${String(n).padStart(4)}x ${hex}  (hsl ${hexToHsl(hex)})`);
  const grads = [...clean.matchAll(/<linearGradient[\s\S]*?<\/linearGradient>/g)].length;
  const rasts = (c.match(/<image/g) || []).length;
  console.log(`  [gradients: ${grads}, raster images: ${rasts}]`);
}
