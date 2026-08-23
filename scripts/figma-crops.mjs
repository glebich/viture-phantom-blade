/* Re-capture key frames at deviceScaleFactor 2 and cut production crops.
 * Rects are in DESIGN px (1920-wide frames unless noted). */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const FILE = "Whv6FPNemFhi5egktiTWFn";
mkdirSync("public/assets/ui", { recursive: true });
mkdirSync("harvest/full2x", { recursive: true });

// frameId -> design W/H + crops {name, rect [x,y,w,h] design px}
const JOBS = [
  { id: "19452:11865", w: 1920, h: 1080, name: "d06", crops: [
    ["vmark",      [28, 38, 62, 52]],
    ["cta-paper",  [1662, 30, 232, 66]],
    ["glasses",    [1478, 48, 66, 36]],
  ]},
  { id: "19452:12158", w: 1920, h: 1080, name: "d09", crops: [
    ["flourish-l", [500, 905, 165, 30]],
    ["flourish-r", [1205, 905, 165, 30]],
  ]},
  { id: "19452:12726", w: 1920, h: 1080, name: "d17", crops: [
    ["lockup",     [188, 170, 460, 42]],
    ["map",        [1020, 260, 500, 620]],
  ]},
  { id: "19452:12790", w: 1920, h: 1080, name: "d14", crops: [
    ["screen14",   [490, 388, 942, 512]],   // inside the 1px red frame
    ["plate14",    [0, 0, 1920, 1080]],     // full plate (temp until bridge)
  ]},
  { id: "19452:12841", w: 1920, h: 1080, name: "d15", crops: [
    ["osd",        [604, 304, 528, 442]],
    ["plate15",    [0, 0, 1920, 1080]],
  ]},
  { id: "19452:12615", w: 1920, h: 1080, name: "d16", crops: [
    ["card-blade", [180, 342, 315, 395]],
    ["card-strap", [548, 408, 305, 360]],
    ["card-cloth", [886, 375, 275, 335]],
    ["card-cards", [1276, 335, 280, 355]],
    ["plate16",    [0, 0, 1920, 1080]],
  ]},
  { id: "19452:12969", w: 1920, h: 1080, name: "d05", crops: [
    ["plate05",    [0, 0, 1920, 1080]],     // hero reference
  ]},
  { id: "19452:11828", w: 1920, h: 1080, name: "d01", crops: [
    ["plate01",    [0, 0, 1920, 1080]],     // loader wash + thread
  ]},
  { id: "19452:12320", w: 1920, h: 1080, name: "d13", crops: [
    ["ic-anchor",  [686, 142, 44, 44]],
    ["ic-uwide",   [792, 142, 44, 44]],
    ["ic-3d",      [898, 142, 44, 44]],
    ["ic-side",    [1004, 142, 44, 44]],
  ]},
  { id: "19452:12890", w: 1920, h: 1080, name: "d12", crops: [
    ["plate12",    [0, 0, 1920, 1080]],     // torn-frame battlefield
  ]},
];

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1980, height: 1160 }, deviceScaleFactor: 2 });
for (const job of JOBS) {
  await pg.setViewportSize({ width: job.w + 60, height: job.h + 80 });
  const url = `https://www.figma.com/proto/${FILE}/x?node-id=${job.id.replace(":", "-")}&scaling=contain&hide-ui=1`;
  await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await pg.waitForTimeout(7000);
  const canvas = pg.locator("canvas").first();
  const box = await canvas.boundingBox();
  const s = Math.min(box.width / job.w, box.height / job.h);
  const ox = box.x + (box.width - job.w * s) / 2;
  const oy = box.y + (box.height - job.h * s) / 2;
  const full = await pg.screenshot({
    clip: { x: ox, y: oy, width: job.w * s, height: job.h * s },
  }); // at dsf=2 → pixels = design*s*2
  const px = s * 2;
  const img = sharp(full);
  const meta = await img.metadata();
  await sharp(full).toFile(`harvest/full2x/${job.name}.png`);
  for (const [name, [x, y, w, h]] of job.crops) {
    const rx = Math.max(0, Math.round(x * px));
    const ry = Math.max(0, Math.round(y * px));
    const rw = Math.min(meta.width - rx, Math.round(w * px));
    const rh = Math.min(meta.height - ry, Math.round(h * px));
    await sharp(full).extract({ left: rx, top: ry, width: rw, height: rh })
      .webp({ quality: 92 }).toFile(`public/assets/ui/${name}.webp`);
    console.log("crop", name, rw, rh);
  }
  console.log("done", job.name);
}
await browser.close();
