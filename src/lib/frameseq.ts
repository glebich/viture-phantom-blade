import type { SectionCtx } from "./section";

/* ---------------------------------------------------------------------------
 * frameseq.ts — the preloader for the film's frame sequences.
 *
 * A sequence starts loading once its host section comes within ±1 viewport.
 * Rect-based proximity on purpose, NOT IntersectionObserver: GSAP reparents
 * pinned sections into pin-spacers after observation starts, which WebKit's
 * IO handles inconsistently (same rationale as lazyvideo). Subscribers in
 * `onLoad` repaint as each frame arrives, so a canvas showing frame i fills
 * in the moment frame i is decodable.
 *
 * Client: "make sure assets download smooth". They didn't — every store fired
 * ALL of its frames the instant it activated, and at page load the intro (62)
 * and chapter 2 (53) both qualify, so 115 requests went out at once. The
 * browser then finished them in whatever order it pleased: the loader's
 * percentage lurched, and a scrub could sit on a hole because frame 4 was
 * still queued behind frame 50 of a sequence nobody was looking at.
 *
 * So all sequences now share ONE scheduler with a bounded number of requests
 * in flight, which
 *   - fills each sequence IN ORDER, front to back, so the frames you reach
 *     first are the frames that exist first, and
 *   - always spends the next free slot on the sequence NEAREST the viewport,
 *     re-deciding on every completion, so scrolling ahead redirects the
 *     bandwidth instead of queueing behind it.
 * ------------------------------------------------------------------------- */

const MAX_IN_FLIGHT = 6;

export interface FrameStore {
  frames: HTMLImageElement[];
  loaded: boolean[];
  /** Called with the index of each frame as it finishes loading. */
  onLoad: Set<(i: number) => void>;
}

interface Entry extends FrameStore {
  urls: string[];
  host: HTMLElement;
  next: number;
  active: boolean;
}

const entries: Entry[] = [];
let inFlight = 0;

/** px from the viewport — 0 while the section is on screen */
function distance(host: HTMLElement): number {
  const r = host.getBoundingClientRect();
  if (r.bottom < 0) return -r.bottom;
  if (r.top > 0) return r.top;
  return 0;
}

function pump(): void {
  while (inFlight < MAX_IN_FLIGHT) {
    let best: Entry | null = null;
    let bestD = Infinity;
    for (const e of entries) {
      if (!e.active || e.next >= e.urls.length) continue;
      const d = distance(e.host);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return;
    const e = best;
    const i = e.next++;
    inFlight++;
    const img = new Image();
    img.decoding = "async";
    const done = () => {
      inFlight--;
      pump();
    };
    img.addEventListener(
      "load",
      () => {
        // Decode BEFORE publishing the frame. `load` only means the bytes
        // arrived; the first drawImage would otherwise decode synchronously
        // on the scroll frame that needs it, which is exactly the hitch you
        // feel scrubbing. decode() moves that work off the critical path.
        const publish = () => {
          e.loaded[i] = true;
          e.onLoad.forEach((f) => f(i));
          done();
        };
        if (img.decode) img.decode().then(publish, publish);
        else publish();
      },
      { once: true },
    );
    // a dead frame must not wedge the queue
    img.addEventListener("error", done, { once: true });
    img.src = e.urls[i];
    e.frames[i] = img;
  }
}

export function mountFrameStore(
  host: HTMLElement,
  ctx: SectionCtx,
  urls: string[],
): FrameStore {
  const entry: Entry = {
    frames: [],
    loaded: new Array(urls.length).fill(false),
    onLoad: new Set(),
    urls,
    host,
    next: 0,
    active: false,
  };
  entries.push(entry);

  const near = () => {
    if (entry.active) return;
    const vh = window.innerHeight;
    const r = host.getBoundingClientRect();
    if (r.bottom > -vh && r.top < vh * 2) {
      entry.active = true;
      pump();
    }
  };
  ctx.lenis.on("scroll", near);
  window.addEventListener("scroll", near, { passive: true });
  ctx.ScrollTrigger.addEventListener("refresh", near);
  near();
  return entry;
}
