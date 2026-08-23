import "../styles/thread.css";
import type { SectionCtx } from "./section";

/* ---------------------------------------------------------------------------
 * thread.ts — THE red thread.
 *
 * Client: "make it procedural so it feels very real, and physically ONE
 * thread across all the pages — connected, moving with you once you scroll…
 * imagine a physical thread and you're moving along it, going down." Plus:
 * it is STATIC ("just a visual element, not animated flying around"), it
 * starts only at Desktop / Section - 12, it sits BEHIND the assets, and its
 * position follows the client's own frames.
 *
 * So: one cord defined in DOCUMENT space. Its ANCHORS are the thread
 * positions traced straight out of the reference frames (Desktop-12 … -17 in
 * harvest/refs — colour-keyed, connected-components, sampled per row; see
 * ANCHORS below for the numbers), expressed as a fraction of viewport width
 * at a fraction of each section's own scroll length. Sections pin, so the
 * document positions are re-measured on every ScrollTrigger refresh.
 *
 * Between anchors it is a Catmull-Rom spline evaluated into a dense lookup
 * table, so the curve is C1-continuous — no kinks where sections meet, which
 * is what sells it as one physical cord rather than six drawn strands.
 * ------------------------------------------------------------------------- */

/** traced from the client's frames: [section id, [progress, x / viewport-width]] */
const ANCHORS: [string, [number, number][]][] = [
  // The cord starts HERE — the display-modes chapter is the first screen it
  // appears on, and every screen before it stays clean (client). It enters
  // from off the left and crosses down.
  // Section 13 — the long left-hand descent (traced x 27→383 over y 261→1001)
  ["s13", [[0.0, 0.5], [0.5, 0.24], [1.0, 0.11]]],
  // Section 14 — the bottom of the arc, out by the left edge (traced x 485→19)
  ["s14", [[0.0, 0.11], [0.5, 0.05], [1.0, 0.12]]],
  // Section 15 — climbs back across behind the OSD panel (traced x 208→696)
  ["s15", [[0.0, 0.12], [0.5, 0.2], [1.0, 0.3]]],
  // Section 16 — threads between the relic cards (traced x 271→627)
  ["s16", [[0.0, 0.3], [0.5, 0.32], [1.0, 0.42]]],
  // Section 17 — the finale arc past the map scroll (traced x 1047→1322)
  ["s17", [[0.0, 0.42], [0.45, 0.6], [1.0, 0.72]]],
];

/** how far past each edge the cord swings — the turnarounds stay off-screen,
 *  so what you see in frame is only the shallow part of the crossing */
const SERP_A = 1.0;
const LUT_STEP = 8; // px of document per lookup-table entry
const FADE = 420; // px of scroll over which the cord enters / leaves
const CORE_W = 2.4;

const phone = () => window.matchMedia("(max-width: 640px)").matches;

/** the scrollable box a section occupies, pin-spacer included */
function box(id: string): { top: number; height: number } | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const host = el.parentElement?.classList.contains("pin-spacer")
    ? (el.parentElement as HTMLElement)
    : el;
  const r = host.getBoundingClientRect();
  return { top: r.top + window.scrollY, height: r.height };
}

