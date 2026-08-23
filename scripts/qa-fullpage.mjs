// Full-page scroll QA: drive the real page (no ?only harness), stepping
// through the document and capturing frames; log console errors and check
// pinned choreography engages. Works on chromium and webkit.
// Usage: node scripts/qa-fullpage.mjs [--webkit] [--mobile] [--steps 28]
import { chromium, webkit } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "qa/fullpage");
fs.mkdirSync(OUT, { recursive: true });

const engine = process.argv.includes("--webkit") ? webkit : chromium;
const mobile = process.argv.includes("--mobile");
const stepsArg = process.argv.indexOf("--steps");
const STEPS = stepsArg > -1 ? parseInt(process.argv[stepsArg + 1]) : 30;
const tag = `${engine === webkit ? "wk" : "cr"}${mobile ? "-m" : ""}`;

const browser = await engine.launch();
const page = await browser.newPage({
  viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 200)));

await page.goto("http://localhost:5174/", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const limit = await page.evaluate(() => document.body.scrollHeight - innerHeight);
console.log("scroll limit:", limit);
for (let i = 0; i <= STEPS; i++) {
  const y = Math.round((limit * i) / STEPS);
  // native scroll (bypasses lenis smoothing deterministically)
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(420);
  await page.screenshot({ path: path.join(OUT, `${tag}-${String(i).padStart(2, "0")}.png`) });
}
console.log("errors:", errors.length ? errors : "none");
await browser.close();
