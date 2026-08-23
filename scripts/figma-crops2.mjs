import { chromium } from "playwright";
import sharp from "sharp";

const FILE = "Whv6FPNemFhi5egktiTWFn";
const JOBS = [
  { id: "19452:12726", w: 1920, h: 1080, name: "d17", crops: [
    ["plate17", [0, 0, 1920, 1080]],
    ["map",     [980, 230, 580, 740]],
  ]},
  { id: "19452:12320", w: 1920, h: 1080, name: "d13", crops: [
    ["ic-anchor", [756, 158, 64, 64]],
    ["ic-uwide",  [868, 158, 64, 64]],
    ["ic-3d",     [982, 158, 64, 64]],
    ["ic-side",   [1096, 158, 64, 64]],
  ]},
  // s04 logo — Tablet-04 shows the Phantom Blade Zero white logo on wash
  { id: "19452:13014", w: 744, h: 1133, name: "t04", crops: [
    ["plate-t04", [0, 0, 744, 1133]],
  ]},
];
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1980, height: 1160 }, deviceScaleFactor: 2 });
for (const job of JOBS) {
  await pg.setViewportSize({ width: job.w + 60, height: job.h + 80 });
  await pg.goto(`https://www.figma.com/proto/${FILE}/x?node-id=${job.id.replace(":", "-")}&scaling=contain&hide-ui=1`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await pg.waitForTimeout(7000);
  const box = await pg.locator("canvas").first().boundingBox();
  const s = Math.min(box.width / job.w, box.height / job.h);
  const ox = box.x + (box.width - job.w * s) / 2;
  const oy = box.y + (box.height - job.h * s) / 2;
  const full = await pg.screenshot({ clip: { x: ox, y: oy, width: job.w * s, height: job.h * s } });
  const px = s * 2;
  const meta = await sharp(full).metadata();
  for (const [name, [x, y, w, h]] of job.crops) {
    const rx = Math.round(x * px), ry = Math.round(y * px);
    await sharp(full).extract({ left: rx, top: ry, width: Math.min(meta.width - rx, Math.round(w * px)), height: Math.min(meta.height - ry, Math.round(h * px)) })
      .webp({ quality: 92 }).toFile(`public/assets/ui/${name}.webp`);
    console.log("crop", name);
  }
}
await browser.close();
