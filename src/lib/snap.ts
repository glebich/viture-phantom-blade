// ---------------------------------------------------------------------------
// Global section magnetism (client round 11 — "needs MAGNET same as all
// other pages"): the pinned sections effectively always rest full-screen
// (their pin plateaus hold them there), but the unpinned 100vh screens
// (s02, s05, s11, s15, s18, s20, s21, s23, s25, s26 …) could rest with a
// fold mid-viewport. This module watches for the scroll coming to REST and,
// if the viewport top sits within a catch window (±35% of the viewport
// height) of a section boundary, glides it onto that boundary.
//
// Boundaries are the live document-space tops of every `section.screen`'s
// FLOW box — the pin-spacer for pinned sections — re-measured on every
// ScrollTrigger refresh (same pattern as main.ts's fluid palette centers),
// so they survive resizes, the late-built s06 pin, and the s01 loader
// retirement (which removes a full viewport of document above everything).
//
// Pin awareness: while the scroll rests INSIDE a pin's active range
// (st.start < y < st.end) we never snap — the pinned timeline's own rest
// plateaus own the feel there — EXCEPT:
// - within the first ~35%vh past the pin's start, which glides back to the
//   start so a pin entered by a hair still presents full-screen (just above
//   a pin start needs no special case: the start IS that section's
//   boundary);
// - within the catch window of a registered INTERIOR ANCHOR (client round
//   12 — "users scroll past the UltraClarity card too fast to read"): a
//   pinned section can expose specific scrub beats as magnet targets via
//   registerPinSnapAnchors(sectionId, fractions) — fractions of the pin's
//   scroll length, i.e. of the scrubbed timeline's progress. The nearest
//   in-window target (pin start or anchor) wins; the glide + one-shot
//   arming rules are identical, so anchors can never oscillate either.
//
// No fighting, no oscillation:
// - `lenis.scrollTo` is wrapped so any animated programmatic scroll (the
//   paginator navigation, the s01 auto-advance glide, our own snap glide)
//   raises an in-flight flag that suppresses evaluation until it completes.
//   Lenis routes USER wheel input through the same method with
//   `programmatic: false` — that path clears the flag instead (user input
//   always wins; Lenis itself already interrupts the animation).
// - Snapping only arms on real user input (wheel / scroll keys). After one
//   rest evaluation — whether it glided or decided to stay — it disarms
//   until the next input, so a completed snap can never re-trigger itself.
// - QA scripts that drive `window.scrollTo` natively never arm it.
//
// Gates (mirrors scrollfx): not mounted on touch devices (native momentum
// feels wrong to hijack) or in the `?only=` QA harness / with `?nosnap`
// (caller gates those). Under prefers-reduced-motion the magnet still works
// but jumps instantly instead of gliding.
// ---------------------------------------------------------------------------
import type Lenis from "lenis";
import type { ScrollToOptions } from "lenis";
import { allRestYs } from "./rests";
import type { gsap as Gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Client round 9 ("scroll too easy… need to have magnet"): full-viewport
// magnet. At ±50%vh EVERY possible rest position between unpinned pages is
// inside some boundary's catch window, so the scroll always parks a page
// full-frame — nothing can rest half-folded anymore. Pin interiors are
// untouched (their plateaus + registered anchors own the feel there).
// Client: "I scroll and I miss pages and scroll thru them — add a magnet so
// it feels like the site is helping me stop at the next page." Nearly every
// chapter here is a LONG pinned scrub, and the old rule was "never snap
// inside a pin", so the magnet effectively never fired: a flick sailed past
// whole chapters. The targets are now the chapters' registered reading
// positions (rests.ts) — copy in, film settled — which is exactly where a
// reader wants to be parked, and they live inside the pins.
//
// The reads sit 1.4k-5k px apart, so a one-viewport catch left most of them
// stranded: the magnet fell through to the pin STARTS instead, which is the
// transition rather than the page. Three viewports covers even the widest
// gap from either side, so wherever a flick happens to stop, some chapter's
// read is pulling — the scroll always ends up ON a page. It only ever fires
// once the scroll has come to REST after real input, so scrubbing a film by
// hand is never interrupted.
const CATCH_VH = 3.0;
// ---- gesture clamp ----
// Landing tidily was not enough: the magnet parked on a read every time, but
// a hard trackpad flick still carried THROUGH two chapters first, and a very
// hard one through five (client, twice: "I scroll thru pages without the
// ability to stop on pages with text and content"). So a single throw is now
// capped at ONE chapter: whatever momentum it carries, the scroll is caught
// at the next read in the direction of travel. Flick again to go on — pages
// can no longer be lost, and repeated flicks still move quickly.
const GESTURE_GAP_MS = 160; // wheel quiet for this long = a new throw
const GESTURE_LIVE_MS = 500; // how long after the last event a throw can clamp
const EDGE_PX = 24; // ignore the read you are already sitting on
const CLAMP_S = 0.85; // glide onto the caught read

const REST_MS = 120; // scroll must be still this long to count as resting
const SETTLED_PX = 2; // closer than this to a boundary = already there
const MOVE_EPS = 0.08; // px/frame under which the scroll counts as still
const GLIDE_S = 0.7; // snap glide duration
const PROG_STALL_MS = 700; // in-flight flag safety: an "animated" scroll
// resting this long was interrupted (its onComplete will never fire)

// ---- interior pin anchors ----
// sectionId -> fractions of the pin's scroll length (== scrubbed-timeline
// progress, the pins here all normalize total duration to 1). Sections
// register in their init() — that runs before mountSnap, and the registry
// is plain data, so registration is safe even when the magnet never mounts
// (touch, ?nosnap, QA harness). Absolute positions are resolved per refresh
// in measure() from the live ScrollTrigger, so they survive resizes and the
// s01 retirement shift like every other boundary.
const pinAnchorFractions = new Map<string, number[]>();
export function registerPinSnapAnchors(
  sectionId: string,
  fractions: number[]
): void {
  pinAnchorFractions.set(sectionId, fractions);
}

export function mountSnap(lenis: Lenis, gsap: typeof Gsap): void {
  // touch scrolls natively through Lenis — never hijack finger momentum
  if (matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- geometry, re-measured on every ScrollTrigger refresh ----
  let targets: number[] = [];
  let boundaries: number[] = [];
  let pinRanges: { start: number; end: number; anchors: number[] }[] = [];
  const measure = () => {
    const y = window.scrollY;
    boundaries = Array.from(
      document.querySelectorAll<HTMLElement>("section.screen")
    )
      .filter((el) => el.isConnected)
      .map((el) => {
        // pinned sections translate inside their pin-spacer — the spacer is
        // the flow box whose top is the section's real document position
        const box = el.parentElement?.classList.contains("pin-spacer")
          ? el.parentElement
          : el;
        return y + box.getBoundingClientRect().top;
      });
    // chapter reads first; section tops are the fallback for anything that
    // never registered one (an unpinned screen, or a chapter mid-build)
    targets = allRestYs();
    pinRanges = ScrollTrigger.getAll()
      .filter(
        (st) =>
          !!st.vars.pin &&
          st.trigger instanceof Element &&
          st.trigger.isConnected
      )
      .map((st) => {
        const id =
          (st.trigger as Element).closest?.("section.screen")?.id ?? "";
        return {
          start: st.start,
          end: st.end,
          anchors: (pinAnchorFractions.get(id) ?? []).map(
            (f) => st.start + f * (st.end - st.start)
          ),
        };
      });
  };
  ScrollTrigger.addEventListener("refresh", measure);

  // ---- state ----
  let armed = false; // true only after fresh user input
  let programmatic = false; // an animated scrollTo is in flight
  let pointerHeld = false; // mouse button down (scrollbar drag etc.)
  let lastInputT = 0;
  let restMs = 0;
  let lastY = window.scrollY;

  // ---- gesture bookkeeping for the clamp ----
  let gestureFrom = window.scrollY; // where this throw began
  let gestureT = 0; // timestamp of the last wheel event
  let caught: number | null = null; // read this throw was caught on

  const arm = () => {
    armed = true;
    lastInputT = performance.now();
  };
  window.addEventListener(
    "wheel",
    () => {
      const now = performance.now();
      // a trackpad emits a continuous stream (fingers plus momentum), so a
      // throw is delimited by a gap in that stream rather than by one event
      if (now - gestureT > GESTURE_GAP_MS) {
        gestureFrom = lenis.animatedScroll ?? window.scrollY;
        caught = null; // a new throw may advance again
      }
      gestureT = now;
      arm();
    },
    { passive: true }
  );
  const SCROLL_KEYS = new Set([
    "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ",
  ]);
  window.addEventListener("keydown", (e) => {
    if (SCROLL_KEYS.has(e.key)) arm();
  });
  window.addEventListener("pointerdown", () => (pointerHeld = true), {
    passive: true,
  });
  const release = () => (pointerHeld = false);
  window.addEventListener("pointerup", release, { passive: true });
  window.addEventListener("pointercancel", release, { passive: true });

  // ---- programmatic-scroll tracking: wrap the instance method so EVERY
  // caller (paginator, s01 auto-advance/retirement, our own glide) is
  // covered without touching their code. Lenis's own user-input path also
  // lands here (onVirtualScroll calls this.scrollTo with programmatic:
  // false), which is exactly the "user took over" signal we want. ----
  const orig = lenis.scrollTo.bind(lenis);
  lenis.scrollTo = (
    target: number | HTMLElement | string,
    options: ScrollToOptions = {}
  ) => {
    if (options.programmatic === false) {
      // real user input funneled through Lenis — it interrupts any running
      // animation itself; our job is just to drop the suppression and re-arm
      programmatic = false;
      arm();
      return orig(target, options);
    }
    if (options.immediate) {
      // instant jumps (s01 retirement compensation, harness resets) end any
      // in-flight animation via lenis.reset(); arming is left as-is so a
      // user rest position carried across the s01 retirement still magnetizes
      programmatic = false;
      return orig(target, options);
    }
    programmatic = true;
    armed = false; // navigation supersedes any pending evaluation
    const done = options.onComplete;
    return orig(target, {
      ...options,
      onComplete: (l: Lenis) => {
        programmatic = false;
        done?.(l);
      },
    });
  };

  // ---- the magnet ----
  const glide = (target: number) => {
    armed = false; // settled after this — only new input re-arms
    lenis.scrollTo(target, {
      duration: GLIDE_S,
      immediate: reduced, // reduced motion: jump, don't animate
      // gentle quad easeInOut — softer than the paginator's long glide
      easing: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
    });
  };

  const evaluate = (y: number) => {
    const catchPx = window.innerHeight * CATCH_VH;

    // 1. the chapter reads — the stops the visitor actually wants. These sit
    //    INSIDE the pins, so they are tried before the pin-interior rule
    //    below (which exists for pins that never registered a rest).
    {
      let best = NaN;
      let bestD = Infinity;
      for (const t of targets) {
        const d = Math.abs(y - t);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      if (Number.isFinite(best) && bestD > SETTLED_PX && bestD <= catchPx) {
        glide(best);
        return;
      }
      // already parked on a read: nothing to do, and re-gliding on jitter
      // would fight the visitor
      if (Number.isFinite(best) && bestD <= SETTLED_PX) return;
    }

    for (const p of pinRanges) {
      if (y > p.start + SETTLED_PX && y < p.end - SETTLED_PX) {
        // resting inside an active pin range: the first ~35%vh pulls back
        // to the pin's start, and registered interior anchors (scrub rest
        // beats, e.g. s06's card plateaus) attract within the same catch
        // window — nearest in-window target wins. Deeper in with no anchor
        // near, the pinned timeline's own rest plateaus are the intended
        // stops — do nothing.
        let best = NaN;
        let bestD = Infinity;
        if (y - p.start <= catchPx) {
          best = p.start;
          bestD = y - p.start;
        }
        for (const a of p.anchors) {
          const d = Math.abs(y - a);
          if (d <= catchPx && d < bestD) {
            bestD = d;
            best = a;
          }
        }
        // bestD <= SETTLED_PX: already resting on the target — gliding
        // again would re-run the settle forever on micro-jitter
        if (Number.isFinite(best) && bestD > SETTLED_PX) glide(best);
        return;
      }
    }
    let best = NaN;
    let bestD = Infinity;
    for (const b of boundaries) {
      const d = Math.abs(y - b);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (!Number.isFinite(best) || bestD <= SETTLED_PX || bestD > catchPx)
      return; // on a boundary already, or resting beyond the catch window
    glide(best);
  };

  const holdAt = (to: number, duration: number) => {
    lenis.scrollTo(to, {
      duration,
      lock: true,
      force: true,
      immediate: reduced,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
    });
  };

  // catch a throw the moment its target overshoots the next read
  const clampGesture = (): boolean => {
    if (programmatic && caught === null) return false;
    if (pointerHeld) return false;
    const now = performance.now();

    // Already caught this throw: HOLD the read until the input stream stops.
    // Catching once was not enough — a trackpad keeps firing for hundreds of
    // milliseconds after the fingers lift, and that tail simply resumed the
    // scroll and sailed on through three more chapters. Re-asserting the
    // caught position for as long as the same throw is still arriving is what
    // actually makes one flick equal one chapter.
    if (caught !== null) {
      if (now - gestureT > GESTURE_GAP_MS) {
        caught = null; // the throw is spent; the next one may advance
        return false;
      }
      const t = lenis.targetScroll ?? window.scrollY;
      if (Math.abs(t - caught) > 2) holdAt(caught, 0.22);
      return true;
    }

    if (now - gestureT > GESTURE_LIVE_MS) return false;
    const target = lenis.targetScroll ?? window.scrollY;
    const travel = target - gestureFrom;
    if (Math.abs(travel) < 4 || !targets.length) return false;
    const limit =
      travel > 0
        ? targets.find((t) => t > gestureFrom + EDGE_PX)
        : [...targets].reverse().find((t) => t < gestureFrom - EDGE_PX);
    if (limit === undefined) return false;
    const overshoots = travel > 0 ? target > limit + 2 : target < limit - 2;
    if (!overshoots) return false;
    caught = limit;
    armed = false;
    holdAt(limit, CLAMP_S);
    return true;
  };

  gsap.ticker.add((_time, deltaTime) => {
    if (clampGesture()) return;
    const y = lenis.scroll ?? window.scrollY;
    const dy = y - lastY;
    lastY = y;
    if (Math.abs(dy) > MOVE_EPS) {
      restMs = 0;
      return;
    }
    restMs += deltaTime;
    if (programmatic) {
      // an interrupted animated scrollTo never fires onComplete — a long
      // stationary spell while "in flight" means it is dead; release
      if (restMs > PROG_STALL_MS) programmatic = false;
      return;
    }
    if (!armed || pointerHeld) return;
    if (restMs < REST_MS) return;
    if (performance.now() - lastInputT < REST_MS) return; // key still held
    armed = false; // one evaluation per input burst — no loops
    evaluate(y);
  });
}
