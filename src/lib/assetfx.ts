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

// ---------------------------------------------------------------------------
// scrubMaskReveal — the editorial reveal (client: entrances "appear like png
// images"; reference fantasy.co). The condense above treats an image as a
// ghost that fades in; this treats it as something DISCOVERED: a mask wipes
// across the box while the picture settles inside it, moving against the
// mask edge. The eye reads two counter-motions — that is what makes it feel
// crafted instead of switched on.
//
//   clip-path   inset wipe — "rise" sweeps bottom→top (arrivals while
//               scrolling down), "unroll" sweeps top→bottom (the hanging
//               map scroll unrolls)
//   counter-zoom on background-image panels: background-size 112% → 100%,
//               so the picture eases back while the mask opens; on plain
//               <img> objects a small element scale does the same job
//   light pass  brightness 1.22 → 1 — the sheen cools as it lands
//   drift       a few px of travel, power3.out — long settle, no pop
//
// All fromTo with immediateRender inside the scrubbed timeline, so scrolling
// back closes the mask again (same GHOST ARMOR rules as textfx).
// ---------------------------------------------------------------------------

export interface MaskRevealOpts {
  duration?: number;
  dir?: "rise" | "unroll";
  /** counter-zoom start, % of box — used when the element paints a
   *  background-image (framed panels) */
  bgFrom?: number;
  /** counter-zoom start for <img> elements (element scale) */
  scaleFrom?: number;
  drift?: number;
  brightness?: number;
}

export function scrubMaskReveal(
  tl: gsap.core.Timeline,
  el: HTMLElement,
  at: number,
  opts?: MaskRevealOpts
): void {
  const c = {
    duration: 0.34,
    dir: "rise" as const,
    drift: 22,
    brightness: 1.22,
    ...(opts ?? {}),
  };
  // the OPEN state is a negative inset, not 0: several of these elements
  // carry glows and box-shadow blooms that live outside the border box, and
  // a 0% mask at rest would shave them off (filters paint before clipping).
  const closed =
    c.dir === "rise" ? "inset(100% -50% -50% -50%)" : "inset(-50% -50% 100% -50%)";
  const open = "inset(-50% -50% -50% -50%)";
  // the mask does the revealing; opacity only keeps the first sliver from
  // popping, so it resolves inside the opening fifth of the window
  tl.fromTo(
    el,
    { opacity: 0 },
    { opacity: 1, duration: c.duration * 0.2, ease: "sine.out", immediateRender: true },
    at
  );
  tl.fromTo(
    el,
    { clipPath: closed, y: c.drift, filter: `brightness(${c.brightness}) blur(4px)` },
    {
      clipPath: open,
      y: 0,
      filter: "brightness(1) blur(0px)",
      duration: c.duration,
      ease: "power3.out",
      immediateRender: true,
    },
    at
  );
  if (c.bgFrom) {
    tl.fromTo(
      el,
      { backgroundSize: `${c.bgFrom}% ${c.bgFrom}%` },
      {
        backgroundSize: "100% 100%",
        duration: c.duration,
        ease: "power3.out",
        immediateRender: true,
      },
      at
    );
  } else if (c.scaleFrom) {
    tl.fromTo(
      el,
      { scale: c.scaleFrom },
      { scale: 1, duration: c.duration, ease: "power3.out", immediateRender: true },
      at
    );
  }
}
