// ---------------------------------------------------------------------------
// textfx — the site-wide ambient text-reveal language (client: "all the text
// animations are very boring — needs to be more elegant and ambient, with
// slow movement and fade effects").
//
// THE LANGUAGE
//   Headlines  split into WORDS and reveal with a slow unhurried drift:
//              opacity 0→1, drift ~24px→0 (via position:relative `top` —
//              paint-only, so line layout stays byte-identical to the
//              unsplit text), soft blur ~7px→0 per word, gentle per-word
//              stagger (~110ms), total ~1.4–1.9s, sine/power2.out.
//              Never snappy — the words condense out of the air.
//   Subheads / labels / chrome  reveal as a WHOLE BLOCK: soft fade + drift
//              (~1.2s), slightly delayed after their headline.
//
// API
//   prepareText(el, opts?)  — build-time hidden state. Splits the element
//       into .tfx-w word spans (idempotent; preserves <br> structure and
//       nested spans like .s02-strong), re-anchors .gtx gradient clipping
//       per word (see GRADIENTS below), and writes the hidden state as
//       PLAIN inline styles (opacity / transform / filter — never
//       visibility). mode:"block" skips splitting and hides the block.
//   revealText(el, opts?)   — returns an unattached gsap timeline that
//       plays the reveal; add it to an entrance timeline at any position
//       (`tl.add(revealText(el), 0.15)`) or play it standalone. On
//       complete it clears EVERY inline style it animated (clearProps),
//       so the rest state is exactly the stylesheet state.
//   scrubWordArrival(tl, el, at, opts?) — the same flavor for SCRUBBED
//       roll-ins (s14 ratchet, s16b/s22/s24 copy rolls): adds per-word
//       fromTo tweens (immediateRender:false, plain opacity) staggered
//       inside the timeline window starting at `at`. The container tween
//       keeps owning sequencing/visibility; this only restyles arrival.
//
// GHOST ARMOR (see s14/s16b/s23 headers — all rules kept):
//   - plain `opacity` only, NEVER autoAlpha / visibility: gsap-owned
//     visibility gets snapshotted by ScrollTrigger.refresh() rewinds and
//     parked inline (the s06/s16b "blank content" class of bug), and
//     inline visibility would override the sections' rect-based offscreen
//     guards ("inherit, never visible").
//   - time-based reveals end in gsap.set(clearProps): no gradient-clipped
//     text ever RESTS on an inline transform/filter/will-change (the stale
//     compositor-layer double-exposure recipe behind s16b round 8).
//   - prepared hidden state is written with plain style writes, not
//     gsap.set/from, so a refresh force-render has nothing to rewind.
//
// GRADIENTS (.gtx): background-clip:text does not survive per-word
//   animation (a word that gains its own layer via opacity/filter drops out
//   of the parent's clip on WebKit). So on split, the parent stops painting
//   (.tfx-split) and each word paints the SAME gradient re-anchored to the
//   parent's box: background-size = parent width, background-position =
//   -wordOffsetX, both in design px (measured via getBoundingClientRect and
//   un-scaled by the stage cover transform). 90deg gradients recompose
//   pixel-exactly; offsets re-sync on fonts.ready and window resize (the
//   other stage becomes measurable only after a breakpoint flip).
//
// ADOPTION GUIDE for the owned sections (apply after their agents land —
// mechanical, same recipe as the applied sections listed below):
//   s03  (pinned glass/frame scrub): its non-glass DOM copy beats are
//        scrubbed — use scrubWordArrival on the headline copy inside the
//        existing timeline windows; leave the WebGL glass text alone.
//   s11  (auto-build): its build timeline is time-based once triggered —
//        replace headline fromTo with prepareText at build time +
//        revealText added at the same label; keep the build's ratchet/once
//        semantics untouched.
//   s15  (entrance): prepareText(headline) in init, tl.add(revealText(...))
//        at the old tween's position; subheads via mode:"block".
//   s27  (finale pin): entrance chrome is time-based → prepareText/
//        revealText; anything owned by the pinned scrub keeps its
//        container tweens, restyled via scrubWordArrival.
//   s06  (card copy): the card content visibility is driven by applyRoll —
//        DO NOT add opacity tweens to .s06-ca/.s06-cb containers (see
//        scripts/assert-s06-card.mjs). Only the card's inner text lines may
//        use scrubWordArrival inside the existing roll windows, plain
//        opacity, never visibility.
//   In QA harness mode (?progress=…) sections skip entrances — skip
//   prepareText under the same flag or the copy stays hidden forever.
//
// Applied in this pass: s02, s05, s14 (ratchet beats), s16b (roll-ins),
// s20, s21, s22 (chrome + per-state roll-ins), s23 (headline arrival inside
// the bloom), s24 (text roll-ins), s25, s26 (card headings), header nav.
// ---------------------------------------------------------------------------
import "../styles/textfx.css";
import gsap from "gsap";

