import { chromium } from "playwright";
import sharp from "sharp";
const b = await chromium.launch();
const pg = await b.newPage({ viewportSize: { width: 1600, height: 900 } });
await pg.goto("http://localhost:4173/", { waitUntil: "networkidle" }); // snap ON like real users
await pg.waitForTimeout(9500);
const geo = await pg.evaluate(() => {
  const el = document.getElementById("s06");
  const sp = el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : el;
  const r = sp.getBoundingClientRect();
  return { top: r.top + window.scrollY, h: r.height };
});
// park just before the giant beat, then wheel down through the line beat
await pg.evaluate((g) => window.scrollTo(0, g.top + (g.h - innerHeight) * 0.45), geo);
await pg.waitForTimeout(1500);
await pg.mouse.move(800, 450);
const fs = await import("fs");
const OUT = "/private/tmp/claude-501/-Users-gleb-Dropbox--Personal--Osyle-WEBSITE/065fe850-252e-457d-9b48-dae39a1e1a0d/scratchpad";
let hit = -1;
for (let k = 0; k < 40; k++) {
  await pg.mouse.wheel(0, 260);
  await pg.waitForTimeout(90);
  const shot = await pg.screenshot();
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  const lum = (x0, x1, y0, y1) => {
    let s = 0, n = 0;
    for (let y = y0; y < y1; y += 4) for (let x = x0; x < x1; x += 4) {
      const i = (y * info.width + x) * info.channels;
      s += Math.max(data[i], data[i + 1], data[i + 2]); n++;
    }
    return s / n;
  };
  // giant "3" occupies x 300-600 y 250-650; line enters at x 1350-1590 y 330-560
  const giant = lum(320, 580, 280, 620);
  const line = lum(1360, 1580, 330, 560);
  if (giant > 14 && line > 14) {
    hit = k;
    fs.writeFileSync(`${OUT}/hunt-${k}.png`, shot);
    console.log(`frame ${k}: BOTH visible — giant ${giant.toFixed(1)}, line ${line.toFixed(1)}`);
  }
}
console.log(hit < 0 ? "no coexist frame caught" : `caught at frame ${hit}`);
await b.close();
