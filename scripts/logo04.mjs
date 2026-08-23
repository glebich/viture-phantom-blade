import { chromium } from "playwright";
import sharp from "sharp";
const pg = await (await chromium.launch()).newPage({ viewport: { width: 1980, height: 1160 }, deviceScaleFactor: 2 });
await pg.goto("https://www.figma.com/proto/Whv6FPNemFhi5egktiTWFn/x?node-id=19291-5&scaling=contain&hide-ui=1", { waitUntil: "domcontentloaded", timeout: 45000 });
await pg.waitForTimeout(8000);
const box = await pg.locator("canvas").first().boundingBox();
const W = 1920, H = 1080;
const s = Math.min(box.width / W, box.height / H);
const ox = box.x + (box.width - W * s) / 2, oy = box.y + (box.height - H * s) / 2;
const full = await pg.screenshot({ clip: { x: ox, y: oy, width: W * s, height: H * s } });
await sharp(full).toFile("harvest/full2x/d04-old.png");
// logo rect (545,562,831,73) design px, generous margin
const px = s * 2;
await sharp(full).extract({ left: Math.round(525 * px), top: Math.round(540 * px), width: Math.round(880 * px), height: Math.round(120 * px) })
  .png().toFile("harvest/probe/logo04-raw.png");
console.log("ok", px);
process.exit(0);
