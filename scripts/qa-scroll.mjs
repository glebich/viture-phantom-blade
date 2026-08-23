// live-scroll smoke test: capture the real page at several scroll depths
import { chromium } from "playwright";
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await pg.goto("http://localhost:5175/", { waitUntil: "networkidle" });
await pg.waitForTimeout(4500); // loader
const H = await pg.evaluate(() => document.body.scrollHeight);
const stops = process.argv[2] ? process.argv.slice(2).map(Number) : [0.06,0.1,0.14,0.18,0.24,0.3,0.36,0.42,0.48,0.54,0.6,0.66,0.72,0.78,0.84,0.9,0.96];
for (const f of stops) {
  await pg.evaluate((y) => window.scrollTo(0, y), Math.round(H * f));
  await pg.waitForTimeout(900);
  await pg.screenshot({ path: `qa/scroll-${String(Math.round(f*100)).padStart(2,"0")}.png` });
  console.log("shot", f);
}
await browser.close();
