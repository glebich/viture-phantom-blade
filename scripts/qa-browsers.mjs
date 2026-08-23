// cross-engine smoke: chromium + webkit + firefox, desktop & mobile, console errors + tail shots
import { chromium, webkit, firefox } from "playwright";
const engines = { chromium, webkit, firefox };
for (const [name, engine] of Object.entries(engines)) {
  let b;
  try { b = await engine.launch(); } catch (e) { console.log(name, "SKIP", String(e).slice(0, 80)); continue; }
  for (const [label, vp] of [["desktop", { width: 1920, height: 1080 }], ["mobile", { width: 375, height: 812 }]]) {
    const pg = await b.newPage({ viewport: vp });
    const errs = [];
    pg.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
    pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
    try {
      await pg.goto("http://localhost:5175/", { waitUntil: "load", timeout: 30000 });
      await pg.waitForTimeout(5000);
      const H = await pg.evaluate(() => document.body.scrollHeight);
      for (const f of [0.15, 0.5, 0.85]) {
        await pg.evaluate((y) => window.scrollTo(0, y), Math.round(H * f));
        await pg.waitForTimeout(700);
      }
      await pg.screenshot({ path: `qa/x-${name}-${label}.png` });
      console.log(name, label, "OK", "errs:", errs.length ? JSON.stringify(errs.slice(0,4)) : "none");
    } catch (e) { console.log(name, label, "FAIL", String(e).slice(0, 150)); }
    await pg.close();
  }
  await b.close();
}
