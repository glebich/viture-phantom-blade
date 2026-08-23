// Convert harvested Figma image fills into optimized site assets.
// Run with viture-pro2's sharp: node minidock/scripts/prep-images.mjs
import sharp from "sharp";
import fs from "fs";
import path from "path";

const HARVEST =
  "/Users/gleb/Dropbox (Personal)/Osyle/WEBSITE/viture-pro2/harvest/minidock";
const OUT =
  "/Users/gleb/Dropbox (Personal)/Osyle/WEBSITE/minidock/public/assets/img";
fs.mkdirSync(OUT, { recursive: true });

// hash → { name, width (resize target), quality }
const MAP = {
  "612a5e313c9f3d1d9b990059dfc0914080f573bd": { name: "hero-dock-blur", w: 1400 },
  "2b1de73c9a5b935833e1d94113413b54f2984bc6": { name: "hero-console-blur", w: 1900 },
  "0f29d89900f3f4e3c8983a17c911a5b55f8e229f": { name: "bg-horizon", w: 2400, q: 76 },
  b5de71a628d13d75d4ee9a45e0a08bec03cf5b1a1: null, // placeholder — resolved below by prefix
};

// resolve actual filenames by hash prefix
const files = fs.readdirSync(HARVEST).filter((f) => f.startsWith("img__"));
const byPrefix = (p) => files.find((f) => f.includes(p));

const JOBS = [
  ["612a5e313c9f", "hero-dock-blur", 1400, 82, true],
  ["2b1de73c9a5b", "hero-console-blur", 1900, 82, true],
  ["0f29d89900f3", "bg-horizon", 2400, 74, false],
  ["b5de71a628d1", "dock-cable", 1700, 84, true],
  ["92f2e5a6bf36", "hands-switch", 1700, 82, true],
  ["e824c5b93426", "kv-hand-dock", 2200, 80, false],
  ["24497fa64e1f", "dock-float", 900, 84, true],
  ["f0917ef02291", "kv-glasses-dock", 900, 84, true],
  ["70a1c8f003f4", "bg-kinetic", 2000, 76, false],
  ["8b7fd4c3060d", "dock-ports-profile", 1700, 84, true],
  ["25fd10a64d29", "mount-01", 1400, 84, true],
  ["b73788cd93fc", "mount-03", 1400, 84, true],
  ["5150cdbfa6bf", "dock-mini-wip", 1500, 84, true],
  ["db410dbaec40", "lifestyle-video-still", 1400, 80, false],
  ["7230a25fef60", "kv-glasses-dock-2", 1000, 84, true],
  ["ec9119f6dab2", "solo-thumb", 500, 82, false],
  ["722ed866d084", "solo-thumb-b", 400, 82, false],
  ["1f6a5e0e3e7a", "extra-1f6a", 1600, 82, true],
  ["0622d6e674ee", "extra-0622", 1600, 80, false],
  ["01f48729ae59", "extra-01f4", 1200, 82, true],
  ["33e95cd13030", "extra-33e9", 1200, 82, true],
  ["41084a131662", "extra-4108", 1200, 82, true],
];

for (const [prefix, name, w, q, keepAlpha] of JOBS) {
  const src = byPrefix(prefix);
  if (!src) { console.log("MISS", prefix, name); continue; }
  const img = sharp(path.join(HARVEST, src), { limitInputPixels: 1e9 });
  const meta = await img.metadata();
  const width = Math.min(w, meta.width || w);
  const out = path.join(OUT, name + ".webp");
  await img
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: q, alphaQuality: 90, effort: 5 })
    .toFile(out);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log("OK", name, width + "px", kb + "KB", meta.hasAlpha ? "alpha" : "");
}
console.log("DONE");
