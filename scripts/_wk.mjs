import { webkit } from "playwright";
const URL = "https://phantom-blade-insidemilk.vercel.app";
const b = await webkit.launch();
const p = await b.newPage({ viewport: { width: 1750, height: 1300 } });
const errs = [], bad = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 250)));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
p.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url().slice(0, 100)); });
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
let ok = "TIMEOUT";
try { await p.waitForFunction(() => !document.documentElement.classList.contains("loading"), { timeout: 30000 }); ok = "ok"; } catch {}
await p.waitForTimeout(3000);
const s = await p.evaluate(() => {
  const info = (sel) => { const e = document.querySelector(sel); if (!e) return "MISSING";
    const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
    return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} op=${c.opacity} disp=${c.display}`; };
  return {
    cls: document.documentElement.className,
    stylesheets: document.styleSheets.length,
    cssRules: (() => { try { return document.styleSheets[0].cssRules.length; } catch { return "blocked"; } })(),
    scale: getComputedStyle(document.documentElement).getPropertyValue("--s").trim(),
    header: info("#site-header"), logoImg: info(".hd-logo img"),
    stage: info("#s02 > .stage"), skip: info(".s02-skip"),
    paginator: info("#paginator"), heroTitle: info(".hero-title"),
    bodyBg: getComputedStyle(document.body).backgroundColor,
  };
});
console.log(JSON.stringify(s, null, 1));
console.log("errors:", errs.length, errs.slice(0, 4));
console.log("failed:", bad.slice(0, 6));
await p.screenshot({ path: "/tmp/wk-prod.png" });
await b.close();
