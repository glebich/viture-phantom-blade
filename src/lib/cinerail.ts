import type { SectionCtx } from "./section";
import { mountFrameStore } from "./frameseq";
import type { FrameStore } from "./frameseq";
import { tierUrl } from "./cine";

/* ---------------------------------------------------------------------------
 * cinerail.ts — ONE fixed full-viewport canvas carrying the whole cinematic
 * run (intro + clips 2–6). Chapters scrub their own clip on this shared
 * surface, so the film plays IN PLACE as you scroll — no fold line ever
 * divides an asset (client). Between chapter pins the last frame simply
 * holds. The rail hides itself once the scroll passes its last chapter
 * (opaque sections above cover it anyway).
 * ------------------------------------------------------------------------- */

interface Clip {
  name: string;
  count: number;
  store?: FrameStore;
}

class CineRail {
  canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private clips = new Map<string, Clip>();
  private cur: { clip: string; frame: number } | null = null;
  private shownKey = "";
  private raf = 0;

  constructor(private ctx: SectionCtx) {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "cine-rail";
    this.canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(this.canvas);
    this.g = this.canvas.getContext("2d")!;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // size from the element's OWN box, never the viewport: any styling that
      // grows the canvas (the iOS ground bleed did) otherwise stretches the
      // bitmap to fill it — the client watched the film distort on a phone
      const r = this.canvas.getBoundingClientRect();
      const w = Math.round((r.width || innerWidth) * dpr);
      const h = Math.round((r.height || innerHeight) * dpr);
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.shownKey = "";
        this.requestDraw();
      }
    };
    size();
    window.addEventListener("resize", size);
  }

  register(name: string, count: number, host: HTMLElement): void {
    const clip: Clip = { name, count };
    clip.store = mountFrameStore(host, this.ctx, Array.from({ length: count }, (_, i) => tierUrl(name)(i)));
    clip.store.onLoad.add(() => this.requestDraw());
    this.clips.set(name, clip);
  }

  store(name: string): FrameStore | undefined {
    return this.clips.get(name)?.store;
  }

  /** set the rail playhead: clip + progress 0..1 */
  show(name: string, p: number): void {
    const clip = this.clips.get(name);
    if (!clip) return;
    const frame = Math.round(Math.min(1, Math.max(0, p)) * (clip.count - 1));
    this.cur = { clip: name, frame };
    this.requestDraw();
  }

  setVisible(on: boolean): void {
    this.canvas.style.opacity = on ? "1" : "0";
  }

  private requestDraw() {
    if (!this.raf) this.raf = requestAnimationFrame(() => this.draw());
  }

  private draw() {
    this.raf = 0;
    if (!this.cur) return;
    const clip = this.clips.get(this.cur.clip)!;
    const store = clip.store!;
    let idx = this.cur.frame;
    let pick = -1;
    for (let i = idx; i >= 0; i--) if (store.loaded[i]) { pick = i; break; }
    if (pick < 0) for (let i = idx + 1; i < clip.count; i++) if (store.loaded[i]) { pick = i; break; }
    if (pick < 0) return;
    const key = `${this.cur.clip}:${pick}`;
    if (key === this.shownKey) return;
    this.shownKey = key;
    const img = store.frames[pick];
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return;
    const s = Math.max(cw / iw, ch / ih); // cover
    const dw = iw * s;
    const dh = ih * s;
    this.g.clearRect(0, 0, cw, ch);
    this.g.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }
}

let rail: CineRail | null = null;
export function getRail(ctx: SectionCtx): CineRail {
  if (!rail) rail = new CineRail(ctx);
  return rail;
}
