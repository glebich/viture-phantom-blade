import type { SectionCtx } from "./section";
import { mountFrameStore } from "./frameseq";
import type { FrameStore } from "./frameseq";

/* ---------------------------------------------------------------------------
 * videoscrub.ts — alpha product-video scrubber (canvas frame sequence).
 *
 * The client's DOCK_ADAPT clips are 30-frame 1s ProRes-alpha renders. For
 * scroll-linked playback that must run BACKWARDS as freely as forwards (and
 * follow a pointer drag), <video> currentTime seeking is unusable across
 * engines (keyframe-seek latency in Chrome VP9; WebKit throttles rapid
 * seeks), so each clip ships as a WebP+alpha frame sequence drawn to a
 * canvas — identical pixels on Blink, WebKit and mobile.
 *
 * Sources of the playhead:
 *   • scroll — the host section scrubs `setProgress(p)` from its pinned
 *     timeline (forward on scroll down, backward on scroll up, no loop);
 *   • drag — horizontal pointer drag on the canvas: right = forward,
 *     left = backward. While dragging, a delta rides on top of the scroll
 *     base; on release it glides back to 0 so scroll stays the single
 *     source of truth (no desync jump on the next wheel notch).
 * ------------------------------------------------------------------------- */

export interface VideoScrubOptions {
  /** frame URL builder, i in [0, count) */
  url: (i: number) => string;
  count: number;
  /** design-box the canvas fills; drawn contain-fit inside it */
  fit?: "contain" | "cover";
  /** enable pointer drag scrubbing (default true) */
  drag?: boolean;
  /** full-clip drag distance as a fraction of canvas width (default 0.9) */
  dragSpan?: number;
  ctx: SectionCtx;
  /** host element used for the frame preloader's proximity check */
  host: HTMLElement;
}

export interface VideoScrubHandle {
  canvas: HTMLCanvasElement;
  store: FrameStore;
  /** scroll-driven playhead in [0,1] */
  setProgress(p: number): void;
  /** current effective playhead (scroll base + drag delta, clamped) */
  progress(): number;
  destroy(): void;
}

export function mountVideoScrub(
  canvas: HTMLCanvasElement,
  opts: VideoScrubOptions,
): VideoScrubHandle {
  const { ctx } = opts;
  const g = canvas.getContext("2d")!;
  const fit = opts.fit ?? "contain";
  const urls = Array.from({ length: opts.count }, (_, i) => opts.url(i));
  const store = mountFrameStore(opts.host, ctx, urls);

  let base = 0; // scroll-driven playhead
  let dragDelta = 0; // transient drag offset
  let shown = -1; // last drawn frame index
  let raf = 0;

  const effective = () => Math.min(1, Math.max(0, base + dragDelta));

  // ---- drawing ----
  const draw = () => {
    raf = 0;
    const n = store.frames.length;
    if (!n) return;
    let idx = Math.round(effective() * (opts.count - 1));
    // nearest loaded frame at or below idx, else first loaded above —
    // keeps early scrubs functional while the tail is still arriving
    let pick = -1;
    for (let i = idx; i >= 0; i--) if (store.loaded[i]) { pick = i; break; }
    if (pick < 0) for (let i = idx + 1; i < opts.count; i++) if (store.loaded[i]) { pick = i; break; }
    if (pick < 0) return;
    if (pick === shown) return;
    shown = pick;
    const img = store.frames[pick];
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return;
    const s =
      fit === "cover" ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih);
    const dw = iw * s;
    const dh = ih * s;
    g.clearRect(0, 0, cw, ch);
    g.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  };
  const requestDraw = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };
  store.onLoad.add((i) => {
    // repaint when the currently-wanted frame (or a better candidate) lands
    requestDraw();
  });

  // ---- backing-store sizing (device-pixel aware; stage is transform-scaled,
  // so multiply the CSS box by the live stage scale for crisp pixels) ----
  const sizeCanvas = () => {
    const r = canvas.getBoundingClientRect();
    // round 23 (client: "assets blurry" on iPhone): DPR3 phones rendered
    // through a 2x-capped canvas — cap at 3 (mobile boxes are small in
    // design px, so the backing store stays cheap)
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(2, Math.round(r.width * dpr));
    const h = Math.max(2, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      shown = -1;
      requestDraw();
    }
  };
  sizeCanvas();
  const ro = new ResizeObserver(sizeCanvas);
  ro.observe(canvas);
  window.addEventListener("resize", sizeCanvas);

  // ---- drag scrub ----
  let dragging = false;
  let px = 0;
  let glide: gsap.core.Tween | null = null;
  const onDown = (e: PointerEvent) => {
    if (opts.drag === false) return;
    dragging = true;
    px = e.clientX;
    glide?.kill();
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const r = canvas.getBoundingClientRect();
    const span = Math.max(80, r.width * (opts.dragSpan ?? 0.9));
    dragDelta += (e.clientX - px) / span;
    px = e.clientX;
    requestDraw();
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = "grab";
    // glide the drag offset home — scroll stays the source of truth
    const proxy = { d: dragDelta };
    glide = ctx.gsap.to(proxy, {
      d: 0,
      duration: 0.9,
      ease: "power2.out",
      onUpdate: () => {
        dragDelta = proxy.d;
        requestDraw();
      },
    });
  };
  if (opts.drag !== false) {
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "pan-y"; // vertical scroll stays native on touch
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
  }

  return {
    canvas,
    store,
    setProgress(p: number) {
      base = Math.min(1, Math.max(0, p));
      requestDraw();
    },
    progress: effective,
    destroy() {
      ro.disconnect();
      window.removeEventListener("resize", sizeCanvas);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}

/** Frame-URL helper for the standard adapt asset layout:
 *  /assets/adapt{n}-{size}/f_000.webp … — picks 1440 on desktop stages,
 *  720 on small/mobile stages. */
export function adaptUrl(n: number): (i: number) => string {
  // high-DPR phones (3x iPhones) upscaled the 720 tier ~1.4x → soft;
  // they get the 1440 tier (sections lazy-load frames on proximity)
  const small = window.matchMedia("(max-width: 1024px)").matches;
  const size = small && (window.devicePixelRatio || 1) < 2.5 ? 720 : 1440;
  return (i) => `/assets/adapt${n}-${size}/f_${String(i).padStart(3, "0")}.webp`;
}

export const ADAPT_FRAMES = 30;
