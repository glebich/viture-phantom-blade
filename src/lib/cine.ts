import type { SectionCtx } from "./section";
import { splitWords, scrubTurn, scrubFlare, scrubWordExit } from "./textfx";
import { scrubMaskReveal } from "./assetfx";
import { getRail } from "./cinerail";
import { setRest, registerFilm } from "./rests";
import { frameTier, isPhone, phoneFrameTier } from "./net";

/* ---------------------------------------------------------------------------
 * cine.ts — the Phantom Blade chapter engine.
 *
 * Every cinematic chapter pins and scrubs ITS clip on the shared fixed
 * rail canvas (cinerail.ts) — the film plays in place while sections
 * hand off, so no fold line ever divides an asset. Statement copy
 * condenses in inside a progress window and dissolves back out when the
 * visitor scrubs away (scrub-linked, so scrolling back reverses it).
 * ------------------------------------------------------------------------- */

export interface CineBeat {
  sel: string;
  at: number;
  out?: number;
  words?: boolean;
  drift?: number;
  /** block beats only: reveal through a mask wipe instead of a fade
   *  (assetfx.scrubMaskReveal); "bg" also counter-zooms a background-image */
  mask?: "rise" | "unroll";
  maskBg?: number;
}

export interface CineOptions {
  id: string;
  clip: string;
  count: number;
  lengthVh: number;
  videoSpan?: number;
  /** progress at which the clip starts playing (leading hold) */
  videoStart?: number;
  /** freeze the film at clip-progress `clip` across the pin window
   *  [from, to] — the page's STOP lives inside this window, so the film is
   *  provably still while the copy is read, and resumes only on scroll
   *  (client, glasses case: "can it stop playing at the end of the asset
   *  without playing forward untill you scroll?") */
  hold?: { clip: number; from: number; to: number };
  beats?: CineBeat[];
  /** progress where the chapter READS — copy in, film settled (see rests.ts).
   *  Defaults to just after the last beat has landed. */
  rest?: number;
  ctx: SectionCtx;
  el: HTMLElement;
  onTimeline?: (tl: gsap.core.Timeline) => void;
}

/* The mobile film is its own set of renders (portrait 1080x1920), not a
 * crop: <clip>m dirs, tiers 1080/540. A couple of the vertical clips carry a
 * different frame count than their landscape twins, so the count resolves
 * through effectiveCount() wherever a clip is mounted. */
const PHONE_COUNTS: Record<string, number> = {
  intro60: 122,
  clip260: 100,
  clip360: 66,
  clip460: 127,
  clip560: 105,
  clip660: 61,
};

export function tierUrl(clip: string): (i: number) => string {
  if (isPhone() && PHONE_COUNTS[clip] !== undefined) {
    const size = phoneFrameTier();
    return (i) => `/assets/${clip}m-${size}/f_${String(i).padStart(3, "0")}.webp`;
  }
  const size = frameTier();
  return (i) => `/assets/${clip}-${size}/f_${String(i).padStart(3, "0")}.webp`;
}

export function effectiveCount(clip: string, desktopCount: number): number {
  return isPhone() && PHONE_COUNTS[clip] !== undefined ? PHONE_COUNTS[clip] : desktopCount;
}

