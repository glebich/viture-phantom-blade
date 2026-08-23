// Capture sections at 1920x1080 via ?only= harness; compose side-by-side
// sheets against the Figma refs (harvest/refs/*.png).
// Usage: node scripts/qa-captures.mjs [s02 ...] [--mobile|--tablet]
import { chromium, webkit } from "playwright";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "qa");
const REFS = path.join(ROOT, "harvest/refs");
fs.mkdirSync(OUT, { recursive: true });

// build id → [figma ref, capture progress]
const MAP = {
  "s02-loader": ["Desktop-01.png", 0],           // loader shown at p0 pre-finish
  s02:          ["Desktop-05.png", 0.97],
  s06:          ["Desktop-06.png", 0.93],
  s07:          ["Desktop-106.png", 0.95],
  "s07a":       ["Desktop-07.png", 0.16],
  s09:          ["Desktop-08-Transition.png", 0.5],
  "s10a":       ["Desktop-09.png", 0.12],
  s10:          ["Desktop-10.png", 0.95],
  s11:          ["Desktop-11.png", 0.55],
  "s11b":       ["Desktop-12.png", 0.96],
  s13:          ["Desktop-13.png", 0.1],
  "s13a":       ["Desktop-13A.png", 0.36],
  "s13b":       ["Desktop-13B.png", 0.6],
  "s13c":       ["Desktop-13C.png", 0.9],
  s14:          ["Desktop-14.png", 0.8],
  s15:          ["Desktop-15.png", 0.8],
  s16:          ["Desktop-16.png", 0.85],
  s17:          ["Desktop-17b.png", 0.98],
};

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const keys = args.length ? args : Object.keys(MAP).filter((k) => k !== "s02-loader");
const engine = process.argv.includes("--webkit") ? webkit : chromium;
const mobile = process.argv.includes("--mobile");
const tablet = process.argv.includes("--tablet");
const vp = mobile ? { width: 375, height: 812 } : tablet ? { width: 744, height: 1133 } : { width: 1920, height: 1080 };

const browser = await engine.launch();
const page = await browser.newPage({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1 });

for (const key of keys) {
  const [refName, p] = MAP[key];
  const id = key.replace(/[a-c]$|-loader$/, "").replace(/s07a/, "s07");
  const sid = key.match(/^s\d+/)[0];
  const url = `http://localhost:5175/?only=${sid}&progress=${p}&nocull`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2800);
  const suffix = mobile ? "-m" : tablet ? "-t" : "";
  const shot = path.join(OUT, `${key}${suffix}.png`);
  await page.screenshot({ path: shot });
  if (mobile || tablet) { console.log("captured", key, suffix); continue; }
  const ref = path.join(REFS, refName);
  if (fs.existsSync(ref)) {
    const refBuf = await sharp(ref).resize(1920, 1080, { fit: "fill" }).toBuffer();
    const sheet = await sharp({ create: { width: 1920, height: 2170, channels: 3, background: "#222" } })
      .composite([
        { input: refBuf, top: 0, left: 0 },
        { input: fs.readFileSync(shot), top: 1090, left: 0 },
      ]).png({ compressionLevel: 8 }).toBuffer();
    fs.writeFileSync(path.join(OUT, `${key}-sheet.png`), sheet);
  }
  console.log("captured", key);
}
await browser.close();
