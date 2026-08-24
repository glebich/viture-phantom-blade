import type { SectionCtx } from "./section";
import { splitWords, scrubTurn, scrubFlare } from "./textfx";
import { getRail } from "./cinerail";
import { setRest } from "./rests";

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
}

export interface CineOptions {
  id: string;
  clip: string;
  count: number;
  lengthVh: number;
  videoSpan?: number;
  /** progress at which the clip starts playing (leading hold) */
  videoStart?: number;
  beats?: CineBeat[];
  /** progress where the chapter READS — copy in, film settled (see rests.ts).
   *  Defaults to just after the last beat has landed. */
  rest?: number;
  ctx: SectionCtx;
  el: HTMLElement;
  onTimeline?: (tl: gsap.core.Timeline) => void;
}

export function tierUrl(clip: string): (i: number) => string {
  const small = window.matchMedia("(max-width: 1024px)").matches;
  const size = small && (window.devicePixelRatio || 1) < 2.5 ? 960 : 1920;
  return (i) => `/assets/${clip}-${size}/f_${String(i).padStart(3, "0")}.webp`;
}

export function mountCine(opts: CineOptions) {
  const { ctx, el } = opts;
  const { gsap } = ctx;

  const rail = getRail(ctx);
  rail.register(opts.clip, opts.count, el);

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
  const videoP = () => {
    const p = tlRef ? tlRef.progress() : 0;
    const span = Math.max(0.0001, videoSpan - videoStart0);
    return Math.min(1, Math.max(0, (p - videoStart0) / span));
  };

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
  tl.to(drive, {
    p: 1,
    duration: Math.max(0.001, videoSpan - videoStart),
    onUpdate: () => rail.show(opts.clip, drive.p),
  }, videoStart);
  tl.to({}, { duration: Math.max(0.001, 1 - videoSpan) }, videoSpan);

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
        if (b.out !== undefined) {
          tl.to(w, { opacity: 0, duration: 0.05, ease: "sine.in" }, b.out + i * 0.004);
        }
      });
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
