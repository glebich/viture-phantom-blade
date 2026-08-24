import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { splitWords, scrubTurn, scrubFlare } from "../../lib/textfx";
import { scrubAssetArrival } from "../../lib/assetfx";
import { setRest } from "../../lib/rests";
import { mountFrameStore } from "../../lib/frameseq";
import type { FrameStore } from "../../lib/frameseq";

/* s14 (duel-world dimming) & s15 (exclusive OSD) — the living-room chapters.
 * ONE shared fixed room backdrop (client: "bg should stay the same — only
 * text and content scroll through"), scrubbed by MOUSE position: right =
 * forward, left = backwards, under the design's dark tint. */

function roomUrl(i: number): string {
  const small = window.matchMedia("(max-width: 1024px)").matches;
  const size = small && (window.devicePixelRatio || 1) < 2.5 ? 960 : 1920;
  return `/assets/room-${size}/f_${String(i).padStart(3, "0")}.webp`;
}
const ROOM_FRAMES = 61;

interface RoomRail {
  register(host: HTMLElement): void;
  /** 0 = the room at full brightness, 1 = the design's dark grade */
  setDim(v: number): void;
}
let roomRail: RoomRail | null = null;

function getRoomRail(ctx: SectionCtx): RoomRail {
  if (roomRail) return roomRail;
  const { gsap } = ctx;
  const canvas = document.createElement("canvas");
  canvas.id = "room-rail";
  canvas.setAttribute("aria-hidden", "true");
  const tint = document.createElement("div");
  tint.id = "room-tint";
  // before <main> so opaque neighbours (s13, s16) cover it outside the range
  const mainEl = document.getElementById("sections")!;
  document.body.insertBefore(canvas, mainEl);
  document.body.insertBefore(tint, mainEl);

  const g = canvas.getContext("2d")!;
  const hosts: HTMLElement[] = [];
  let store: FrameStore | null = null;
  let target = 0.5;
  let cur = 0.5;
  let shown = -1;
  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr) || 2;
    canvas.height = Math.round(innerHeight * dpr) || 2;
    shown = -1;
  };
  size();
  window.addEventListener("resize", size);
  const draw = () => {
    if (!store) return;
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
  window.addEventListener("pointermove", (e) => {
    target = Math.min(1, Math.max(0, e.clientX / window.innerWidth));
  }, { passive: true });
  // Client: the room should arrive at FULL brightness and only dim once the
  // content appears — the grade used to be on from the first frame, so you
  // never saw the room itself. Each chapter drives this from its own scrub.
  let dim = 0;
  let visible = false;
  gsap.ticker.add(() => {
    if (!hosts.length) return;
    let on = false;
    for (const h of hosts) {
      const r = h.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) { on = true; break; }
    }
    if (on !== visible) {
      visible = on;
      canvas.style.opacity = on ? "1" : "0";
    }
    tint.style.opacity = on ? String(dim) : "0";
    if (!on) return;
    cur += (target - cur) * 0.035;
    draw();
  });

  roomRail = {
    setDim(v: number) {
      dim = Math.min(1, Math.max(0, v));
    },
    register(host: HTMLElement) {
      hosts.push(host);
      if (!store) {
        store = mountFrameStore(host, ctx, Array.from({ length: ROOM_FRAMES }, (_, i) => roomUrl(i)));
        store.onLoad.add(() => { shown = -1; draw(); });
      }
    },
  };
  return roomRail;
}

function livingRoom(opts: { id: string; title: string; note: string }): Section {
  return {
    id: opts.id,
    html: `
      <div class="stage">
        <h2 class="lr-title">${opts.title}</h2>
        <p class="lr-note t-caps">${opts.note}</p>
        <div class="lr-insert"></div>
      </div>
    `,
    init(el, ctx: SectionCtx) {
      const { gsap } = ctx;
      const room = getRoomRail(ctx);
      room.register(el);

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
      // the room lands bright, then the grade comes up under the copy
      const grade = { v: 0 };
      tl.fromTo(grade, { v: 0 },
        { v: 1, duration: 0.2, ease: "sine.inOut", immediateRender: true,
          onUpdate: () => room.setDim(grade.v) }, 0.06);
      scrubTurn(tl, title, words, 0.1, 0.012, { tilt: 0.09 });
      scrubFlare(tl, words, 0.1, 0.012, { cool: 0.07 });
      words.forEach((w, i) => {
        tl.fromTo(w, { opacity: 0 },
          { opacity: 1, duration: 0.1, ease: "power2.out", immediateRender: true },
          0.1 + i * 0.012);
      });
      tl.fromTo(note, { opacity: 0 },
        { opacity: 1, duration: 0.12, ease: "sine.out", immediateRender: true }, 0.18);
      // the framed panel resolves out of the air like the copy does
      scrubAssetArrival(tl, insert, 0.14, { duration: 0.34, drift: 30, blur: 14 });

      setRest(opts.id, tl, 0.5);

      // tail fade inside the pin — nothing of the stage can ever slice
      // across the header during the release scroll
      const stage = el.querySelector<HTMLElement>(".stage")!;
      tl.to(stage, { opacity: 0, duration: 0.06, ease: "sine.in" }, 0.94);
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
