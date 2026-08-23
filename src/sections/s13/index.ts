import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { splitWords } from "../../lib/textfx";

/* s13 — display modes. Pinned: scroll advances Anchor → Ultra-Wide →
 * Immersive 3D → Side; the icon tabs are clickable (they glide the scroll
 * to the beat). Loop clips play inside the red-bordered virtual screen:
 * anchor = 16:10 crop of the battlefield loop, ultra-wide = the 21:9 loop,
 * 3d = alpha clip (black keyed via screen blend) breaking out of the
 * frame, side = the full-bleed bamboo clip with its own corner window. */

const MODES = [
  {
    key: "anchor",
    title: "16:10 Anchor Mode",
    sub: "Ultra-smooth 120Hz combat in native 16:10 — every strike, every frame, perfectly fluid in the game",
    screen: { left: 382, top: 471, width: 1158, height: 724 },
  },
  {
    key: "uwide",
    title: "Ultra-Wide Mode",
    sub: "Expand the battlefield. Phantom Blade Zero stretches beyond the screen into full cinematic combat immersion.",
    screen: { left: 233, top: 471, width: 1457, height: 615 },
  },
  {
    key: "3d",
    title: "Immersive 3D Mode",
    sub: "Depth comes alive in 3D — every enemy, every motion in the game gains true spatial presence inside the fight.",
    screen: { left: 382, top: 470, width: 1158, height: 651 },
  },
  {
    key: "side",
    title: "Side Mode",
    sub: "Keep the battle alive in a corner — the gameplay stays active while transparency rises, letting you interact with the real world without pause.",
    screen: { left: 382, top: 471, width: 1158, height: 724 },
  },
];

export const s13: Section = {
  id: "s13",
  html: `
    <div class="s13-bg"></div>
    <video class="s13-side" muted loop playsinline preload="none" src="/video/sidemode.mp4"></video>
    <div class="s13-side-veil"></div>
    <div class="stage">
      <div class="s13-screen">
        <video class="s13-v s13-v-anchor" muted loop playsinline preload="none" src="/video/ultrawide.mp4"></video>
        <video class="s13-v s13-v-uwide" muted loop playsinline preload="none" src="/video/ultrawide.mp4" style="object-fit:contain;opacity:0"></video>
      </div>
      <video class="s13-3d" muted loop playsinline preload="none" src="/video/3dmode.mp4"></video>
      ${MODES.map((m, i) => `
        <button class="s13-tab${i === 0 ? " on" : ""}" role="tab" data-i="${i}" aria-label="${m.title}"
          style="left:${[759, 877, 995, 1114][i]}px">
          <img src="/assets/ui/ic-${m.key}.png" alt="" />
        </button>`).join("")}
      ${MODES.map((m, i) => `
        <div class="s13-copy" data-copy="${i}">
          <h2 class="s13-title">${m.title}</h2>
          <p class="s13-sub t-caps">${m.sub}</p>
        </div>`).join("")}
    </div>
  `,
  init(el, ctx: SectionCtx) {
    const { gsap } = ctx;
    const screen = el.querySelector<HTMLElement>(".s13-screen")!;
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>(".s13-tab"));
    const copies = Array.from(el.querySelectorAll<HTMLElement>(".s13-copy"));
    const vSide = el.querySelector<HTMLVideoElement>(".s13-side")!;
    const sideVeil = el.querySelector<HTMLElement>(".s13-side-veil")!;
    const v3d = el.querySelector<HTMLVideoElement>(".s13-3d")!;
    const vAnchor = el.querySelector<HTMLVideoElement>(".s13-v-anchor")!;
    const vUwide = el.querySelector<HTMLVideoElement>(".s13-v-uwide")!;

    // word-split all copies and hide their words (scrub-owned)
    const wordSets = copies.map((c) => {
      const words = [
        ...splitWords(c.querySelector(".s13-title") as HTMLElement),
        ...splitWords(c.querySelector(".s13-sub") as HTMLElement),
      ];
      gsap.set(c, { opacity: 1 });
      gsap.set(words, { opacity: 0 });
      return words;
    });

    const SEG = 1 / 4; // four beats
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: el,
        start: "top top",
        end: "+=450%",
        pin: true,
        scrub: true,
        anticipatePin: 1,
      },
    });

    // copy in/out per beat
    MODES.forEach((_, i) => {
      const at = i * SEG + 0.02;
      const out = (i + 1) * SEG - 0.045;
      wordSets[i].forEach((w, k) => {
        tl.fromTo(w, { opacity: 0, y: 20, filter: "blur(6px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.04, ease: "power2.out", immediateRender: true },
          at + k * 0.0035);
        if (i < 3) tl.to(w, { opacity: 0, y: -12, duration: 0.03, ease: "sine.in" }, out + k * 0.001);
      });
    });

    // screen geometry morphs between beats
    for (let i = 1; i < MODES.length; i++) {
      const g = MODES[i].screen;
      tl.to(screen, {
        left: g.left, top: g.top, width: g.width, height: g.height,
        duration: 0.09, ease: "sine.inOut",
      }, i * SEG - 0.02);
    }

    // per-mode layers
    tl.to(vUwide, { opacity: 1, duration: 0.05 }, SEG - 0.02);      // ultra-wide letterbox
    tl.to(vUwide, { opacity: 0, duration: 0.05 }, 2 * SEG - 0.02);
    tl.to(v3d, { opacity: 1, duration: 0.06 }, 2 * SEG + 0.01);      // 3d breakout
    tl.to(v3d, { opacity: 0, duration: 0.05 }, 3 * SEG - 0.04);
    tl.to(vAnchor, { opacity: 0, duration: 0.05 }, 2 * SEG - 0.01);  // anchor clip off during 3d/side
    // side mode: full-bleed clip; screen + border dissolve
    tl.to(vSide, { opacity: 1, duration: 0.07 }, 3 * SEG);
    tl.to(sideVeil, { opacity: 1, duration: 0.07 }, 3 * SEG);
    tl.to(screen, { opacity: 0, duration: 0.06 }, 3 * SEG);

    // active tab tracking + proximity playback
    let cur = -1;
    const setTab = (i: number) => {
      if (i === cur) return;
      cur = i;
      tabs.forEach((t, k) => t.classList.toggle("on", k === i));
    };
    setTab(0);
    tl.eventCallback("onUpdate", () => {
      setTab(Math.min(3, Math.floor(tl.progress() / SEG)));
    });

    // tabs click → glide scroll to the beat centre
    tabs.forEach((t) =>
      t.addEventListener("click", () => {
        const st = tl.scrollTrigger!;
        const i = Number(t.dataset.i);
        const p = i * SEG + SEG * 0.45;
        ctx.lenis.scrollTo(st.start + (st.end - st.start) * p, {
          duration: 1.1,
          easing: (x) => 1 - Math.pow(1 - x, 3),
        });
      })
    );

    // play/pause loops on proximity (battery + decode sanity)
    const vids = [vSide, v3d, vAnchor, vUwide];
    const near = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const on = r.bottom > -vh && r.top < vh * 2;
      vids.forEach((v) => {
        if (on && v.paused) v.play().catch(() => {});
        else if (!on && !v.paused) v.pause();
      });
    };
    ctx.lenis.on("scroll", near);
    ctx.ScrollTrigger.addEventListener("refresh", near);
    near();
  },
};