export interface TextfxOpts {
  /** "words" (default): split + per-word cascade. "block": whole-element
   *  soft fade + drift (subheads, labels, chrome). */
  mode?: "words" | "block";
  /** Drift distance in px (default 24 words / 18 block). Negative drifts
   *  downward-from-above (header). */
  y?: number;
  /** Peak blur in px (default 7 for word mode on heads of ≤ MAX_BLUR_WORDS
   *  words, else 0; always 0 for block mode). Pass explicitly to force. */
  blur?: number;
  /** Per-word tween duration (default 1.15 words / 1.2 block). */
  duration?: number;
  /** Per-word stagger seconds (default 0.11). */
  stagger?: number;
  /** Ease (default "power2.out"; the cascade's envelope reads sine-soft). */
  ease?: string;
}

/** Blur is applied per word span; beyond this word count the aggregate
 *  filter cost outweighs the effect (measured via scrollcheck FPS bands). */
const MAX_BLUR_WORDS = 12;

const reduced = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// QA A/B control (dev): ?notextfx disables the whole language — no split,
// no hidden state, no reveals — so rest states can be pixel-compared
// against the untouched rendering. No-op in production builds.
const disabled =
  import.meta.env.DEV &&
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).has("notextfx");

interface PrepState {
  words: HTMLElement[]; // empty in block mode
  opts: Required<Pick<TextfxOpts, "mode" | "y" | "blur" | "duration" | "stagger" | "ease">>;
}

const prepped = new WeakMap<HTMLElement, PrepState>();
/** Split .gtx elements needing gradient re-anchor syncs (fonts/resize). */
const gtxSplit = new Set<HTMLElement>();

function resolve(o: TextfxOpts | undefined, wordCount: number) {
  const mode = o?.mode ?? "words";
  const isWords = mode === "words";
  return {
    mode,
    y: o?.y ?? (isWords ? 24 : 18),
    blur:
      o?.blur ??
      (isWords && wordCount > 0 && wordCount <= MAX_BLUR_WORDS ? 7 : 0),
    duration: o?.duration ?? (isWords ? 1.15 : 1.2),
    stagger: o?.stagger ?? 0.11,
    ease: o?.ease ?? "power2.out",
  };
}

/** Split an element's text into .tfx-w word spans (idempotent). Preserves
 *  <br> and nested element structure; whitespace stays as text nodes so
 *  spacing/wrapping are untouched. Returns the word spans in DOM order. */
export function splitWords(el: HTMLElement): HTMLElement[] {
  if (el.dataset.tfxSplit)
    return Array.from(el.querySelectorAll<HTMLElement>(".tfx-w"));
  const words: HTMLElement[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? "";
      if (!text.trim()) return;
      const frag = document.createDocumentFragment();
      for (const part of text.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          const w = document.createElement("span");
          w.className = "tfx-w";
          w.textContent = part;
          frag.appendChild(w);
          words.push(w);
        }
      }
      node.parentNode?.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const e = node as HTMLElement;
      if (e.tagName === "BR") return;
      for (const child of Array.from(e.childNodes)) walk(child);
    }
  };
  for (const child of Array.from(el.childNodes)) walk(child);
  el.dataset.tfxSplit = "1";
  // gradient handoff — for el itself AND nested .gtx descendants (a caller
  // may split a whole copy block whose headline is the gradient element)
  const gtxEls = el.classList.contains("gtx")
    ? [el]
    : Array.from(el.querySelectorAll<HTMLElement>(".gtx"));
  for (const g of gtxEls) {
    if (!g.querySelector(".tfx-w")) continue;
    // Only words that INHERIT the .gtx transparent color take the gradient
    // clip — a nested span that overrides color (e.g. .s02-strong's solid
    // #fff) painted its own color before the split and must keep doing so.
    for (const w of g.querySelectorAll<HTMLElement>(".tfx-w")) {
      const c = getComputedStyle(w).color;
      if (c === "rgba(0, 0, 0, 0)" || c === "transparent")
        w.classList.add("tfx-g");
    }
    g.classList.add("tfx-split");
    gtxSplit.add(g);
    syncGradient(g);
  }
  return words;
}

/** Re-anchor every registered split gradient inside `root` (call before a
 *  reveal if fonts may have settled since the split). */
function syncGradientsIn(root: HTMLElement): void {
  for (const g of gtxSplit) if (root === g || root.contains(g)) syncGradient(g);
}

/** Re-anchor a split .gtx element's per-word gradients so they recompose the
 *  parent-box gradient exactly (design px; stage cover-scale factored out).
 *  No-op while the element is unmeasurable (display:none stage). */
function syncGradient(el: HTMLElement): void {
  if (!el.isConnected || el.offsetWidth === 0) return;
  const r = el.getBoundingClientRect();
  if (r.width === 0) return;
  const k = el.offsetWidth / r.width; // screen px → local design px
  const size = `${el.offsetWidth}px 100%`;
  for (const w of el.querySelectorAll<HTMLElement>(".tfx-w.tfx-g")) {
    const wr = w.getBoundingClientRect();
    w.style.backgroundSize = size;
    w.style.backgroundPosition = `${(-(wr.left - r.left) * k).toFixed(2)}px 0`;
  }
}

