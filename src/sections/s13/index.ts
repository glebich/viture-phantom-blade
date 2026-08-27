import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { splitWords, scrubTurn, scrubFlare, scrubWordExit } from "../../lib/textfx";
import { tierUrl } from "../../lib/cine";
import { setRest, setStops } from "../../lib/rests";

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
    <video class="s13-side" muted loop playsinline preload="none" data-src="/video/sidemode.mp4" data-m-src="/video/sidemode-m.mp4"></video>
    <div class="s13-side-veil"></div>
    <div class="stage">
      <div class="s13-screen">
        <video class="s13-v s13-v-anchor" muted loop playsinline preload="none" data-src="/video/ultrawide.mp4"></video>
        <video class="s13-v s13-v-uwide" muted loop playsinline preload="none" data-src="/video/ultrawide.mp4" style="object-fit:contain;opacity:0"></video>
        <img class="s13-handoff" alt="" aria-hidden="true" loading="eager" decoding="async" />
      </div>
      <video class="s13-3d" muted loop playsinline preload="none" data-src="/video/3dmode.mp4"></video>
      ${MODES.map((m, i) => `
        <button class="s13-tab${i === 0 ? " on" : ""}" role="tab" data-i="${i}" aria-label="${m.title}"
          style="left:${[782, 901, 1019, 1138][i]}px">
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

    // the section's ground lives behind the red thread (see style.css)
    const back = document.createElement("div");
    back.id = "s13-back";
    back.setAttribute("aria-hidden", "true");
    const mainEl = document.getElementById("sections")!;
    document.body.insertBefore(back, mainEl);
    // The backdrop is FIXED and full-viewport, so switching it on the moment
    // the section peeked into view painted right over the still-visible
    // previous chapter: a black band with the film cut in half across it
    // (client: "no transition between A 174-INCH BATTLEFIELD and the next
    // one"). It now tracks how much of the viewport this section actually
    // covers, so the rail's last frame stays lit until this chapter owns the
    // screen. No CSS transition on it either — it has to follow the scroll
    // exactly, or the lag reopens the band.
    let coverage = 0;
    let morph = 0; // 0 = the film still owns the whole screen, 1 = TV landed
    const applyBack = () => {
      // Only as the picture MINIMISES does the ground appear around it. Ramping
      // this with coverage instead buried the rail's last frame under the
      // gradient and then the section's own copy re-revealed it, so the same
      // background read twice with a hard join in between (client: "should
      // never have 2 bg's… one on A 174-inch battlefield page minimized inside
      // tv screen mask").
      back.style.opacity = coverage === 0 ? "0" : String(morph);
    };
    const backSync = () => {
      const r = el.getBoundingClientRect();
      const vis = Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top));
      coverage = Math.min(1, vis / Math.max(1, innerHeight));
      applyBack();
      gateScreen();
    };
    ctx.lenis.on("scroll", backSync);
    ctx.ScrollTrigger.addEventListener("refresh", backSync);

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
        end: "+=320%",
        pin: true,
        scrub: true,
        anticipatePin: 1,
      },
    });

    // Sliding in, the rail is still carrying clip6's last frame across the
    // fold while this section's own copy of that frame rides up with the
    // section — the same picture at two different offsets, which would
    // double-expose the temple. So the screen stays dark until the section
    // covers the viewport, at which point the two are pixel-identical and the
    // handover is invisible. Only gated on the way IN (progress still 0);
    // afterwards the scrub owns the screen's opacity.
    // visibility, NOT opacity: the scrub owns the screen's opacity (it
    // dissolves the frame for side mode), and writing "" to it here wiped
    // that value on any scroll event — the empty black box with its red
    // border reappeared over the full-bleed side clip.
    function gateScreen() {
      const hide = tl && tl.progress() <= 0.001 && coverage <= 0.995;
      screen.style.visibility = hide ? "hidden" : "";
    }
    backSync();


    // ---- the film hands its last frame to the TV (client: "no transition
    // between A 174-INCH BATTLEFIELD and the next one; it should be a smooth
    // transition of the final frame of the video into the Anchor mode TV, and
    // then to the playing loop in this tv mask") ----
    // s11 rests holding clip6's final frame full-bleed, so THAT frame is the
    // still inside this screen: the chapter opens with the screen covering the
    // viewport — the same picture, no cut — then contracts into the anchor box
    // with its red frame materialising, and only once it lands does the still
    // dissolve into the looping clip underneath.
    const handoff = el.querySelector<HTMLImageElement>(".s13-handoff")!;
    handoff.src = tierUrl("clip660")(60);
    const cs = getComputedStyle(document.documentElement);
    const SW = parseFloat(cs.getPropertyValue("--stage-w")) || 1920;
    const SH = parseFloat(cs.getPropertyValue("--stage-h")) || 1080;
    // offset* are layout values in the stage's own coordinate system, so they
    // are design px whatever the stage's cover transform is doing
    const bw = screen.offsetWidth || 1158;
    const bh = screen.offsetHeight || 724;
    const cover = Math.max(SW / bw, SH / bh);
    const dx = SW / 2 - (screen.offsetLeft + bw / 2);
    const dy = SH / 2 - (screen.offsetTop + bh / 2);
    tl.fromTo(
      screen,
      { x: dx, y: dy, scale: cover, borderColor: "rgba(194,42,32,0)" },
      {
        x: 0, y: 0, scale: 1, borderColor: "rgba(194,42,32,1)",
        duration: 0.11, ease: "power2.inOut", immediateRender: true,
      },
      0
    );
    tl.fromTo(handoff, { opacity: 1 },
      { opacity: 0, duration: 0.06, ease: "sine.inOut", immediateRender: true }, 0.115);
    // the ground arrives with the contraction, never before it
    const mp = { v: 0 };
    tl.fromTo(mp, { v: 0 },
      { v: 1, duration: 0.11, ease: "sine.out", immediateRender: true,
        onUpdate: () => { morph = mp.v; applyBack(); } }, 0);

    // copy in/out per beat
    //
    // The stagger is normalised to a fixed REVEAL span instead of a fixed
    // per-word step. The four copies run 19, 17, 23 and 26 words, so a flat
    // 0.0035 per word made every reveal a different length and all of them
    // longer than the beat that held them: the scroll came to rest with the
    // sentence still arriving, and mode 0 was worse than that — its last
    // words landed at 0.228 while its own fade-out began at 0.205, so the
    // full line could never be seen at all (client: "scroll stops on the page
    // before whole text show up").
    //
    // The stop for each mode is now DERIVED from these same numbers rather
    // than guessed alongside them, so the two cannot drift apart again.
    const REVEAL = 0.045; // progress over which a whole copy arrives
    const WORD_IN = 0.03; // how long one word takes
    const modeStops: number[] = [];
    MODES.forEach((_, i) => {
      // mode 0 waits for the morph above to seat the screen
      const at = i === 0 ? 0.115 : i * SEG + 0.02;
      const out = (i + 1) * SEG - 0.02;
      const stepK = REVEAL / Math.max(1, wordSets[i].length - 1);
      scrubTurn(tl, copies[i], wordSets[i], at, stepK, { tilt: 0.05 });
      scrubFlare(tl, wordSets[i], at, stepK, { cool: 0.045 });
      wordSets[i].forEach((w, k) => {
        tl.fromTo(w, { opacity: 0 },
          { opacity: 1, duration: WORD_IN, ease: "power2.out", immediateRender: true },
          at + k * stepK);
      });
      // the copy leaves as a wave across the line, not a blink; it overlaps
      // the next mode's arrival slightly, which reads as a cross-dissolve
      if (i < 3) {
        scrubWordExit(tl, copies[i], wordSets[i], out,
          0.03 / Math.max(1, wordSets[i].length - 1), { dur: 0.04, blur: 4 });
      }
      // a beat past the last word landing — the page is READ here, not still
      // assembling, and comfortably before this mode starts to leave
      modeStops.push(Math.min(out - 0.02, at + REVEAL + WORD_IN + 0.015));
    });

    // This chapter is FOUR of the client's pages, not one: each mode is a
    // stop of its own. The dots land on the first (see rests.ts).
    setRest("s13", tl, modeStops[0]);
    setStops("s13", tl, modeStops);

    // screen geometry morphs between beats
    for (let i = 1; i < MODES.length; i++) {
      const g = MODES[i].screen;
      tl.to(screen, {
        left: g.left, top: g.top, width: g.width, height: g.height,
        duration: 0.09, ease: "sine.inOut",
      }, i * SEG - 0.02);
    }

    // Per-mode layers, CROSS-FADED. The anchor clip used to stay on until the
    // 3D beat, which worked on desktop only because the screen box reshapes to
    // 21:9 and the ultra-wide clip covers it exactly. On a phone the box keeps
    // one fixed rect, so the contained ultra-wide clip letterboxed and the
    // anchor showed through above and below it — three clips stacked on screen
    // at once instead of one (client). The anchor now hands over as ultra-wide
    // arrives, so exactly one clip is ever lit.
    tl.to(vAnchor, { opacity: 0, duration: 0.05 }, SEG - 0.02);
    tl.to(vUwide, { opacity: 1, duration: 0.05 }, SEG - 0.02);      // ultra-wide letterbox
    tl.to(vUwide, { opacity: 0, duration: 0.05 }, 2 * SEG - 0.02);
    tl.to(v3d, { opacity: 1, duration: 0.06 }, 2 * SEG + 0.01);      // 3d breakout
    // Side mode: the full-bleed clip rises exactly as the frame and the 3D
    // clip dissolve. They used to be staggered, which left a window where the
    // frame had no clip inside it and its #000 ground showed as an empty black
    // plate with a red border over the bamboo (client: "delete mask frame on
    // this screen"). One cross-fade now — no beat where the frame is empty.
    const OUT = 3 * SEG - 0.06;
    tl.to(v3d, { opacity: 0, duration: 0.06 }, OUT);
    tl.to(screen, { opacity: 0, duration: 0.06 }, OUT);
    tl.to(vSide, { opacity: 1, duration: 0.07 }, OUT);
    tl.to(sideVeil, { opacity: 1, duration: 0.07 }, OUT);

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
    //
    // The four clips are 5.2MB between them and this chapter is most of the
    // way down the page, but with a `src` in the markup the browser pulled
    // them DURING the loader — on a 4 Mbit line they were taking the
    // bandwidth the opening needed, and the intro was still buffering while
    // the mode clips downloaded (client: "make it smooth on low band").
    // preload="none" + a deferred src means nothing here touches the network
    // until the chapter is within a viewport.
    const vids = [vSide, v3d, vAnchor, vUwide];
    const attach = (v: HTMLVideoElement) => {
      // phones get the vertical re-render where one exists (the client's
      // Side-Mode V_1) — the landscape clip centre-cropped to a ninth of
      // its frame on a portrait screen
      const src = (window.matchMedia("(max-width: 640px)").matches && v.dataset.mSrc) || v.dataset.src;
      if (!src || v.src) return;
      v.preload = "auto";
      v.src = src;
    };
    const near = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const on = r.bottom > -vh && r.top < vh * 2;
      vids.forEach((v) => {
        if (on) attach(v);
        if (on && v.paused) v.play().catch(() => {});
        else if (!on && !v.paused) v.pause();
      });
    };
    ctx.lenis.on("scroll", near);
    ctx.ScrollTrigger.addEventListener("refresh", near);
    near();
  },
};
