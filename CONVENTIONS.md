# phantom-blade — section fidelity conventions

Goal: every section pixel-matches its Figma render. Design canvas is
1920×1080 (desktop `.stage--d`) and 375×812 (mobile `.stage--m`), scaled
by the cover-fit `.stage` system (see src/styles/base.css). Author all
positions/sizes in absolute design pixels inside the stage.

## References (absolute paths)
- Renders (ground truth):
  `../viture-pro2/harvest/minidock/render__Screen-XX-01__*.png` (1920×1080)
  Mobile: `render__375__Screen-XX-01__*.png` (375×812-ish)
- Spec JSON (exact node tree: text chars, fontSize, fontName, letter/line
  spacing, fills incl. gradient stops, per-node x/y/w/h relative to parent):
  `../viture-pro2/harvest/minidock/spec__Screen-XX-01__*.json`
- Image rectangles, exported exactly as Figma renders them (crop applied):
  `public/assets/rects/rect__<frameId>__<nodeId>.webp`
  Placement manifest (frame-relative absolute x/y/w/h per node id):
  `src/rect-manifest.json`
  NOTE: rects wider than 2000px were exported downscaled — always set CSS
  width/height from the manifest, not the file's intrinsic size.

## Rules
- Text: use exact `fontSize`, weight (Season Sans Light=300 / Regular=400 /
  Medium=500 / SemiBold=600 / Bold=700), and positions from the spec. The
  cream headline gradient is `linear-gradient(180deg,#fff,#ffdbbc)` via
  `.grad-head` (or local equivalent).
- Imagery: prefer the rect exports with manifest placements over guessed
  object-fit boxes.
- Backgrounds: sections sit on `rgba(2,2,2,0.9)` (fluid breathes under);
  any *baked* gradient/photo backdrop comes from its rect export.
- Never use one-sided `gsap.from()` for entrances — always `fromTo` with
  explicit ends (from() records poisoned end-values under hidden parents).
- Scrubbed/pinned timelines: keep `scrub`, `pin`, video-scrub calls intact;
  keep total timeline duration semantics (rest plateaus at the end).
- Mobile stage must be updated in the same edit (use `spec__375__…` +
  `render__375__…` refs; keep it visually faithful, bottom CTA bar exists
  globally in the header).

## QA loop (dev server already on :5174)
1. Edit section files under `src/sections/sXX/`.
2. `node scripts/qa-captures.mjs sXX` (add `--webkit` to cross-check).
3. Read `qa/sXX-sheet.png` — design on top, build below. Iterate until the
   composition, type scale, spacing and background read identical.
Pinned sections capture at a fixed representative progress (see PROGRESS in
scripts/qa-captures.mjs); you may add temporary entries for other beats,
e.g. `PROGRESS.s06 = 0.15`.

## Caching hand-cut assets

`/assets/(.*)` is served `immutable, max-age=31536000` for the frame
sequences, whose content never changes. The hand-cut UI crops in
`/assets/ui/` DO get re-cut under the same filename, so vercel.json gives
that path a revalidating policy instead (`max-age=600,
stale-while-revalidate=86400`). Even so, **bump a version suffix in the
filename when you re-cut one** (`loader-thread-2.png`): a client sat on a
stale, artefact-ridden `loader-thread.png` for days because the fix shipped
under the same name and their browser had it pinned for a year.
