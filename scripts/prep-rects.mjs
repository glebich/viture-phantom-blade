// Convert harvested per-node rect exports (crop/effects baked by Figma)
// into site assets + a manifest of exact design-space placements.
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HARVEST = path.join(ROOT, "../viture-pro2/harvest/minidock");
const OUT = path.join(ROOT, "public/assets/rects");
fs.mkdirSync(OUT, { recursive: true });

// Build node-id → absolute placement from the spec JSONs (positions in the
// spec are relative to each node's parent, so accumulate offsets).
const manifest = {};
for (const f of fs.readdirSync(HARVEST).filter((f) => f.startsWith("spec__"))) {
  const spec = JSON.parse(fs.readFileSync(path.join(HARVEST, f), "utf8"));
  const frameId = spec.id.replace(":", "-");
  const walk = (n, ox, oy) => {
    const ax = ox + (n.x || 0);
    const ay = oy + (n.y || 0);
    if (n.fills && n.fills.some((fl) => fl.t === "image")) {
      (manifest[frameId] ??= []).push({
        id: n.id.replace(":", "-"),
        name: n.name,
        x: Math.round(ax),
        y: Math.round(ay),
        w: Math.round(n.w),
        h: Math.round(n.h),
        opacity: n.opacity ?? 1,
        rot: n.rot || 0,
        hidden: !!n.hidden,
      });
    }
    // children are positioned relative to the frame root in our serializer?
    // No: serializer used node.x/y which are PARENT-relative — accumulate.
    (n.ch || []).forEach((c) => walk(c, ax, ay));
  };
  // root frame: children offsets accumulate from 0 (frame's own x/y is
  // canvas-space; placements are frame-relative)
  (spec.ch || []).forEach((c) => walk(c, 0, 0));
}
fs.writeFileSync(path.join(ROOT, "src/rect-manifest.json"), JSON.stringify(manifest, null, 1));

// Convert rect__*.png → webp (cap 2000px, q82)
const rects = fs.readdirSync(HARVEST).filter((f) => f.startsWith("rect__") && f.endsWith(".png"));
let n = 0;
for (const f of rects) {
  const out = path.join(OUT, f.replace(/\.png$/, ".webp"));
  if (fs.existsSync(out)) continue;
  await sharp(path.join(HARVEST, f), { limitInputPixels: 1e9 })
    .webp({ quality: 82, alphaQuality: 90, effort: 4 })
    .toFile(out);
  n++;
}
console.log("manifest frames:", Object.keys(manifest).length, "| rects converted:", n);
