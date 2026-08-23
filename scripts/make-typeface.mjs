// Season Sans Regular (woff2) → three.js typeface JSON, subset to the s06
// glass glyphs. Coords stay in font units; resolution = unitsPerEm (three
// scales by size/resolution). 'q'/'b' arg order per three FontLoader:
// END point first, then control point(s).
import { readFile, writeFile } from "fs/promises";
import wawoff2 from "wawoff2";
import opentype from "opentype.js";

const CHARS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%.,·—’ "];
const ttf = await wawoff2.decompress(await readFile("public/fonts/SeasonSans-Regular.woff2"));
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
const glyphs = {};
for (const ch of new Set(CHARS)) {
  const g = font.charToGlyph(ch);
  if (!g || g.index === 0) { console.warn("missing glyph", ch); continue; }
  let o = "";
  for (const c of g.path.commands) {
    if (c.type === "M") o += `m ${c.x} ${c.y} `;
    else if (c.type === "L") o += `l ${c.x} ${c.y} `;
    else if (c.type === "Q") o += `q ${c.x} ${c.y} ${c.x1} ${c.y1} `;
    else if (c.type === "C") o += `b ${c.x} ${c.y} ${c.x1} ${c.y1} ${c.x2} ${c.y2} `;
    else if (c.type === "Z") o += "z ";
  }
  glyphs[ch] = { ha: Math.round(g.advanceWidth), x_min: g.xMin ?? 0, x_max: g.xMax ?? g.advanceWidth, o: o.trim() };
}
const data = {
  glyphs,
  familyName: "Season Sans",
  ascender: font.ascender,
  descender: font.descender,
  underlinePosition: -100,
  underlineThickness: 50,
  boundingBox: { yMin: font.tables.head.yMin, xMin: font.tables.head.xMin, yMax: font.tables.head.yMax, xMax: font.tables.head.xMax },
  resolution: font.unitsPerEm,
  original_font_information: { format: 0 },
};
await writeFile("src/lib/season-regular.typeface.json", JSON.stringify(data));
console.log("glyphs:", Object.keys(glyphs).join(""), "| unitsPerEm:", font.unitsPerEm);
