// mobile live-scroll smoke test: capture the real page at many scroll depths
// on a 375x812 phone viewport, then tile the shots into contact sheets.
// Usage: node scripts/qa-mscroll.mjs [tag]
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "fs";

const TAG = process.argv[2] || "m";
const browser = await chromium.launch();
const pg = await browser.newPage({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
await pg.goto("http://localhost:5175/", { waitUntil: "networkidle" });
await pg.waitForTimeout(6000); // loader
const H = await pg.evaluate(() => document.body.scrollHeight);
const stops = [];
for (let f = 0.02; f <= 0.995; f += 0.02) stops.push(Math.round(f * 1000) / 1000);
const shots = [];
fs.mkdirSync(`qa/${TAG}`, { recursive: true });
for (const f of stops) {
  await pg.evaluate((y) => window.scrollTo(0, y), Math.round(H * f));
  await pg.waitForTimeout(700);
  const p = `qa/${TAG}/${String(Math.round(f * 100)).padStart(3, "0")}.png`;
  await pg.screenshot({ path: p });
  shots.push(p);
}
await browser.close();

// contact sheets: 8 per row
const COLS = 8, W = 250, Hh = 541;
for (let s = 0; s < shots.length; s += COLS * 2) {
  const batch = shots.slice(s, s + COLS * 2);
  const rows = Math.ceil(batch.length / COLS);
  const comps = [];
  for (let i = 0; i < batch.length; i++) {
    comps.push({
      input: await sharp(batch[i]).resize(W, Hh).toBuffer(),
      left: (i % COLS) * W,
      top: Math.floor(i / COLS) * Hh,
    });
  }
  await sharp({ create: { width: COLS * W, height: rows * Hh, channels: 3, background: "#111" } })
    .composite(comps)
    .png()
    .toFile(`qa/${TAG}-sheet${s / (COLS * 2)}.png`);
}
console.log("done", shots.length, "shots");
