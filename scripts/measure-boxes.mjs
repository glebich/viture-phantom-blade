/* Measure the design coordinates of the red-bordered elements (framed
 * screens, OSD panel, relic cards) straight off a Figma frame capture, so
 * placements are never eyeballed.
 *
 *   node scripts/measure-boxes.mjs harvest/full2x/d15.png 1920
 *
 * Prints the box in DESIGN px. It works by finding the longest contiguous
 * run of border-red pixels per column/row: the panel's left/right borders
 * are the outermost such columns, and the vertical extent is the union of
 * their runs (a border dims where it crosses bright artwork, so a single
 * column under-reports the top edge).
 *
 * For assets whose png carries transparent bloom margins (osd.png), pass a
 * target width to get the element box that lands the INNER panel on the
 * design coordinates:
 *
 *   node scripts/measure-boxes.mjs public/assets/ui/osd.png asset 673 340 575
 */
import sharp from "sharp";

const [file, arg2, tx, ty, tw] = process.argv.slice(2);
if (!file) {
  console.error("usage: measure-boxes.mjs <file> <designW|asset> [tx ty tw]");
  process.exit(1);
}

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const C = info.channels;
const isRed = (i) =>
  data[i + 3] > 110 && data[i] > 125 && data[i] - data[i + 1] > 55 && data[i] - data[i + 2] > 55;

const run = (get, n) => {
  let best = 0, bs = 0, cur = 0, cs = 0;
  for (let k = 0; k < n; k++) {
    if (isRed(get(k))) {
      if (!cur) cs = k;
      cur++;
      if (cur > best) { best = cur; bs = cs; }
    } else cur = 0;
  }
  return [best, bs];
};

const cols = [];
for (let x = 0; x < info.width; x++) {
  const [len, start] = run((y) => (y * info.width + x) * C, info.height);
  if (len > info.height * 0.15) cols.push({ x, len, start });
}
if (!cols.length) {
  console.error("no vertical border found — loosen the red test");
  process.exit(2);
}
const L = cols[0], R = cols[cols.length - 1];
const top = Math.min(L.start, R.start);
const bottom = Math.max(L.start + L.len - 1, R.start + R.len - 1);
const px = { left: L.x, top, width: R.x - L.x + 1, height: bottom - top + 1 };

if (arg2 === "asset") {
  const k = Number(tw) / px.width;
  console.log(`panel inside asset: ${px.left},${px.top} ${px.width}x${px.height}`);
  console.log("element box (design px):");
  console.log(`  left: ${Math.round(Number(tx) - px.left * k)}px;`);
  console.log(`  top: ${Math.round(Number(ty) - px.top * k)}px;`);
  console.log(`  width: ${Math.round(info.width * k)}px;`);
  console.log(`  height: ${Math.round(info.height * k)}px;`);
} else {
  const S = info.width / Number(arg2 || 1920);
  const d = (v) => Math.round(v / S);
  console.log(`design box: ${d(px.left)},${d(px.top)} ${d(px.width)}x${d(px.height)}`);
}
