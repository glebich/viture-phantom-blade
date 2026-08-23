// Mobile QA journey — iPhone 13 emulation against the preview build.
// Usage: node m13-journey.mjs [--dpr2] [--webkit]
import { chromium, webkit, devices } from "playwright";
import fs from "fs";
import path from "path";

const ROOT = "/Users/gleb/Dropbox (Personal)/Osyle/WEBSITE/minidock";
const OUT = path.join(ROOT, "qa");
fs.mkdirSync(OUT, { recursive: true });

const useWebkit = process.argv.includes("--webkit");
const dpr2 = process.argv.includes("--dpr2");
const engine = useWebkit ? webkit : chromium;
const tag = `m13-${useWebkit ? "wk" : "cr"}${dpr2 ? "-375" : ""}`;

const browser = await engine.launch();
const ctxOpts = dpr2
  ? {
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
      isMobile: !useWebkit,
      hasTouch: true,
      userAgent: devices["iPhone 13"].userAgent,
    }
  : { ...devices["iPhone 13"], isMobile: useWebkit ? undefined : true };
if (useWebkit) delete ctxOpts.isMobile; // webkit doesn't support isMobile flag
const context = await browser.newContext(ctxOpts);
const page = await context.newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 300)));

await page.goto("http://localhost:4174/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(OUT, `${tag}-00-loader.png`) });

// wait for loader retirement (s01 removed from DOM), max 15s
await page
  .waitForFunction(() => !document.getElementById("s01"), null, { timeout: 15000 })
  .catch(() => errors.push("LOADER NEVER RETIRED"));
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, `${tag}-01-arrival.png`) });

// ---- targeted beat captures on pinned sections + top-aligned unpinned ----
const targets = await page.evaluate(() => {
  const vh = innerHeight;
  const y = scrollY;
  const out = [];
  const box = (el) =>
    el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : el;
  const beats = {
    s03: [0.05, 0.45, 0.8],
    s05: [0],
    s06: [0.1, 0.3, 0.5, 0.66, 0.82, 0.98],
    s07: [0.15, 0.38, 0.62, 0.9],
    s09: [0.15, 0.55, 0.9],
    s11: [0.1, 0.4, 0.8],
    s12: [0],
    s13: [0],
    s14: [0],
    s15: [0],
  };
  for (const [id, ps] of Object.entries(beats)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const b = box(el);
    const r = b.getBoundingClientRect();
    const top = y + r.top;
    const span = Math.max(0, r.height - vh);
    for (const p of ps) out.push({ id, p, y: Math.round(top + span * p) });
  }
  return out;
});
// Chromium's isMobile emulation sometimes reverts large programmatic
// jumps (scroll clamped through a transient pin revert) — assert + retry.
const scrollExact = async (yy) => {
  for (let k = 0; k < 6; k++) {
    await page.evaluate((v) => window.scrollTo(0, v), yy);
    await page.waitForTimeout(1100); // outlast the emulation revert window
    const a = await page.evaluate(() => scrollY);
    await page.waitForTimeout(400);
    const b = await page.evaluate(() => scrollY);
    if (Math.abs(a - yy) < 4 && Math.abs(b - yy) < 4) return true;
  }
  return false;
};
const freshY = (id, p) =>
  page.evaluate(([iid, pp]) => {
    const el = document.getElementById(iid);
    if (!el) return null;
    const box = el.parentElement?.classList.contains("pin-spacer")
      ? el.parentElement
      : el;
    const r = box.getBoundingClientRect();
    const span = Math.max(0, r.height - innerHeight);
    return Math.round(scrollY + r.top + span * pp);
  }, [id, p]);
const centerSection = () =>
  page.evaluate(() => {
    const els = document.elementsFromPoint(innerWidth / 2, innerHeight / 2);
    for (const e of els) {
      const s = e.closest?.("section.screen");
      if (s) return s.id;
    }
    return "?";
  });
for (const t of targets) {
  let good = false;
  for (let attempt = 0; attempt < 5 && !good; attempt++) {
    const yy = await freshY(t.id, t.p);
    if (yy === null) break;
    if (!(await scrollExact(yy))) continue;
    good = (await centerSection()) === t.id;
  }
  if (!good) errors.push(`WRONG SECTION at ${t.id} p${t.p}`);
  await page.screenshot({
    path: path.join(OUT, `${tag}-${t.id}-p${String(t.p).replace(".", "")}.png`),
  });
}

// full journey sweep for anything the beats missed
const limit = await page.evaluate(() => document.body.scrollHeight - innerHeight);
const STEPS = 24;
for (let i = 0; i <= STEPS; i++) {
  const yy = Math.round((limit * i) / STEPS);
  await scrollExact(yy);
  await page.screenshot({ path: path.join(OUT, `${tag}-j${String(i).padStart(2, "0")}.png`) });
}

console.log("errors:", errors.length ? errors : "none");
await browser.close();