export function mountThread(ctx: SectionCtx): void {
  const canvas = document.createElement("canvas");
  canvas.id = "thread-rail";
  canvas.setAttribute("aria-hidden", "true");
  // behind the sections' assets but above the film/room/wash backdrops
  // (client) — all four are z-index 0, so DOM order decides
  const mainEl = document.getElementById("sections")!;
  document.body.insertBefore(canvas, mainEl);
  const g = canvas.getContext("2d")!;

  let w = 0;
  let h = 0;
  let coreW = CORE_W;
  let glowA = 0.5;

  // the cord, baked: lut[i] = x (fraction of width) at docY = y0 + i*LUT_STEP
  let lut: Float32Array = new Float32Array(0);
  let y0 = 0;
  let y1 = 0;

  /** Catmull-Rom through the anchors, sampled into the lookup table */
  const bake = () => {
    const narrow = phone();
    const pts: { y: number; x: number }[] = [];
    for (const [id, list] of ANCHORS) {
      const b = box(id);
      if (!b) continue;
      for (const [p, x] of list) {
        const y = b.top + b.height * p;
        // sections butt together, so each shared endpoint arrives twice
        if (pts.length && Math.abs(pts[pts.length - 1].y - y) < 1) continue;
        pts.push({ y, x });
      }
    }
    if (pts.length < 2) {
      lut = new Float32Array(0);
      return;
    }
    pts.sort((a, b) => a.y - b.y);
    y0 = pts[0].y;
    y1 = pts[pts.length - 1].y;
    const n = Math.max(2, Math.ceil((y1 - y0) / LUT_STEP) + 1);
    lut = new Float32Array(n);
    let seg = 0;
    // The cord's dominant character (client's reference frames): a LONG,
    // SHALLOW sweep that enters one edge and leaves the other, not a steep
    // descent. So the anchors are demoted to a slow lean — which side of the
    // page the cord favours — and the visible shape is a serpentine whose
    // turnarounds happen well off-screen, leaving only the shallow crossings
    // in frame.
    //
    // Amplitude and period are set together: their RATIO fixes the rake (a
    // crossing traverses the full width in ~0.45 of a screen height, ≈14°,
    // which is what the frames read at) while their absolute size sets how
    // far apart the crossings sit. Spaced so consecutive crossings can't both
    // land in one viewport — you see one cord passing through, not a lattice.
    // A phone is a quarter the width, so it needs a far longer period to stay
    // anywhere near as shallow.
    const period = (narrow ? 7.2 : 2.55) * Math.max(560, h);
    let phase = narrow ? 1.9 : 0.6;
    for (let i = 0; i < n; i++) {
      const y = y0 + i * LUT_STEP;
      while (seg < pts.length - 2 && y > pts[seg + 1].y) seg++;
      const p1 = pts[seg];
      const p2 = pts[seg + 1];
      const p0 = pts[seg - 1] ?? p1;
      const p3 = pts[seg + 2] ?? p2;
      const span = Math.max(1, p2.y - p1.y);
      const t = Math.min(1, Math.max(0, (y - p1.y) / span));
      const t2 = t * t;
      const t3 = t2 * t;
      // Catmull-Rom basis — C1 across every joint, so no kink at a section edge
      const base =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      // Over the last stretch the sweep tapers out and the traced anchors
      // take over completely, so the cord finishes as the finale frame draws
      // it: a slow descent down the right, passing behind the map scroll.
      // Without this the serpentine laid a shallow crossing straight through
      // the "Pre-order Exclusive" copy (client).
      const tail = Math.min(1, (y1 - y) / (2.2 * Math.max(560, h)));
      const ease = tail * tail * (3 - 2 * tail); // smoothstep, no crease
      // the anchors otherwise only LEAN the cord toward the side the
      // client's frames put it on; the sweep is what you actually read
      const lean = 0.5 + (base - 0.5) * (0.34 + (1 - ease) * 0.66);

      // Serpentine, mostly sinusoidal: what lands in frame is the shallow
      // stretch either side of a zero crossing — a gentle arc across the full
      // width, which is how the cord reads in the client's frames. The turns
      // are up at the peaks, past the edges and out of sight. A pure triangle
      // wave would be dead-straight (a laser, not a thread), so it only
      // contributes enough to hold the crossing shallow a little longer.
      const per = period * (1 + 0.16 * Math.sin(y / 5600));
      phase += (2 * Math.PI * LUT_STEP) / per;
      const tri = Math.asin(Math.sin(phase)) * (2 / Math.PI);
      const sweep = SERP_A * ease * (0.25 * tri + 0.75 * Math.sin(phase));

      // a hand's-breadth of wander so the cord isn't a perfect maths curve —
      // baked into the shape, not animated
      const u = y / 1000;
      lut[i] =
        lean +
        sweep +
        0.006 * Math.sin(u * 2.3 + 1.1) +
        0.0024 * Math.sin(u * 5.7 + 0.3);
    }
  };

  const xAt = (docY: number): number => {
    if (!lut.length) return NaN;
    const f = (docY - y0) / LUT_STEP;
    const i = Math.floor(f);
    if (i < 0) return lut[0] * w;
    if (i >= lut.length - 1) return lut[lut.length - 1] * w;
    const a = lut[i];
    const b = lut[i + 1];
    return (a + (b - a) * (f - i)) * w;
  };

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    coreW = phone() ? 1.5 : CORE_W;
    glowA = phone() ? 0.34 : 0.5;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  let scroll = 0;
  let drawn = NaN;

  ctx.lenis.on("scroll", ({ scroll: s }: { scroll: number }) => {
    scroll = s;
  });
  ctx.ScrollTrigger.addEventListener("refresh", () => {
    bake();
    drawn = NaN;
  });
  window.addEventListener("resize", () => {
    size();
    bake();
    drawn = NaN;
  });

  size();
  bake();

  const trace = () => {
    // the cord is a function of document y, so the on-screen curve is just
    // the window [scroll, scroll + h] of it — sampled fine enough that the
    // polyline is visually a smooth spline
    const top = Math.max(scroll - 40, y0);
    const bottom = Math.min(scroll + h + 40, y1);
    g.beginPath();
    let first = true;
    for (let y = top; y <= bottom; y += 6) {
      const sx = xAt(y);
      const sy = y - scroll;
      if (first) {
        g.moveTo(sx, sy);
        first = false;
      } else g.lineTo(sx, sy);
    }
    return !first;
  };

  const draw = () => {
    g.clearRect(0, 0, w, h);
    if (!lut.length) return;
    // it exists only from Section 12 on, and eases in and out at the ends
    const a = Math.min(
      1,
      Math.max(0, Math.min((scroll + h - y0) / FADE, (y1 - scroll) / FADE))
    );
    if (a <= 0.001) return;
    g.globalAlpha = a;
    g.lineCap = "round";
    g.lineJoin = "round";

    // 1. the light it throws
    g.save();
    g.globalCompositeOperation = "lighter";
    g.shadowColor = "rgba(232, 52, 42, 0.9)";
    g.shadowBlur = 16;
    g.strokeStyle = `rgba(150, 18, 14, ${glowA})`;
    g.lineWidth = coreW + 3.4;
    if (trace()) g.stroke();
    g.restore();

    // 2. the cord itself — a vertical gradient keeps it from reading flat
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#b81c14");
    grad.addColorStop(0.42, "#e8342a");
    grad.addColorStop(1, "#a8170f");
    g.strokeStyle = grad;
    g.lineWidth = coreW;
    if (trace()) g.stroke();

    // 3. the twist — a thin off-centre highlight dashed at fibre pitch, so
    // the cord reads braided rather than extruded. The dash travels WITH the
    // page (it is painted on the thread), it is not an animation.
    g.save();
    g.globalAlpha = a * 0.42;
    g.strokeStyle = "#ff8d7d";
    g.lineWidth = 0.9;
    g.setLineDash([3, 5]);
    g.lineDashOffset = -y0 * 0.12;
    g.translate(-0.7, 0);
    if (trace()) g.stroke();
    g.restore();
    g.globalAlpha = 1;
  };

  const loop = () => {
    if (!document.hidden && scroll !== drawn) {
      drawn = scroll;
      draw();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
