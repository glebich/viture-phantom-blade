import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { mountCine, cineHtml } from "../../lib/cine";
import { videoTier } from "../../lib/net";

/* s02 — Loader → intro cinematic scrub → Ø logo beat → hero rest.
 * The intro clip plays on the shared rail, forward with scroll and in
 * reverse when scrolling back; its final frame is the hero background. */

const PREORDER_URL = "https://www.viture.com/";

export const s02: Section = {
  id: "s02",
  html: cineHtml(`
    <video class="s02-gameplay" muted loop playsinline preload="auto"></video>
    <div class="s02-logoveil"></div>
    <div class="stage">
      <button class="s02-skip" type="button">Skip</button>
      <div class="s02-logo"><img src="/assets/ui/logo-pbz.png" alt="VITURE × Phantom Blade Ø" /></div>
      <div class="s02-hero">
        <h1 class="hero-title" data-beat="title">Phantom Beast<br/>XR Glasses</h1>
        <p class="hero-tag t-caps" data-beat="tag">Forged in shadow. Sharpened for play.</p>
        <div class="hero-price" data-beat="price">
          <img src="/assets/ui/glasses.png" alt="" aria-hidden="true" /><b>$599</b>
        </div>
        <a class="cta-paper hero-cta" data-beat="cta" href="${PREORDER_URL}" target="_blank" rel="noopener" aria-label="Pre-Order Now"></a>
      </div>
    </div>
    <div class="s02-loader">
      <div class="stage">
        <img class="ld-wordmark" src="/assets/ui/wordmark.png" alt="VITURE" />
        <img class="ld-thread" src="/assets/ui/loader-thread-3.png" alt="" aria-hidden="true" />
        <div class="ld-count"><span class="ld-num">0</span><sup>%</sup></div>
        <div class="ld-label">Loading...</div>
      </div>
    </div>
  `),
  init(el, ctx: SectionCtx) {
    const { gsap } = ctx;

    const { tl, rail } = mountCine({
      id: "s02",
      clip: "intro",
      count: 62,
      lengthVh: 3.6,
      videoSpan: 0.82,
      ctx,
      el,
      beats: [
        { sel: ".hero-title", at: 0.855, words: true },
        { sel: ".hero-tag", at: 0.895, words: false },
        { sel: ".hero-price", at: 0.9, words: false, drift: 14 },
        { sel: ".hero-cta", at: 0.925, words: false, drift: 14 },
      ],
      onTimeline(tl) {
        // gameplay loop (chapter 02 rest): plays after the loader; the first
        // scroll (or Skip) dissolves it into the intro scrub — and scrolling
        // back to the top brings it back
        const gp = el.querySelector<HTMLVideoElement>(".s02-gameplay")!;
        tl.fromTo(gp, { opacity: 1 }, { opacity: 0, duration: 0.06, ease: "sine.in", immediateRender: false }, 0.005);
        // Ø logo beat (chapter 04) — in around the 2s mark of the clip
        // The film dims to near-black under the lockup so the white mark is
        // actually readable (client), holds through the beat, then lifts.
        const veil = el.querySelector<HTMLElement>(".s02-logoveil")!;
        tl.fromTo(veil, { opacity: 0 },
          { opacity: 0.82, duration: 0.06, ease: "sine.out", immediateRender: true }, 0.26);
        tl.to(veil, { opacity: 0, duration: 0.09, ease: "sine.inOut" }, 0.66);
        const logo = el.querySelector<HTMLElement>(".s02-logo")!;
        // condenses out of the air and dissolves back into it, unhurried —
        // the window is wide enough to rest on the mark for a couple of
        // seconds at reading speed instead of flashing past
        tl.fromTo(logo, { opacity: 0, scale: 0.955, filter: "blur(14px)" },
          { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.1, ease: "power2.out", immediateRender: true }, 0.29);
        tl.to(logo, { opacity: 0, scale: 1.03, filter: "blur(8px)", duration: 0.09, ease: "sine.in" }, 0.64);
        const skip = el.querySelector<HTMLElement>(".s02-skip")!;
        tl.fromTo(skip, { opacity: 0.75 }, { opacity: 0, duration: 0.04, immediateRender: false }, 0.8);
      },
    });

    // header phasing (no menu until the hero rest) + gameplay-loop gating
    const gp = el.querySelector<HTMLVideoElement>(".s02-gameplay")!;
    const phase = () => {
      const p = tl.progress();
      document.documentElement.classList.toggle("cinema", p < 0.8);
      const on = p < 0.08 && !document.documentElement.classList.contains("loading");
      if (on && gp.paused) gp.play().catch(() => {});
      else if (!on && !gp.paused) gp.pause();
    };
    tl.eventCallback("onUpdate", phase);

    // ---- Skip ----
    // Play the intro through at the clip's natural speed (62 kept frames =
    // every 2nd source frame ≈ 4s of footage) instead of a fast scrub —
    // linear easing so the film advances like a normal player.
    el.querySelector<HTMLButtonElement>(".s02-skip")!.addEventListener("click", () => {
      const st = tl.scrollTrigger!;
      const CLIP_S = 5.2; // full intro at natural playback speed, logo beat included
      const remain = Math.max(0, 0.97 - tl.progress());
      ctx.lenis.scrollTo(st.start + (st.end - st.start) * 0.97, {
        duration: Math.max(0.8, (remain / 0.97) * CLIP_S),
        easing: (t) => (t < 0.9 ? t : 0.9 + (1 - Math.pow(1 - (t - 0.9) / 0.1, 2)) * 0.1),
      });
    });

    // the loop the loader hands over to — SD on a frugal connection (see
    // lib/net.ts). Set here rather than in the markup so the tier is decided
    // at runtime, and set BEFORE the loader starts counting so it is part of
    // the progress the visitor is waiting on.
    gp.src = `/video/gameplay${videoTier()}.mp4`;

    // ---- Loader (chapter 01): the red thread draws in as progress ----
    const loader = el.querySelector<HTMLElement>(".s02-loader")!;
    const num = el.querySelector<HTMLElement>(".ld-num")!;
    const thread = el.querySelector<HTMLElement>(".ld-thread")!;
    ctx.lenis.stop();
    document.documentElement.classList.add("loading", "cinema");

    // the drawn thread's tip sits at 69.3% of the artwork width (style.css
    // scales it so that point clears the right screen edge); revealing a
    // hair past it lands the tip off-screen at 100% and keeps the PNG's
    // stray tail fragment clipped away for good
    const TIP_PCT = 70;
    const drawThread = (v: number) => {
      thread.style.clipPath = `inset(0 ${Math.max(0, 100 - v * TIP_PCT)}% 0 0)`;
    };

    const store = rail.store("intro")!;
    const t0 = performance.now();
    const MIN_MS = 2400;
    // Client: "make sure the assets load together with the site on the
    // preloader — at least the first 2 assets — and the rest in the
    // background, so it's smooth even on a low-band network."
    //
    // The two things a visitor meets first are the gameplay loop (it plays
    // the moment the loader lifts) and the intro frame sequence (the film the
    // first scroll scrubs). The loader now holds for BOTH, and the percentage
    // is their real combined progress rather than a timer: on a slow link the
    // number genuinely crawls, and when it reaches 100 the opening is
    // actually smooth. Everything after these two — every later chapter's
    // frames, the mode clips — streams in the background through the
    // frameseq scheduler, which always spends bandwidth on whatever is
    // nearest the viewport.
    // What each asset has to reach before the screen is handed over. The
    // loop plays IMMEDIATELY, so it needs a real buffer; the intro frames are
    // not touched until the visitor scrolls, and the scheduler keeps filling
    // them in order behind the scenes, so a majority is enough to guarantee a
    // stutter-free first scrub. Demanding all 62 up front cost an extra ~7s
    // on a 4 Mbit line for frames nobody had reached yet.
    const WEIGHT_FRAMES = 0.6;  // how the two split the percentage
    const FRAMES_ENOUGH = 0.55; // of the intro sequence
    // 2s is enough head start: the loop's bitrate (~2.6 Mbit) is below any
    // link that gets the HD file at all, so playback never catches the
    // download — and a frugal connection is on the 1.16MB SD cut instead.
    const VIDEO_LEAD_S = 2;
    const HARD_CAP_MS = 12000;  // never trap a visitor behind a bad network
    const videoReady = () => {
      if (!gp.duration || !Number.isFinite(gp.duration)) return 0;
      let end = 0;
      try { if (gp.buffered.length) end = gp.buffered.end(gp.buffered.length - 1); } catch { /* empty */ }
      const need = Math.min(gp.duration, VIDEO_LEAD_S);
      return Math.min(1, end / need);
    };
    let done = false;
    let shown = 0; // eased displayed progress
    const finish = () => {
      if (done) return;
      done = true;
      // the thread always completes its draw to the screen edge before the
      // loader fades — never leave it hanging mid-screen
      const o = { v: shown };
      gsap.to(o, {
        v: 1,
        duration: Math.max(0.25, (1 - shown) * 0.9),
        ease: "power1.inOut",
        onUpdate: () => {
          const pct = Math.round(o.v * 100);
          num.textContent = String(pct);
          if (pct >= 100) loader.classList.add("full");
          drawThread(o.v);
        },
        onComplete: () => {
          loader.classList.add("full");
          gsap.to(loader, {
            opacity: 0,
            delay: 0.55,
            duration: 1.0,
            ease: "sine.inOut",
            onComplete: () => {
              loader.style.display = "none";
              document.documentElement.classList.remove("loading");
            },
          });
          ctx.lenis.start();
          // show whatever frame the scrub owns right now (harness sets progress)
          rail.show("intro", Math.min(1, tl.progress() / 0.82));
          if (tl.progress() < 0.08) gp.play().catch(() => {});
        },
      });
    };
    const tick = () => {
      if (done) return;
      const frames = store.loaded.filter(Boolean).length / 62;
      const vid = videoReady();
      // the bar tracks the two assets against what they actually need, so it
      // reads 100 exactly when the opening is ready — not before, not after
      const real =
        Math.min(1, frames / FRAMES_ENOUGH) * WEIGHT_FRAMES +
        vid * (1 - WEIGHT_FRAMES);
      const elapsed = performance.now() - t0;
      const timed = Math.min(1, elapsed / MIN_MS);
      // the bar is the slower of "the assets are in" and "the ceremony has
      // played", so a warm cache still gets the beat and a cold one tells
      // the truth
      const target = Math.min(timed, real);
      shown += (target - shown) * 0.12; // soft ease toward target
      if (target >= 1) shown = Math.min(1, shown + 0.012);
      num.textContent = String(Math.round(shown * 100));
      drawThread(shown);
      const ready = frames >= FRAMES_ENOUGH && vid >= 1;
      if (shown > 0.995 && (ready || elapsed > HARD_CAP_MS)) finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(finish, HARD_CAP_MS + 1000); // never trap the visitor
  },
};
