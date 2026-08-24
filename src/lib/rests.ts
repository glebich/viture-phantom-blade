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

/** document y of a chapter's reading position, or null if it hasn't one */
export function restY(id: string): number | null {
  const r = rests.get(id);
  const st = r?.tl.scrollTrigger;
  if (!r || !st) return null;
  const y = st.start + (st.end - st.start) * r.p;
  return Number.isFinite(y) ? y : null;
}

/** every chapter's reading position, ascending — the magnet's targets
 *  (see lib/snap.ts). Recomputed from the live triggers on each call, so it
 *  survives refreshes, resizes and late-built pins. */
export function allRestYs(): number[] {
  const ys: number[] = [];
  for (const [, r] of rests) {
    const st = r.tl.scrollTrigger;
    if (!st) continue;
    const y = st.start + (st.end - st.start) * r.p;
    if (Number.isFinite(y)) ys.push(y);
  }
  return ys.sort((a, b) => a - b);
}
