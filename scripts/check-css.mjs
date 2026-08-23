// Fails if the BUILT css bundle doesn't parse cleanly.
//
// Why this exists: src/styles/scrollfx.css once held a verbatim copy of the
// scrollfx TypeScript module. In dev Vite injects each CSS module separately,
// so only that one file was discarded and everything else worked — every local
// check passed. In the production bundle the stylesheets are concatenated, and
// the two unclosed braces in the pasted code swallowed every rule after them:
// the shipped site rendered with almost no CSS. Dev-only verification cannot
// catch that class of bug, so the bundle is checked directly.
//
// Usage: node scripts/check-css.mjs   (runs as part of `npm run build`)
import fs from "fs";
import path from "path";

const dir = "dist/assets";
if (!fs.existsSync(dir)) {
  console.error("check-css: no dist/assets — build first");
  process.exit(1);
}
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".css"));
if (!files.length) {
  console.error("check-css: no css emitted");
  process.exit(1);
}

let failed = false;
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  let depth = 0;
  let i = 0;
  let str = null;
  let line = 1;
  const opens = [];
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\n") line++;
    if (str) {
      if (ch === "\\") { i += 2; continue; }
      if (ch === str) str = null;
      i++;
      continue;
    }
    if (s.startsWith("/*", i)) {
      const j = s.indexOf("*/", i + 2);
      i = j > 0 ? j + 2 : s.length;
      continue;
    }
    if (ch === '"' || ch === "'") { str = ch; i++; continue; }
    if (ch === "{") { depth++; opens.push(line); }
    else if (ch === "}") {
      depth--;
      opens.pop();
      if (depth < 0) {
        console.error(`check-css: ${f} has an extra "}" at line ${line}`);
        failed = true;
        break;
      }
    }
    i++;
  }
  if (depth > 0) {
    console.error(
      `check-css: ${f} ends with ${depth} unclosed block(s), opened at line(s) ${opens.join(", ")}` +
        ` — every rule after them is swallowed`
    );
    failed = true;
  }
  // a bundle this size should carry hundreds of rules; a handful means it was
  // truncated even if the braces happen to balance
  const rules = (s.match(/\{/g) || []).length;
  if (!failed && rules < 120) {
    console.error(`check-css: ${f} only has ${rules} rules — looks truncated`);
    failed = true;
  }
  if (!failed) console.log(`check-css: ${f} ok (${rules} rules, ${s.length} bytes)`);
}
process.exit(failed ? 1 : 0);