export function mountCine(opts: CineOptions) {
  const { ctx, el } = opts;
  const { gsap } = ctx;

  const rail = getRail(ctx);
  const count = effectiveCount(opts.clip, opts.count);
  rail.register(opts.clip, count, el);

  const videoSpan = opts.videoSpan ?? 1;
  const videoStart0 = opts.videoStart ?? 0;

  // Where this chapter's clip should sit for the timeline's CURRENT position.
  // The enter callbacks used to hard-set frame 0 (and frame N going back),
  // which rewound the film whenever the trigger was entered at a position the
  // timeline had already passed — a jump (paginator, Skip, a deep link) or
  // simply crossing the fold with the timeline already complete left the rail
  // on the clip's FIRST frame while the chapter read as finished. That is what
  // broke the hand-off into the display-modes chapter: the battlefield's last
  // frame was supposed to be on screen, and the strap shot was.
  let tlRef: gsap.core.Timeline | null = null;
  // pin progress → clip progress, honouring an optional hold plateau
  const clipAt = (p: number): number => {
    const h = opts.hold;
    if (!h) {
      const span = Math.max(0.0001, videoSpan - videoStart0);
      return Math.min(1, Math.max(0, (p - videoStart0) / span));
    }
    if (p <= videoStart0) return 0;
    if (p < h.from)
      return (Math.min(1, (p - videoStart0) / Math.max(0.0001, h.from - videoStart0))) * h.clip;
    if (p < h.to) return h.clip;
    return Math.min(1, h.clip + ((p - h.to) / Math.max(0.0001, videoSpan - h.to)) * (1 - h.clip));
  };
  const videoP = () => clipAt(tlRef ? tlRef.progress() : 0);

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: el,
      start: "top top",
      end: `+=${opts.lengthVh * 100}%`,
      pin: true,
      scrub: true,
      anticipatePin: 1,
      onEnter() { rail.show(opts.clip, videoP()); },
      onEnterBack() { rail.show(opts.clip, videoP()); },
    },
  });
  tlRef = tl;
  // drive the rail from the timeline itself so the QA harness
  // (?progress=…, ScrollTrigger disabled) scrubs it too
  const videoStart = videoStart0;
  const drive = { p: 0 };
  const showDrive = () => rail.show(opts.clip, drive.p);
  if (opts.hold) {
    const h = opts.hold;
    tl.to(drive, { p: h.clip, duration: Math.max(0.001, h.from - videoStart), onUpdate: showDrive }, videoStart);
    tl.to(drive, { p: 1, duration: Math.max(0.001, videoSpan - h.to), onUpdate: showDrive }, h.to);
  } else {
    tl.to(drive, {
      p: 1,
      duration: Math.max(0.001, videoSpan - videoStart),
      onUpdate: showDrive,
    }, videoStart);
  }
  tl.to({}, { duration: Math.max(0.001, 1 - videoSpan) }, videoSpan);
  registerFilm(tl, videoStart0, videoSpan, count);

  const IN = 0.06;
  for (const b of opts.beats ?? []) {
    const box = el.querySelector<HTMLElement>(b.sel);
    if (!box) continue;
    gsap.set(box, { opacity: 1 });
    if (b.words !== false) {
      const words = splitWords(box);
      // the line swings in from an angle, and each word lands lit then cools
      const step = 0.035 / Math.max(1, words.length - 1);
      scrubTurn(tl, box, words, b.at, step);
      scrubFlare(tl, words, b.at, step);
      words.forEach((w, i) => {
        const at = b.at + (i / Math.max(1, words.length - 1)) * 0.035;
        tl.fromTo(
          w,
          { opacity: 0 },
          { opacity: 1, duration: IN, ease: "power2.out", immediateRender: true },
          at
        );
      });
      if (b.out !== undefined) scrubWordExit(tl, box, words, b.out, 0.012);
    } else if (b.mask) {
      scrubMaskReveal(tl, box, b.at, {
        duration: IN * 1.6,
        dir: b.mask,
        bgFrom: b.maskBg,
        drift: b.drift ?? 16,
      });
      if (b.out !== undefined) {
        tl.to(box, { opacity: 0, duration: 0.05, ease: "sine.in" }, b.out);
      }
    } else {
      scrubFlare(tl, [box], b.at, 0);
      tl.fromTo(
        box,
        { opacity: 0 },
        { opacity: 1, duration: IN, ease: "sine.out", immediateRender: true },
        b.at
      );
      if (b.out !== undefined) {
        tl.to(box, { opacity: 0, duration: 0.05, ease: "sine.in" }, b.out);
      }
    }
  }

  // departure fade — as the released section slides up past the header,
  // its copy dissolves instead of colliding with the fixed chrome
  const stage = el.querySelector<HTMLElement>(".stage");
  if (stage) {
    gsap.to(stage, {
      opacity: 0,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "bottom 55%",
        end: "bottom 18%",
        scrub: true,
      },
    });
  }

  // where the dots should land: after the last beat has fully arrived, but
  // clear of any out-beat, so the chapter is caught mid-read
  const lastIn = Math.max(0, ...(opts.beats ?? []).map((b) => b.at + IN + 0.04));
  const firstOut = Math.min(
    ...(opts.beats ?? []).map((b) => b.out ?? Infinity)
  );
  const fallback = Number.isFinite(firstOut)
    ? (lastIn + firstOut) / 2
    : Math.max(lastIn, videoSpan);
  setRest(opts.id, tl, Math.min(0.97, opts.rest ?? fallback));

  opts.onTimeline?.(tl);
  return { tl, rail };
}

/** chapter shell — cinematic chapters are transparent; the rail shows through */
export function cineHtml(inner: string): string {
  return inner;
}
