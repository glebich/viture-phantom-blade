// ---------------------------------------------------------------------------
// assetfx — the reveal language for IMAGE assets (the relic cards, the map
// scroll, the framed screens, the OSD panel, the logo beat).
//
// Client: "work on the animation effect how png assets images show up —
// needs smooth and nice elegant motion on it, same as text, more slower and
// elegant magical". So images now speak textfx's vocabulary: they condense
// out of the air rather than switching on.
//
//   opacity 0 → 1
//   drift   ~26px → 0 (translateY, so nothing reflows)
//   scale   0.965 → 1 (a breath of approach, never a pop)
//   blur    ~12px → 0 (the "magical" part — it resolves into focus)
//   ease    power2.out, ~1.7s, generous stagger between siblings
//
// Two entry points mirroring textfx:
//   revealAssets(els, opts)      — time-based timeline (entrances)
//   scrubAssetArrival(tl, el, at, opts) — the same flavour placed inside a
//       SCRUBBED timeline, so scrolling back reverses it. Uses plain
//       opacity/transform/filter fromTo with immediateRender, never
//       autoAlpha (see textfx's GHOST ARMOR note).
// ---------------------------------------------------------------------------
import gsap from "gsap";

export interface AssetfxOpts {
  /** seconds (time mode) or timeline units (scrub mode) */
  duration?: number;
  /** px of upward drift the asset travels in */
  drift?: number;
  /** starting scale */
  scale?: number;
  /** peak blur in px */
  blur?: number;
  /** gap between siblings */
  stagger?: number;
  ease?: string;
}

const D = {
  duration: 1.7,
  drift: 26,
  scale: 0.965,
  blur: 12,
  stagger: 0.22,
  ease: "power2.out",
};

function from(o: AssetfxOpts | undefined) {
  return { ...D, ...(o ?? {}) };
}

/** hidden build-time state — plain style writes, nothing for a refresh to rewind */
export function prepareAsset(el: HTMLElement, opts?: AssetfxOpts): void {
  const c = from(opts);
  el.style.opacity = "0";
  el.style.filter = `blur(${c.blur}px)`;
  el.style.willChange = "opacity, transform, filter";
}

/** time-based reveal; returns an unattached timeline */
export function revealAssets(
  els: HTMLElement[],
  opts?: AssetfxOpts
): gsap.core.Timeline {
  const c = from(opts);
  const tl = gsap.timeline();
  els.forEach((el, i) => {
    tl.fromTo(
      el,
      { opacity: 0, y: c.drift, scale: c.scale, filter: `blur(${c.blur}px)` },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: c.duration,
        ease: c.ease,
        clearProps: "filter,willChange",
      },
      i * c.stagger
    );
  });
  return tl;
}

/**
 * The same arrival inside a SCRUBBED timeline. `at` is the timeline position;
 * `duration` is in the timeline's units (default 0.3 of a 0–1 window), which
 * is deliberately long — the asset resolves across a real stretch of scroll
 * instead of blinking on.
 */
export function scrubAssetArrival(
  tl: gsap.core.Timeline,
  el: HTMLElement,
  at: number,
  opts?: AssetfxOpts
): void {
  const c = { ...D, duration: 0.3, ...(opts ?? {}) };
  tl.fromTo(
    el,
    { opacity: 0, y: c.drift, scale: c.scale, filter: `blur(${c.blur}px)` },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      duration: c.duration,
      ease: c.ease,
      immediateRender: true,
    },
    at
  );
}
