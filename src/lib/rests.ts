/* ---------------------------------------------------------------------------
 * rests.ts — where a chapter READS.
 *
 * Client: "when you click the dots you need to go to the section — and a
 * section is when you see the text plus a stopped frame of the background.
 * Right now you land on the transition, not the page."
 *
 * A pinned chapter's scroll range starts on a transition: the clip is mid-
 * morph and the copy hasn't arrived. The moment the chapter actually reads —
 * copy in, film settled on its held frame — sits somewhere inside the pin.
 * Each section registers that progress here, and the paginator scrolls to it
 * instead of to the top of the pin.
 * ------------------------------------------------------------------------- */

interface Rest {
  tl: gsap.core.Timeline;
  p: number;
}

const rests = new Map<string, Rest>();

/** `p` is the progress along the section's pinned timeline where it reads */
export function setRest(id: string, tl: gsap.core.Timeline, p: number): void {
  rests.set(id, { tl, p });
}


/* Beats are authored as TIMES on a chapter's timeline (the position passed to
 * tl.fromTo), but a ScrollTrigger maps the scroll range onto that timeline's
 * whole duration — and two of them are not 1.0 long (s02 runs to 1.11, s13 to
 * 0.935). Reading a time as if it were a progress fraction therefore landed
 * the scroll early: s13's two longest copies were caught 7% short, still
 * assembling their last words (client: "scroll stops on the page before whole
 * text show up"). Convert properly, which is a no-op for the chapters whose
 * timelines already measure exactly 1. */
function yAt(tl: gsap.core.Timeline, time: number): number | null {
  const st = tl.scrollTrigger;
  if (!st) return null;
  const dur = tl.duration() || 1;
  const p = Math.min(1, Math.max(0, time / dur));
  const y = st.start + (st.end - st.start) * p;
  return Number.isFinite(y) ? y : null;
}

/** document y of a chapter's reading position, or null if it hasn't one */
export function restY(id: string): number | null {
  const r = rests.get(id);
  if (!r) return null;
  return yAt(r.tl, r.p);
}

/* ---------------------------------------------------------------------------
 * The STOPS — the pages the scroll is allowed to come to rest on.
 *
 * The client marked these exactly, thirteen frames: hero, forged in shadow, a
 * weapon worn, glasses case, 174-inch battlefield, the four display modes,
 * duel world, OSD menu, treasures, pre-order. "Precise on this moments, not
 * in between, not in any other pages."
 *
 * A rest is registered by every pinned chapter (the paginator uses them all),
 * but not every chapter is a page: s09 is the case tumbling into frame, pure
 * transition with no copy, so it is deliberately not a stop. The display
 * modes are the opposite case — one chapter holding four pages, so it
 * registers four.
 * ------------------------------------------------------------------------- */
const extraStops = new Map<string, { tl: gsap.core.Timeline; ps: number[] }>();

/** chapters that carry several pages inside one pin (the display modes) */
export function setStops(id: string, tl: gsap.core.Timeline, ps: number[]): void {
  extraStops.set(id, { tl, ps });
}

/** ids whose rest is a transition, not a page the visitor should land on */
const NOT_A_PAGE = new Set(["s09"]);

/** every stop in document order — what lib/chapternav.ts drives between */
export function stopYs(): number[] {
  const ys: number[] = [];
  for (const [id, r] of rests) {
    if (NOT_A_PAGE.has(id) || extraStops.has(id)) continue;
    const y = yAt(r.tl, r.p);
    if (y !== null) ys.push(y);
  }
  for (const [, e] of extraStops) {
    for (const t of e.ps) {
      const y = yAt(e.tl, t);
      if (y !== null) ys.push(y);
    }
  }
  return ys.sort((a, b) => a - b);
}

/* ---------------------------------------------------------------------------
 * Film registry — how much FILM lies between two scroll positions.
 *
 * Journeys used to be paced by distance, but the film is not spread evenly:
 * the opening chapters are film-dense (their journeys hit the duration cap
 * and the footage compresses), while the back half is mostly rest plateaus —
 * long distances with nothing changing, which then crawl (client: "first 5
 * sections playing too fast and rest of the web site is actually too slow").
 * Each cinematic chapter registers its clip's mapping here so the navigator
 * can pace a journey by the frames it will actually play.
 * ------------------------------------------------------------------------- */
interface Film {
  tl: gsap.core.Timeline;
  videoStart: number;
  videoSpan: number;
  count: number;
}
const films: Film[] = [];

export function registerFilm(
  tl: gsap.core.Timeline,
  videoStart: number,
  videoSpan: number,
  count: number
): void {
  films.push({ tl, videoStart, videoSpan, count });
}

/** total film frames that play while scrolling from y0 to y1 */
export function filmFramesBetween(y0: number, y1: number): number {
  const a = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  let frames = 0;
  for (const f of films) {
    const st = f.tl.scrollTrigger;
    if (!st) continue;
    const len = st.end - st.start;
    if (len <= 0) continue;
    const clip = (y: number) => {
      const p = Math.min(1, Math.max(0, (y - st.start) / len));
      const span = Math.max(0.0001, f.videoSpan - f.videoStart);
      return Math.min(1, Math.max(0, (p - f.videoStart) / span));
    };
    frames += Math.abs(clip(b) - clip(a)) * f.count;
  }
  return frames;
}
