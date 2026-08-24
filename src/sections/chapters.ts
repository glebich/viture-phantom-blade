import "./cine.css";
import type { Section } from "../lib/section";
import { mountCine, cineHtml } from "../lib/cine";

/* The cinematic statement chapters. Clip boundaries are continuous
 * (clip N's last frame == clip N+1's first), so the shared rail reads as
 * one unbroken film:
 *   intro: game world → glasses hero        (s02, + hero copy)
 *   clip2: hero → temple ornament macro     (s06 FORGED IN SHADOW)
 *   clip3: ornament → the full sword        (s07 A WEAPON, WORN)
 *   clip4: sword → case macro               (s09, pure transition)
 *   clip5: case → open → strap glasses      (s10 GLASSES CASE beats)
 *   clip6: strap → dive into virtual screen (s11 174-INCH BATTLEFIELD)
 */

// s06 — FORGED IN SHADOW. SHARPENED FOR PLAY. (clip2)
export const s06: Section = {
  id: "s06",
  html: cineHtml(`
    <div class="stage">
      <h2 class="cine-statement" style="top:815px" data-beat>Forged in shadow.<br/>Sharpened for play.</h2>
    </div>
  `),
  init(el, ctx) {
    mountCine({
      id: "s06", clip: "clip2", count: 53, lengthVh: 2.2, videoSpan: 0.74,
      ctx, el,
      beats: [{ sel: "[data-beat]", at: 0.78, words: true }],
    });
  },
};

// s07 — A WEAPON, WORN. (clip3; title holds across the morph)
export const s07: Section = {
  id: "s07",
  html: cineHtml(`
    <div class="stage">
      <h2 class="cine-statement" style="top:894px" data-beat>A Weapon, Worn.</h2>
    </div>
  `),
  init(el, ctx) {
    mountCine({
      id: "s07", clip: "clip3", count: 32, lengthVh: 2.2, videoSpan: 0.8,
      ctx, el,
      beats: [{ sel: "[data-beat]", at: 0.12 }],
    });
  },
};

// s09 — the sword sheathes into the case (clip4, pure cinematic transition)
export const s09: Section = {
  id: "s09",
  html: cineHtml(`<div class="stage"></div>`),
  init(el, ctx) {
    mountCine({ id: "s09", clip: "clip4", count: 65, lengthVh: 1.5, videoSpan: 0.9, ctx, el });
  },
};

// s10 — Kungfupunk Style / GLASSES CASE over the resting case (clip5 start),
// dissolving before the case opens; the clip runs on to the strap reveal.
export const s10: Section = {
  id: "s10",
  html: cineHtml(`
    <div class="stage">
      <p class="cine-eyebrow" style="top:819px" data-eyebrow>Kungfupunk Style</p>
      <img class="cine-flourish" style="left:50%;margin-left:-424px;top:902px;width:148px;height:36px" src="/assets/ui/flourish-l.png" alt="" data-fl />
      <img class="cine-flourish" style="left:50%;margin-left:276px;top:902px;width:148px;height:36px" src="/assets/ui/flourish-r.png" alt="" data-fr />
      <h2 class="cine-statement" style="top:894px" data-beat>Glasses Case</h2>
    </div>
  `),
  init(el, ctx) {
    mountCine({
      id: "s10", clip: "clip5", count: 52, lengthVh: 2.4, videoSpan: 0.78, videoStart: 0.14,
      ctx, el,
      beats: [
        { sel: "[data-eyebrow]", at: 0.004, out: 0.24, words: false },
        { sel: "[data-beat]", at: 0.006, out: 0.25, words: true },
      ],
      onTimeline(tl) {
        const fl = el.querySelector("[data-fl]")!;
        const fr = el.querySelector("[data-fr]")!;
        tl.fromTo(fl, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.06, immediateRender: true }, 0.012);
        tl.fromTo(fr, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.06, immediateRender: true }, 0.012);
        tl.to(fl, { opacity: 0, duration: 0.05 }, 0.24);
        tl.to(fr, { opacity: 0, duration: 0.05 }, 0.24);
      },
    });
  },
};

// s11 — A 174-INCH BATTLEFIELD (clip6 outro: dive into the virtual screen;
// the statement lands full-bleed at 112px, then condenses to the 72px
// framed rest as the torn-frame view closes in)
export const s11: Section = {
  id: "s11",
  html: cineHtml(`
    <div class="stage">
      <h2 class="cine-statement cine-statement--xl" style="top:486px" data-beat>A 174-inch battlefield</h2>
    </div>
  `),
  init(el, ctx) {
    mountCine({
      id: "s11", clip: "clip6", count: 30, lengthVh: 2.8, videoSpan: 0.72, rest: 0.9,
      ctx, el,
      beats: [{ sel: "[data-beat]", at: 0.6, words: true }],
      onTimeline(tl) {
        const st = el.querySelector("[data-beat]")!;
        tl.to(st, { scale: 0.643, transformOrigin: "50% 50%", duration: 0.14, ease: "sine.inOut" }, 0.8);
      },
    });
  },
};
