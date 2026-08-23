// Mobile interaction QA — iPhone 13 emulation, touch taps.
// s12 step tabs, s14 Solo/Co-op tabs + YouTube modal, s06 canvas drag-scrub
// (and that vertical swipes on the canvas still scroll the page).
import { chromium, devices } from "playwright";
import path from "path";

const ROOT = "/Users/gleb/Dropbox (Personal)/Osyle/WEBSITE/minidock";
const OUT = path.join(ROOT, "qa");

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 300)));

await page.goto("http://localhost:4174/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !document.getElementById("s01"), null, { timeout: 15000 }).catch(() => errors.push("LOADER NEVER RETIRED"));
await page.waitForTimeout(1000);

const freshY = (id, p = 0) =>
  page.evaluate(([iid, pp]) => {
    const el = document.getElementById(iid);
    if (!el) return null;
    const box = el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : el;
    const r = box.getBoundingClientRect();
    return Math.round(scrollY + r.top + Math.max(0, r.height - innerHeight) * pp);
  }, [id, p]);
const scrollExact = async (yy) => {
  for (let k = 0; k < 6; k++) {
    await page.evaluate((v) => window.scrollTo(0, v), yy);
    await page.waitForTimeout(1100);
    const a = await page.evaluate(() => scrollY);
    await page.waitForTimeout(400);
    const b = await page.evaluate(() => scrollY);
    if (Math.abs(a - yy) < 4 && Math.abs(b - yy) < 4) return true;
  }
  return false;
};
const gotoSection = async (id, p = 0) => {
  for (let a = 0; a < 4; a++) {
    const yy = await freshY(id, p);
    if (yy === null) return false;
    if (await scrollExact(yy)) return true;
  }
  return false;
};
const tap = async (sel) => {
  const el = page.locator(sel).first();
  await el.tap({ timeout: 5000 });
};

// ---------- s12: step tabs ----------
if (!(await gotoSection("s12"))) errors.push("could not reach s12");
await page.waitForTimeout(1500);
await tap('#s12 .stage--m .s12-step:nth-child(3)');
await page.waitForTimeout(1200);
const s12state = await page.evaluate(() => {
  const st = document.querySelector("#s12 .stage--m");
  const sel = Array.from(st.querySelectorAll(".s12-step")).map((b) => b.getAttribute("aria-selected"));
  const ops = Array.from(st.querySelectorAll(".s12-img")).map((i) => Math.round(parseFloat(getComputedStyle(i).opacity) * 100) / 100);
  return { sel, ops };
});
if (s12state.sel[2] !== "true") errors.push("s12 tap: step 3 not selected: " + JSON.stringify(s12state.sel));
if (!(s12state.ops[2] > 0.5)) errors.push("s12 tap: image 3 not shown: " + JSON.stringify(s12state.ops));
await page.screenshot({ path: path.join(OUT, "m13-x-s12-step3.png") });

// ---------- s14: tabs + modal ----------
if (!(await gotoSection("s14"))) errors.push("could not reach s14");
await page.waitForTimeout(1200);
await tap('#s14 .stage--m .s14-toggle button:nth-child(2)');
await page.waitForTimeout(900);
const s14state = await page.evaluate(() => {
  const st = document.querySelector("#s14 .stage--m");
  return {
    coop: st.classList.contains("s14--coop"),
    sel: Array.from(st.querySelectorAll(".s14-toggle button")).map((b) => b.getAttribute("aria-selected")),
    cta: st.querySelector(".s14-cta-t").textContent,
    ctaBox: (() => { const r = st.querySelector(".s14-cta").getBoundingClientRect(); const s = st.getBoundingClientRect(); const k = 375 / s.width; return { x: Math.round((r.x - s.x) * k), w: Math.round(r.width * k) }; })(),
    thumbVisible: getComputedStyle(st.querySelector(".s14-thumb")).display !== "none",
  };
});
if (!s14state.coop) errors.push("s14 tap: co-op state not applied");
if (s14state.sel[1] !== "true") errors.push("s14 tap: co-op tab not selected");
if (!s14state.thumbVisible) errors.push("s14 tap: co-op thumb not visible");
if (s14state.ctaBox.x + s14state.ctaBox.w > 376) errors.push("s14 co-op CTA overflows stage: " + JSON.stringify(s14state.ctaBox));
await page.screenshot({ path: path.join(OUT, "m13-x-s14-coop.png") });

// modal open via thumb tap
await tap('#s14 .stage--m .s14-thumb');
await page.waitForTimeout(1200);
const modal = await page.evaluate(() => {
  const ov = document.querySelector(".vm-overlay");
  if (!ov) return { open: false };
  return {
    open: ov.classList.contains("vm-open"),
    iframe: !!ov.querySelector("iframe"),
    src: ov.querySelector("iframe")?.src?.slice(0, 60),
  };
});
if (!modal.open || !modal.iframe) errors.push("s14 modal failed: " + JSON.stringify(modal));
await page.screenshot({ path: path.join(OUT, "m13-x-s14-modal.png") });
// close via backdrop tap (top-left corner, outside the frame)
await page.touchscreen.tap(30, 80);
await page.waitForTimeout(800);
const closed = await page.evaluate(() => !document.querySelector(".vm-overlay")?.classList.contains("vm-open"));
if (!closed) errors.push("s14 modal did not close via backdrop");
await page.screenshot({ path: path.join(OUT, "m13-x-s14-modal-closed.png") });
// back to solo
await tap('#s14 .stage--m .s14-toggle button:nth-child(1)');
await page.waitForTimeout(600);

// ---------- s06: canvas drag scrub + vertical swipe still scrolls ----------
if (!(await gotoSection("s06", 0.45))) errors.push("could not reach s06 plateau");
await page.waitForTimeout(1500);
const canvasBox = await page.evaluate(() => {
  const c = document.querySelector("#s06 .stage--m .s06-vid canvas");
  const r = c.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, ta: getComputedStyle(c).touchAction };
});
if (!/pan-y/.test(canvasBox.ta)) errors.push("s06 canvas touch-action missing pan-y: " + canvasBox.ta);
// horizontal drag (pointer events) scrubs the clip
const cx = Math.max(20, canvasBox.x + canvasBox.w * 0.5);
const cy = canvasBox.y + canvasBox.h * 0.5;
const before = await page.screenshot({ clip: { x: 40, y: 200, width: 300, height: 260 } });
// real touch drag via CDP (active pointer -> setPointerCapture works)
const cdp0 = await context.newCDPSession(page);
await cdp0.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy, id: 1 }] });
for (let i = 1; i <= 8; i++) {
  await cdp0.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx - i * 15, y: cy, id: 1 }] });
  await page.waitForTimeout(30);
}
await cdp0.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await page.waitForTimeout(300);
const after = await page.screenshot({ clip: { x: 40, y: 200, width: 300, height: 260 } });
if (Buffer.compare(before, after) === 0) errors.push("s06 drag scrub: canvas did not change");
// vertical swipe on the canvas must scroll the page (touch-action pan-y)
const y0 = await page.evaluate(() => scrollY);
await page.touchscreen.tap(cx, cy); // ensure focus surface
await page.evaluate(() => void 0);
// synthesize a native-ish vertical swipe via CDP for realism
const cdp = await context.newCDPSession(page);
await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(cx), y: Math.round(cy), xDistance: 0, yDistance: -400, speed: 1200 });
await page.waitForTimeout(1200);
const y1 = await page.evaluate(() => scrollY);
if (Math.abs(y1 - y0) < 50) errors.push(`s06 vertical swipe on canvas did not scroll page (y ${y0} -> ${y1})`);

console.log("interaction errors:", errors.length ? errors : "none");
await browser.close();
