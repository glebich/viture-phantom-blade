import type Lenis from "lenis";
import type { gsap as Gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { stopYs } from "./rests";

/* ---------------------------------------------------------------------------
 * chapternav.ts — the scroll stops on this site are the PAGES, nothing else.
 *
 * Client, with the thirteen frames marked: "this is exact pages where you
 * will able to stop automatically while you scrolling, and than scroll to
 * another page while you continue scrolling. precise on this moments not in
 * between not in any other pages. same for mobile."
 *
 * Two earlier attempts tried to keep free scrolling and correct it afterwards
 * — pull the scroll onto the nearest page once it had come to rest, then cap
 * how far one throw could travel. Both failed the same way: a correction that
 * arrives after the fact is either fighting the visitor (dragged backwards
 * whenever a swipe fell short) or holding them still (stuck until a throw
 * finally spent itself, then several pages at once).
 *
 * So the scroll is not corrected here, it is DRIVEN. Wheel, key and touch
 * input is taken before the smooth-scroller sees it and turned into one
 * instruction: go to the next page, or the previous one. Between those pages
 * the scroll is animated, which is what plays the film — the transitions are
 * the film, so travelling IS the motion, at a speed set here rather than by
 * how hard someone flicked.
 *
 * The trap in the second attempt was the momentum tail: a trackpad keeps
 * firing for hundreds of milliseconds after the fingers lift, and those
 * events used to queue up more jumps. Input is therefore blocked while a
 * journey is in flight, and every blocked event pushes the block further out,
 * so it only lifts once the stream has been genuinely silent. The next
 * deliberate swipe then fires immediately — nothing accumulates, nothing is
 * owed, so "stuck, then five pages" cannot happen.
 * ------------------------------------------------------------------------- */

// A trackpad keeps firing for up to a second after the fingers lift, so
// "wait for silence" made the visitor sit through the whole momentum tail
// before the next page would accept them — it read as stuck (client: "real
// hard to scroll past thru this pages, feels like it's just stock").
//
// A tail always DECAYS; a fresh push always ACCELERATES. So a new turn is
// recognised by its rising edge, or by a gap in the stream, and it is
// honoured the instant it arrives however much momentum is still running.
const GAP_MS = 110; // a pause this long means the next event starts a new turn
const SETTLE_MS = 60; // brief guard after landing, against one gesture double-firing
const WHEEL_TRIGGER = 18; // px of wheel delta that counts as a deliberate turn
const TOUCH_TRIGGER = 44; // px of finger travel that counts as a swipe
// The journey between two pages is the film playing, so its length sets the
// playback rate. One kept frame is ~43px of scroll and the clips are 30fps
// halved, so ~700px/s is close to real-time playback — at 1200px/s the
// transitions rushed (client: "it handles transitions very quickly now").
// The ceiling keeps the longest journey — the one that runs a whole
// transition chapter as well as its own — from becoming a wait.
const DUR_PER_PX = 1 / 700; // seconds of travel per px between pages
const DUR_MIN = 0.9;
const DUR_MAX = 3.5;

export function mountChapterNav(lenis: Lenis, gsap: typeof Gsap): void {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let stops: number[] = [];
  let index = 0;
  let animating = false;
  let blockedUntil = 0;
  let wheelAcc = 0;
  let prevAbs = Infinity; // |delta| of the previous wheel event
  let lastEventT = 0;

  const measure = () => {
    stops = stopYs();
    if (stops.length) index = nearest(lenis.animatedScroll ?? window.scrollY);
  };
  const nearest = (y: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const d = Math.abs(stops[i] - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };
  ScrollTrigger.addEventListener("refresh", measure);
  measure();

  const goTo = (i: number) => {
    if (!stops.length) return;
    const clamped = Math.max(0, Math.min(stops.length - 1, i));
    const from = lenis.animatedScroll ?? window.scrollY;
    const to = stops[clamped];
    if (Math.abs(to - from) < 2) {
      index = clamped;
      return;
    }
    index = clamped;
    animating = true;
    // the journey between two pages IS the film's playback, so its length
    // follows the distance rather than being a fixed beat
    const dur = Math.min(DUR_MAX, Math.max(DUR_MIN, Math.abs(to - from) * DUR_PER_PX));
    lenis.scrollTo(to, {
      duration: dur,
      force: true,
      lock: true,
      immediate: reduced,
      // quad in-out: eased at both ends but nearly linear through the middle,
      // so the film runs at a steady rate instead of surging (a cubic curve
      // spends its whole middle accelerating, which is what "acceleration"
      // reads as on a scrubbed clip)
      easing: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
      onComplete: () => {
        animating = false;
        blockedUntil = performance.now() + SETTLE_MS;
      },
    });
  };

  /** true when this input should be swallowed (journey in flight, or the
   *  brief guard just after landing) */
  const blocked = (now: number) => {
    if (animating || now < blockedUntil) {
      wheelAcc = 0;
      prevAbs = Infinity; // whatever is still arriving is a tail, not a turn
      return true;
    }
    return false;
  };

  // A turn moves to the next page in that direction FROM WHERE THE VISITOR
  // IS. Stepping the index instead skipped a page whenever the scroll was not
  // already parked on one — landing at the top, where the film's opening plays
  // below the first page, the very first swipe jumped past the hero.
  const step = (dir: number) => {
    const y = lenis.animatedScroll ?? window.scrollY;
    if (Math.abs((stops[index] ?? Infinity) - y) < 4) {
      goTo(index + dir);
      return;
    }
    if (dir > 0) {
      const i = stops.findIndex((s) => s > y + 4);
      goTo(i === -1 ? stops.length - 1 : i);
    } else {
      let i = -1;
      for (let k = stops.length - 1; k >= 0; k--) {
        if (stops[k] < y - 4) { i = k; break; }
      }
      goTo(i === -1 ? 0 : i);
    }
  };

  // ---- wheel / trackpad ----
  // capture phase so the smooth-scroller never sees it: this module is the
  // only thing allowed to move the page
  window.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      if (document.documentElement.classList.contains("menu-open")) return;
      e.preventDefault();
      e.stopPropagation();
      const now = performance.now();
      const a = Math.abs(e.deltaY);
      const gap = now - lastEventT > GAP_MS;
      lastEventT = now;
      if (blocked(now)) return;
      // a decaying stream is the last turn finishing; only a gap or a rising
      // edge means the visitor is asking for the next page
      const fresh = gap || a > prevAbs;
      prevAbs = a;
      if (!fresh && wheelAcc === 0) return;
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) < WHEEL_TRIGGER) return;
      const dir = wheelAcc > 0 ? 1 : -1;
      wheelAcc = 0;
      prevAbs = Infinity; // this turn is spent; the next needs its own rise
      step(dir);
    },
    { passive: false, capture: true }
  );

  // ---- keyboard ----
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (document.documentElement.classList.contains("menu-open")) return;
    const now = performance.now();
    let dir = 0;
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") dir = 1;
    else if (e.key === "ArrowUp" || e.key === "PageUp") dir = -1;
    else if (e.key === "Home") {
      e.preventDefault();
      if (!blocked(now)) goTo(0);
      return;
    } else if (e.key === "End") {
      e.preventDefault();
      if (!blocked(now)) goTo(stops.length - 1);
      return;
    }
    if (!dir) return;
    e.preventDefault();
    if (blocked(now)) return;
    step(dir);
  });

  // ---- touch (the client asked for the same behaviour on mobile) ----
  let touchY = 0;
  let touchAcc = 0;
  let touching = false;
  window.addEventListener(
    "touchstart",
    (e: TouchEvent) => {
      if (document.documentElement.classList.contains("menu-open")) return;
      touching = true;
      touchAcc = 0;
      touchY = e.touches[0]?.clientY ?? 0;
    },
    { passive: true, capture: true }
  );
  window.addEventListener(
    "touchmove",
    (e: TouchEvent) => {
      if (document.documentElement.classList.contains("menu-open")) return;
      e.preventDefault();
      e.stopPropagation();
      if (!touching) return;
      const y = e.touches[0]?.clientY ?? 0;
      touchAcc += touchY - y; // finger up = positive = forward
      touchY = y;
      const now = performance.now();
      if (blocked(now)) return;
      if (Math.abs(touchAcc) < TOUCH_TRIGGER) return;
      const dir = touchAcc > 0 ? 1 : -1;
      touchAcc = 0;
      step(dir);
    },
    { passive: false, capture: true }
  );
  const endTouch = () => {
    touching = false;
    touchAcc = 0;
  };
  window.addEventListener("touchend", endTouch, { passive: true, capture: true });
  window.addEventListener("touchcancel", endTouch, { passive: true, capture: true });

  // ---- outside navigation (the paginator dots) keeps the index honest ----
  lenis.on("scroll", () => {
    if (animating) return;
    const y = lenis.animatedScroll ?? window.scrollY;
    const i = nearest(y);
    if (Math.abs(stops[i] - y) < 4) index = i;
  });

  // a late-built pin can shift every position under us; re-seat on the page
  // the visitor is actually looking at
  gsap.ticker.add(() => {
    if (animating || !stops.length) return;
    const y = lenis.animatedScroll ?? window.scrollY;
    const i = nearest(y);
    if (i !== index && Math.abs(stops[i] - y) < 4) index = i;
  });
}
