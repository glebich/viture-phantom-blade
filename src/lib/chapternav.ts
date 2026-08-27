import type Lenis from "lenis";
import type { gsap as Gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { stopYs, filmFramesBetween } from "./rests";

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
const TOUCH_TRIGGER = 32; // px of finger travel that counts as a swipe
// A journey's length and the film's playback rate are the same number — the
// film is scrubbed off scroll position — so "quicker transitions" and "don't
// speed up the background" pull against each other. The EASING is what
// separates them, and its SHAPE matters more than its length.
//
// The trapezoid this replaces held one steady speed through the middle, which
// is even-handed but reads as trudging, and it stopped on a constant
// deceleration — no settle (client: "transition is moving too slow, need to
// have easing and slowing down at the end").
//
// So the journey is front-loaded: a brief ramp, a short push at speed, then
// more than half the time spent easing down into the page. Ground is covered
// early, which is what makes a move feel quick, and the arrival drifts to a
// stop instead of arriving at a fixed rate and halting.
// Paced by FILM, not by distance (client: "first 5 sections playing too
// fast and rest of the web site is actually too slow" — one cause: the film
// is not spread evenly across the page). A journey that plays footage takes
// the time that footage needs at just over natural speed; a journey across
// rest plateaus has nothing to show and shouldn't dawdle.
//
//   film journeys   0.5s + frames/30  (30 kept-frames/s = the clip's natural
//                   rate; the intro's 122 frames get ~4.6s instead of being
//                   crushed into a distance-capped 3.4)
//   empty journeys  0.5s + px/1500 — brisk, since nothing changes mid-way
const FILM_BASE = 0.5;
const FILM_FPS = 30; // natural playback of the 30-kept-fps sequences
const FILM_MIN = 0.9;
const FILM_MAX = 5.0;
const EMPTY_PER_PX = 1 / 1500;
const EMPTY_MIN = 0.6;
const EMPTY_MAX = 2.2;
const RAMP = 0.1; // getting under way
const CRUISE_END = 0.45; // where the long deceleration begins
const DECAY = 1.3; // shape of that deceleration — higher settles later
const AREA =
  RAMP / 2 + (CRUISE_END - RAMP) + (1 - CRUISE_END) / (DECAY + 1);
// The decay tail approaches zero velocity but never REACHES it, so the last
// stretch of every journey crept at ~100px/s — imperceptible as scroll, but
// the film maps px to frames far more densely than the eye maps them to
// motion, and in a film-dense pin that creep still plays several frames a
// second AFTER the page has visibly stopped (client, on the glasses case:
// "it stop and than it's play for 0.4 sec again"). At 15fps the judder
// passed for stillness; 60fps made it legible. So the journey now covers
// ALL of its ground by TRAVEL_END and holds perfectly still through the
// remainder — the film freezes in the same instant the page does, and
// nothing moves again until the visitor scrolls.
const TRAVEL_END = 0.92;

/** distance covered by fraction t of the journey */
const travelEase = (raw: number): number => {
  const t = Math.min(1, raw / TRAVEL_END);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let d: number;
  if (t < RAMP) d = (t * t) / (2 * RAMP);
  else if (t < CRUISE_END) d = RAMP / 2 + (t - RAMP);
  else {
    const tail = (1 - t) / (1 - CRUISE_END);
    d =
      RAMP / 2 +
      (CRUISE_END - RAMP) +
      ((1 - CRUISE_END) / (DECAY + 1)) * (1 - Math.pow(tail, DECAY + 1));
  }
  return d / AREA;
};

export function mountChapterNav(lenis: Lenis, gsap: typeof Gsap): void {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let stops: number[] = [];
  let index = 0;
  let animating = false;
  let blockedUntil = 0;
  let wheelAcc = 0;
  let prevAbs = Infinity; // |delta| of the previous wheel event
  let lastEventT = 0;
  let journeyT0 = 0; // when the in-flight journey started

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
    journeyT0 = performance.now();
    // the journey's length follows the FILM it plays; plateau-only moves are
    // paced by distance instead, briskly (see the constants above)
    const frames = filmFramesBetween(from, to);
    const dur =
      frames > 8
        ? Math.min(FILM_MAX, Math.max(FILM_MIN, FILM_BASE + frames / FILM_FPS))
        : Math.min(EMPTY_MAX, Math.max(EMPTY_MIN, FILM_BASE + Math.abs(to - from) * EMPTY_PER_PX));
    lenis.scrollTo(to, {
      duration: dur,
      force: true,
      lock: true,
      immediate: reduced,
      easing: travelEase,
      onComplete: () => {
        animating = false;
        blockedUntil = performance.now() + SETTLE_MS;
      },
    });
  };

  /** true when this input should be swallowed. A journey in flight no
   *  longer blanket-blocks the wheel — that forced the visitor to sit
   *  through the whole arrival, copy included, before the next notch
   *  counted (client: "you need to wait all the way untill text appear
   *  before you scroll forward"). Only two things still swallow input:
   *  the brief settle after landing, and the opening beat of a journey
   *  (the same physical flick that launched it is still streaming). The
   *  fresh-turn detector in the wheel handler separates a deliberate new
   *  push from that flick's decaying tail. */
  const blocked = (now: number) => {
    if (now < blockedUntil) {
      wheelAcc = 0;
      prevAbs = Infinity;
      return true;
    }
    if (animating && now - journeyT0 < 180) {
      wheelAcc = 0;
      prevAbs = Infinity; // the launching gesture itself, not a new turn
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
    // mid-journey, `index` is already the in-flight target: a same-direction
    // swipe means "skip ahead", an opposite one means "go back" — searching
    // from the current y would just re-pick the stop we are already flying
    // to, which is a swallow wearing a different hat
    if (animating) {
      goTo(index + dir);
      return;
    }
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
      // edge means the visitor is asking for the next page. Mid-journey the
      // rise must be UNAMBIGUOUS (a tail jitters a few percent up and down),
      // so it clears the previous event by a margin.
      const fresh = gap || a > prevAbs * (animating ? 1.35 : 1);
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
    if (now < blockedUntil) return; // keys are never momentum — retarget freely
    step(dir);
  });

  // ---- touch (the client asked for the same behaviour on mobile) ----
  let touchY = 0;
  let touchAcc = 0;
  let touching = false;
  // ONE page per gesture: after a swipe has stepped, the rest of that same
  // finger-stroke is spent — without this, every further 32px of the stroke
  // stacked another page and two swipes flew to the end of the site
  let steppedThisTouch = false;
  window.addEventListener(
    "touchstart",
    (e: TouchEvent) => {
      if (document.documentElement.classList.contains("menu-open")) return;
      touching = true;
      touchAcc = 0;
      steppedThisTouch = false;
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
      if (steppedThisTouch) return;
      // Touch is NEVER swallowed. The swallow exists for trackpads, whose
      // momentum tail keeps firing after the fingers lift; a finger on the
      // glass is unambiguous intent. A swipe DURING a journey retargets to
      // the next page immediately — ignoring it for the length of a 4-second
      // journey is what read as "hard to scroll, not responsive" (client).
      if (Math.abs(touchAcc) < TOUCH_TRIGGER) return;
      const dir = touchAcc > 0 ? 1 : -1;
      touchAcc = 0;
      steppedThisTouch = true;
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
