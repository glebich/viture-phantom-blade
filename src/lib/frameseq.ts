import type { SectionCtx } from "./section";

/* ---------------------------------------------------------------------------
 * frameseq.ts — shared eager preloader for alpha frame sequences
 * (round 18: s03 "Five Years" scroll scrub, s11 diopter drag/replay).
 *
 * All frames start loading once the host section comes within ±1 viewport.
 * Rect-based proximity on purpose, NOT IntersectionObserver: GSAP reparents
 * pinned sections into pin-spacers after observation starts, which WebKit's
 * IO handles inconsistently (same rationale as lazyvideo). Subscribers in
 * `onLoad` repaint as each frame arrives, so a canvas showing frame i fills
 * in the moment frame i is decodable.
 * ------------------------------------------------------------------------- */

export interface FrameStore {
  frames: HTMLImageElement[];
  loaded: boolean[];
  /** Called with the index of each frame as it finishes loading. */
  onLoad: Set<(i: number) => void>;
}

export function mountFrameStore(
  host: HTMLElement,
  ctx: SectionCtx,
  urls: string[],
): FrameStore {
  const store: FrameStore = {
    frames: [],
    loaded: new Array(urls.length).fill(false),
    onLoad: new Set(),
  };
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    urls.forEach((u, i) => {
      const img = new Image();
      img.decoding = "async";
      img.addEventListener(
        "load",
        () => {
          store.loaded[i] = true;
          store.onLoad.forEach((f) => f(i));
        },
        { once: true },
      );
      img.src = u;
      store.frames[i] = img;
    });
  };
  const near = () => {
    if (started) return;
    const vh = window.innerHeight;
    const r = host.getBoundingClientRect();
    if (r.bottom > -vh && r.top < vh * 2) start();
  };
  ctx.lenis.on("scroll", near);
  window.addEventListener("scroll", near, { passive: true });
  ctx.ScrollTrigger.addEventListener("refresh", near);
  near();
  return store;
}
