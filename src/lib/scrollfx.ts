// ---------------------------------------------------------------------------
// Velocity-reactive stage parallax (client round 8 — replaces the round-6
// skewY: the shear read as "images bend / aren't straight" at speed, so the
// same velocity signal now drives a small RECTILINEAR vertical lag instead).
//
// On every ticker frame we derive the scroll velocity, smooth it, and write
// a tiny translateY (±MAX_PAR px — content trails the scroll, then springs
// back) onto the `.stage` elements of sections currently near the viewport,
// as an INLINE transform. The lag is PREPENDED to base.css's cover-transform
// so it stays in screen px, unaffected by the stage cover scale:
//   translateY(…px) translate(-50%, -50%) scale(var(--s))
// Inline (rather than a CSS custom property) on purpose: transform is not
// inherited, so the style recalc stays scoped to the stage element itself —
// a CSS variable invalidated the stage's entire subtree every frame and
// halved scroll FPS. Active stages also get `.fx-on` (will-change:
// transform, see scrollfx.css) so the update is composite-only instead of a
// full repaint of blur-heavy 1920x1080 stage content. Removing the inline
// style returns the stage to the untouched base.css rule, so the stage
// scaling system is never forked.
//
// Feel: imperceptible at cruise (~2px), a clear-but-calm trail on flicks
// (clamped at ±MAX_PAR), springs back to exactly 0 with an asymmetric
// release lerp when input stops — content is always axis-aligned, no shear.
// The ±10px ceiling matches the edge displacement the old ±0.55deg skew
// already produced at the stage corners, so fold/seam exposure of the
// ambient fluid backdrop is no worse than before.
//
// Disabled entirely for touch devices, prefers-reduced-motion, and the
// `?only=` QA harness + `?nofx` (caller gates those).
// ---------------------------------------------------------------------------
import "../styles/scrollfx.css";
import type Lenis from "lenis";
import type { gsap as Gsap } from "gsap";

const MAX_PAR = 10; // px — ceiling reached only on hard flicks
const VEL_TO_PAR = 0.2; // px of lag per px-per-frame(60) of scroll velocity
const ATTACK = 0.16; // lerp toward target while velocity builds
const RELEASE = 0.09; // softer lerp back to 0 (the "spring back")
const EPS = 0.03; // px — below this the effect is considered settled
const NEAR_VH = 0.35; // sections within ±35% viewport beyond edges get FX

export function mountScrollFx(lenis: Lenis, gsap: typeof Gsap): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // touch: Lenis passes touch scroll through natively (no smoothing), so
  // velocity would be janky — and the lag reads wrong under a finger.
  if (matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) return;

  interface Entry {
    section: HTMLElement;
    stages: HTMLElement[];
  }
  const entries: Entry[] = Array.from(
    document.querySelectorAll<HTMLElement>("section.screen")
  ).map((section) => ({
    section,
    stages: Array.from(
      section.querySelectorAll<HTMLElement>(":scope > .stage")
    ),
  }));

  let current = 0; // smoothed lag actually applied (px)
  let idle = true; // true once settled — makes the ticker a no-op
  let lastY = window.scrollY;
  const touched = new Set<HTMLElement>(); // stages carrying an inline lag

  const apply = (lag: number) => {
    const vh = window.innerHeight;
    const margin = vh * NEAR_VH;
    // fold-seam guard: a lagged stage would expose a |lag|-px strip of the
    // ambient canvas at section edges (screens clip their stages), reading
    // as a dark hairline crack at folds mid-flick. Counter it with a
    // proportional overscale — (1 + 2|lag|/renderedStageHeight, ~1.9% at
    // the ±10px ceiling) — so the shifted stage still covers its section;
    // it eases in/out with the same lerp as the lag, imperceptible at speed.
    const cs = getComputedStyle(document.documentElement);
    const s = parseFloat(cs.getPropertyValue("--s")) || 1;
    const sh = parseFloat(cs.getPropertyValue("--stage-h")) || 1080;
    const value = `translateY(${lag.toFixed(2)}px) translate(-50%, -50%) scale(var(--s))`;
    const near = new Set<HTMLElement>();
    for (const { section, stages } of entries) {
      if (!stages.length) continue;
      // the s01 loader is removed from the document after the intro
      // hand-off (round 8) — skip detached sections
      if (!section.isConnected) continue;
      // live rendered rect — correct for pinned sections, which GSAP holds
      // fixed in the viewport inside their pin-spacer
      const r = section.getBoundingClientRect();
      if (r.bottom < -margin || r.top > vh + margin) continue;
      for (const st of stages) {
        near.add(st);
        if (!touched.has(st)) {
          st.classList.add("fx-on"); // compositor promotion, see scrollfx.css
          touched.add(st);
        }
        st.style.transform = value;
      }
    }
    // stages that scrolled out of range fall back to the base.css transform
    for (const st of touched) {
      if (!near.has(st)) {
        st.style.removeProperty("transform");
        st.classList.remove("fx-on");
        touched.delete(st);
      }
    }
  };

  const settle = () => {
    // drop the inline lag but KEEP .fx-on on the current members: the next
    // scroll starts on already-promoted layers (no repaint spike). Membership
    // is re-culled on the next activity, so the set stays ~2-4 stages.
    for (const st of touched) st.style.removeProperty("transform");
    current = 0;
    idle = true;
  };

  gsap.ticker.add((_time, deltaTime) => {
    const y = lenis.scroll ?? window.scrollY;
    // px per 60fps-frame, normalized so feel is framerate-independent
    const frames = Math.max(0.25, deltaTime / (1000 / 60));
    const v = (y - lastY) / frames;
    lastY = y;

    // content trails the scroll: scrolling down leaves the imagery a few px
    // low (it hasn't "caught up" yet), then it eases home — pure translateY,
    // so everything stays rectilinear
    const target = Math.max(-MAX_PAR, Math.min(MAX_PAR, v * VEL_TO_PAR));
    const k = Math.abs(target) > Math.abs(current) ? ATTACK : RELEASE;
    current += (target - current) * Math.min(1, k * frames);

    if (Math.abs(current) < EPS && Math.abs(target) < EPS) {
      if (!idle) settle();
      return; // idle — no layout reads, no style writes
    }
    idle = false;
    apply(current);
  });
}