function syncAllGradients(): void {
  for (const el of gtxSplit) {
    if (!el.isConnected) gtxSplit.delete(el);
    else syncGradient(el);
  }
}

// word metrics settle when the real font arrives; breakpoint flips make the
// other stage measurable (main.ts refreshes ScrollTrigger on resize — this
// listener only re-anchors gradients, no layout writes beyond backgrounds)
if (typeof document !== "undefined" && document.fonts?.ready) {
  document.fonts.ready.then(() => syncAllGradients());
}
if (typeof window !== "undefined") {
  let raf = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(syncAllGradients);
  });
}

/** Build-time hidden state (plain inline styles, ghost-armor-friendly).
 *  Call once in init(); reveal later with revealText(el). Under
 *  prefers-reduced-motion this is a no-op (text simply present). */
export function prepareText(el: HTMLElement, opts?: TextfxOpts): void {
  if (disabled || reduced()) return;
  const words = opts?.mode === "block" ? [] : splitWords(el);
  const o = resolve(opts, words.length);
  prepped.set(el, { words, opts: o });
  if (o.mode === "block") {
    // whole-block: transform drift (blocks are stage-positioned, their
    // layout ignores transforms; cleared on reveal complete)
    el.style.opacity = "0";
    el.style.transform = `translateY(${o.y}px)`;
    el.style.willChange = "transform, opacity";
    return;
  }
  for (const t of words) {
    // words are display:inline — drift via position:relative `top`
    // (paint-only, keeps line layout byte-identical; see textfx.css)
    t.style.opacity = "0";
    t.style.top = `${o.y}px`;
    if (o.blur > 0) t.style.filter = `blur(${o.blur}px)`;
  }
}

/** The ambient reveal. Returns an unattached timeline — add it into an
 *  entrance timeline (`tl.add(revealText(el), 0.15)`) or `.play()` it.
 *  Ends by clearing every inline style it animated (clearProps), so the
 *  rest state is exactly the stylesheet state. */
export function revealText(
  el: HTMLElement,
  opts?: TextfxOpts,
): gsap.core.Timeline {
  const tl = gsap.timeline();
  const st = prepped.get(el);
  if (!st || reduced()) return tl; // unprepared / reduced-motion: no-op
  const o = { ...st.opts, ...opts };
  const targets = o.mode === "block" ? [el] : st.words;
  if (!targets.length) return tl;
  // late re-anchor: fonts may have settled after prepare
  if (o.mode !== "block") syncGradientsIn(el);
  const vars: gsap.TweenVars = {
    opacity: 1,
    duration: o.duration,
    ease: o.ease,
    stagger: o.stagger,
  };
  if (o.mode === "block") vars.y = 0;
  else vars.top = 0;
  if (o.blur > 0) vars.filter = "blur(0px)";
  tl.to(targets, vars, 0);
  tl.set(targets, { clearProps: "opacity,transform,top,filter,willChange" });
  return tl;
}

export interface ScrubArrivalOpts {
  /** Drift distance per word, px (default 26). */
  y?: number;
  /** Window length (timeline-time) the whole cascade occupies (default 0.3). */
  window?: number;
  /** Fraction of the window each word's own tween lasts (default 0.6). */
  wordSpan?: number;
  /** Ease per word (default "power2.out"). */
  ease?: string;
}

/** The same arrival flavor inside a SCRUBBED timeline: per-word fromTo
 *  tweens (plain opacity + y, immediateRender:false — deterministic in both
 *  scrub directions) staggered across `window` starting at `at`. The
 *  caller's container tween keeps owning overall sequencing/visibility;
 *  words simply cascade inside its arrival window. No filter here: scrub-
 *  driven blur re-rasterizes every scroll frame. Word spans hold inline
 *  opacity/transform at scrub rest like every other scrub-owned property —
 *  callers that ratchet to a final build (s14) should clearProps
 *  "transform" on the returned words once built. */
export function scrubWordArrival(
  tl: gsap.core.Timeline,
  el: HTMLElement,
  at: number,
  opts?: ScrubArrivalOpts,
): HTMLElement[] {
  if (disabled) return [];
  const words = splitWords(el);
  if (!words.length) return words;
  const y = opts?.y ?? 26;
  const win = opts?.window ?? 0.3;
  const span = Math.max(0.05, Math.min(1, opts?.wordSpan ?? 0.6));
  const ease = opts?.ease ?? "power2.out";
  const dur = win * span;
  const step = words.length > 1 ? (win - dur) / (words.length - 1) : 0;
  words.forEach((w, i) => {
    tl.fromTo(
      w,
      { opacity: 0, top: y },
      { opacity: 1, top: 0, duration: dur, ease, immediateRender: false },
      at + step * i,
    );
  });
  return words;
}
