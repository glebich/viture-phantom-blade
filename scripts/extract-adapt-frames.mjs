// Extract alpha frames from the ProRes 4444 ADAPT movs → WebP (alpha)
// sequences for the canvas scrub engine. ffmpeg → PNG, sharp → WebP.
import { execFileSync } from "child_process";
import sharp from "sharp";
import fs from "fs";
import os from "os";
import path from "path";

const SRC = path.join(os.homedir(), "Downloads/DOCKs/ADAPT/MOVs+A");
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const OUT = path.join(ROOT, "public/assets");

for (const n of [1, 2, 3, 4, 6]) {
  const mov = path.join(SRC, `VITURE_BEAST_ASSET_DOCK_ADAPT_${n}.mov`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `adapt${n}-`));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", mov, "-pix_fmt", "rgba", path.join(tmp, "f_%03d.png")]);
  const pngs = fs.readdirSync(tmp).filter((f) => f.endsWith(".png")).sort();
  for (const size of [1440, 720]) {
    const dir = path.join(OUT, `adapt${n}-${size}`);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(path.join(dir, `f_${String(pngs.length - 1).padStart(3, "0")}.webp`))) {
      console.log(`SKIP adapt${n}-${size}`);
      continue;
    }
    let i = 0;
    for (const f of pngs) {
      const out = path.join(dir, `f_${String(i).padStart(3, "0")}.webp`);
      await sharp(path.join(tmp, f))
        .resize({ width: size })
        .webp({ quality: 80, alphaQuality: 88, effort: 4 })
        .toFile(out);
      i++;
    }
    const kb = Math.round(
      fs.readdirSync(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0) / 1024,
    );
    console.log(`OK adapt${n}-${size}: ${i} frames, ${kb}KB`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log("DONE");
