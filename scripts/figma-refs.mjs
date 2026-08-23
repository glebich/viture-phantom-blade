/* Capture Figma proto-viewer renders of every Viture Phantom_Dev frame.
 * Anonymous view; scaling=contain; screenshot cropped to the frame box. */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const FILE = "Whv6FPNemFhi5egktiTWFn";
const FRAMES = [
 ["19452:11828","Desktop-01",1920,1080],
 ["19452:11860","Desktop-02-Transition",1920,1080],
 ["19452:11854","Desktop-03-Transition",1920,1080],
 ["19452:12969","Desktop-05",1920,1080],
 ["19452:11865","Desktop-06",1920,1080],
 ["19452:11986","Desktop-07",1920,1080],
 ["19452:12078","Desktop-106",1920,1080],
 ["19452:12118","Desktop-08-Transition",1920,1080],
 ["19452:12158","Desktop-09",1920,1080],
 ["19452:12203","Desktop-09B",1920,1080],
 ["19452:12242","Desktop-11-Transition",1920,1080],
 ["19452:12281","Desktop-10",1920,1080],
 ["19452:12930","Desktop-11",1920,1080],
 ["19452:12890","Desktop-12",1920,1080],
 ["19452:12320","Desktop-13",1920,1080],
 ["19452:12558","Desktop-13A",1920,1080],
 ["19452:12436","Desktop-13B",1920,1080],
 ["19452:12496","Desktop-13C",1920,1080],
 ["19452:12790","Desktop-14",1920,1080],
 ["19452:12841","Desktop-15",1920,1080],
 ["19452:12615","Desktop-16",1920,1080],
 ["19452:12672","Desktop-16A",1920,1080],
 ["19452:14634","Desktop-16Scroll",1920,1080],
 ["19452:14527","Desktop-16b",1920,1080],
 ["19452:14669","Desktop-17",1920,1080],
 ["19452:12726","Desktop-17b",1920,1080],
 ["19452:14286","Desktop-15b",1920,1080],
 // tablet
 ["19452:13809","Tablet-01",744,1133],["19452:13875","Tablet-02",744,1133],
 ["19452:13862","Tablet-03",744,1133],["19452:13014","Tablet-04",744,1133],
 ["19452:14473","Tablet-05",744,1133],["19452:13886","Tablet-06",744,1133],
 ["19452:13931","Tablet-07",744,1133],["19452:13988","Tablet-08",744,1133],
 ["19452:14033","Tablet-09",744,1133],["19452:14131","Tablet-10",744,1133],
 ["19452:14088","Tablet-11",744,1133],["19452:14430","Tablet-12",744,1133],
 ["19452:14385","Tablet-12_2",744,1133],["19452:14174","Tablet-13",744,1133],
 ["19452:14251","Tablet-14",744,1133],
 // phone
 ["19452:13835","Phone-01",375,812],["19452:13880","Phone-02",375,812],
 ["19452:13868","Phone-03",375,812],["19452:13411","Phone-04",375,812],
 ["19452:14499","Phone-05",375,812],["19452:13910","Phone-06",375,812],
 ["19452:13961","Phone-07",375,812],["19452:14012","Phone-08",375,812],
 ["19452:14062","Phone-09",375,812],["19452:14154","Phone-10",375,812],
 ["19452:14111","Phone-11",375,812],["19452:14453","Phone-12",375,812],
 ["19452:14409","Phone-12_2",375,812],["19452:14214","Phone-13",375,812],
 ["19452:14321","Phone-14",375,812],["19452:14353","Phone-15",375,812],
 ["19452:14559","Phone-16",375,812],["19452:14588","Phone-17",375,812],
];

const only = process.argv[2];
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1980, height: 1160 }, deviceScaleFactor: 1 });
for (const [id, name, w, h] of FRAMES) {
  if (only && !name.includes(only)) continue;
  // viewport slightly larger than the frame so contain == 1:1 pixels
  await pg.setViewportSize({ width: Math.min(2400, w + 60), height: h + 80 });
  const url = `https://www.figma.com/proto/${FILE}/x?node-id=${id.replace(":","-")}&scaling=contain&hide-ui=1`;
  try {
    await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await pg.waitForTimeout(6500);
    const canvas = pg.locator("canvas").first();
    const box = await canvas.boundingBox();
    // frame is contain-fit inside canvas; compute letterbox crop
    const s = Math.min(box.width / w, box.height / h);
    const cw = w * s, ch = h * s;
    const clip = { x: box.x + (box.width - cw) / 2, y: box.y + (box.height - ch) / 2, width: cw, height: ch };
    const buf = await pg.screenshot({ clip });
    writeFileSync(`harvest/refs/${name}.png`, buf);
    console.log("ok", name, Math.round(cw), Math.round(ch));
  } catch (e) { console.log("FAIL", name, String(e).slice(0, 120)); }
}
await browser.close();
