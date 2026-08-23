import { webkit, chromium } from "playwright";
const URL = "http://localhost:4188/";
for (const [name, engine] of [["webkit", webkit], ["chromium", chromium]]) {
  const b = await engine.launch();
  const p = await b.newPage({ viewport: { width: 1750, height: 1300 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  try { await p.waitForFunction(() => !document.documentElement.classList.contains("loading"), { timeout: 30000 }); } catch {}
  await p.waitForTimeout(2500);
  const s = await p.evaluate(() => {
    const pos = (sel) => { const e = document.querySelector(sel); if (!e) return "MISSING";
      const c = getComputedStyle(e); const r = e.getBoundingClientRect();
      return `${c.position} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`; };
    let rules = 0; try { rules = document.styleSheets[0].cssRules.length; } catch {}
    return { rules, scale: getComputedStyle(document.documentElement).getPropertyValue("--s").trim(),
      header: pos("#site-header"), stage: pos("#s02 > .stage"),
      paginator: pos("#paginator"), skip: pos(".s02-skip"), cine: pos("#cine-rail") };
  });
  console.log(name, JSON.stringify(s), "errors:", errs.length);
  await p.screenshot({ path: `/tmp/built-${name}.png` });
  await b.close();
}
