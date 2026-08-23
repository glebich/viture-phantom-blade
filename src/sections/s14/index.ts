import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { splitWords } from "../../lib/textfx";
import { mountFrameStore } from "../../lib/frameseq";

/* s14 (duel-world dimming) & s15 (exclusive OSD) — the living-room chapters.
 * Background: the client ROOM clip as a frame sequence scrubbed by MOUSE
 * position — move right and it plays forward, move left and it plays
 * backwards — under the design's dark tint overlay. */

function roomUrl(i: number): string {
  const small = window.matchMedia("(max-width: 1024px)").matches;
  const size = small && (window.devicePixelRatio || 1) < 2.5 ? 960 : 1920;
  return `/assets/room-${size}/f_${String(i).padStart(3, "0")}.webp`;
}
const ROOM_FRAMES = 61;

function livingRoom(opts: { id: string; title: string; note: string }): Section {
  return {
    id: opts.id,
    html: `
      <canvas class="lr-room" aria-hidden="true"></canvas>
      <div class="lr-tint"></div>
      <div class="stage">
        <h2 class="lr-title">${opts.title}</h2>
        <p class="lr-note t-caps">${opts.note}</p>
        <div class="lr-insert"></div>
      </div>
    `,
    init(el, ctx: SectionCtx) {
      const { gsap } = ctx;

      // ---- mouse-scrubbed room backdrop ----
      const canvas = el.querySelector<HTMLCanvasElement>(".lr-room")!;
      const g = canvas.getContext("2d")!;
      const store = mountFrameStore(el, ctx, Array.from({ length: ROOM_FRAMES }, (_, i) => roomUrl(i)));
      let target = 0.5;
      let cur = 0.5;
      let shown = -1;
      const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(el.clientWidth * dpr) || 2;
        canvas.height = Math.round(el.clientHeight * dpr) || 2;
        shown = -1;
      };
      size();
      window.addEventListener("resize", size);
      const draw = () => {
        const idx = Math.round(cur * (ROOM_FRAMES - 1));
        let pick = -1;
        for (let i = idx; i >= 0; i--) if (store.loaded[i]) { pick = i; break; }
        if (pick < 0) for (let i = idx + 1; i < ROOM_FRAMES; i++) if (store.loaded[i]) { pick = i; break; }
        if (pick < 0 || pick === shown) return;
        shown = pick;
        const img = store.frames[pick];
        const cw = canvas.width, ch = canvas.height;
        const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        g.clearRect(0, 0, cw, ch);
        g.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      };
      store.onLoad.add(() => { shown = -1; draw(); });
      window.addEventListener("pointermove", (e) => {
        target = Math.min(1, Math.max(0, e.clientX / window.innerWidth));
      }, { passive: true });
      gsap.ticker.add(() => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        cur += (target - cur) * 0.035;
        draw();
      });

      // ---- copy + insert reveals (scrub-linked both ways) ----
      const title = el.querySelector<HTMLElement>(".lr-title")!;
      const note = el.querySelector<HTMLElement>(".lr-note")!;
      const insert = el.querySelector<HTMLElement>(".lr-insert")!;
      const words = splitWords(title);
      gsap.set(words, { opacity: 0 });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "+=160%",
          pin: true,
          scrub: true,
          anticipatePin: 1,
        },
      });
      tl.to({}, { duration: 1 }, 0);
      words.forEach((w, i) => {
        tl.fromTo(w, { opacity: 0, y: 24, filter: "blur(7px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.1, ease: "power2.out", immediateRender: true },
          0.1 + i * 0.012);
      });
      tl.fromTo(note, { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.12, ease: "sine.out", immediateRender: true }, 0.18);
      tl.fromTo(insert, { opacity: 0, scale: 0.955, transformOrigin: "50% 60%" },
        { opacity: 1, scale: 1, duration: 0.2, ease: "sine.out", immediateRender: true }, 0.15);

      // departure fade — copy never collides with the fixed header
      const stage = el.querySelector<HTMLElement>(".stage")!;
      gsap.to(stage, {
        opacity: 0, ease: "none",
        scrollTrigger: { trigger: el, start: "bottom 92%", end: "bottom 45%", scrub: true },
      });
    },
  };
}

export const s14 = livingRoom({
  id: "s14",
  title: "Duel world. Real world.<br/>Seamless switch.",
  note: "Auto-dimming electrochromic lenses dynamically adjust light transmission in real time.",
});

export const s15 = livingRoom({
  id: "s15",
  title: "Exclusive OSD<br/>menu",
  note: "A custom UI inspired by the world of Phantom Blade Zero, built for immersion.",
});
