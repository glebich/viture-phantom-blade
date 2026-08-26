import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { mountCine, cineHtml } from "../../lib/cine";
import { reportMeasuredRate } from "../../lib/net";
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
      clip: "intro60",
      count: 122,
      lengthVh: 3.6,
      videoSpan: 0.82,
      ctx,
      el,
      beats: [
        { sel: ".hero-title", at: 0.855, words: true },
        { sel: ".hero-tag", at: 0.895, words: false },
        { sel: ".hero-price", at: 0.9, words: false, mask: "rise", drift: 14 },
        { sel: ".hero-cta", at: 0.925, words: false, mask: "rise", maskBg: 116, drift: 12 },
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
    // Play the intro through at the clip's natural speed (121 kept frames =
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

    const store = rail.store("intro60")!;
    // The client's spec, verbatim: assets load "together with website on
    // pre loader, at least first 2 asset and than rest is loading on
    // background". The second clip's store used to sit dormant until its
    // section scrolled near — on a phone the visitor left the loader with
    // none of it and watched it trickle in mid-scroll. Prime it NOW; the
    // shared scheduler still finishes the intro first (nearest wins).
    // (s06 mounts after s02, so the second clip's store appears a beat
    // later — look it up until it does, then prime it once)
    let store2 = rail.store("clip260");
    let primed = false;
    const prime2 = () => {
      if (!store2) store2 = rail.store("clip260");
      if (store2 && !primed) { primed = true; store2.activate?.(); }
    };
    prime2();
    // measure the real download rate off the opening frames (~30KB each);
    // a clearly slow line drops every un-fetched frame a tier (net.ts)
    // The gameplay loop is 6.1MB and the browser preloads it IN PARALLEL
    // with the opening frames — on a thin line it ate most of the bandwidth
    // and the frames starved behind it. Phones get the 1.4MB SD encode, and
    // the moment the line measures slow the video leaves the loading gate
    // entirely (preload off; it buffers later, behind the frames).
    if (window.matchMedia("(max-width: 640px)").matches) {
      gp.src = "/video/gameplay-sd.mp4";
    }
    let measured = false;
    let slowLine = false;
    const mT0 = performance.now();
    const MEASURE_N = 6;
    const AVG_FRAME_BYTES = 30_000;
    store.onLoad.add(() => {
      if (measured) return;
      const got = store.loaded.filter(Boolean).length;
      if (got >= MEASURE_N) {
        measured = true;
        const secs = (performance.now() - mT0) / 1000;
        const rate = (got * AVG_FRAME_BYTES) / Math.max(0.1, secs);
        reportMeasuredRate(rate);
        if (rate < 250_000) {
          slowLine = true;
          // slow line: the frames own the pipe; the loop streams when played
          videoGated = false;
          gp.preload = "none";
          try { gp.removeAttribute("preload"); gp.preload = "none"; } catch {}
        }
      }
    });
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
    // stutter-free first scrub. Demanding the full set up front cost ~7s
    // on a 4 Mbit line for frames nobody had reached yet.
    const WEIGHT_FRAMES = 0.6;  // how the two split the percentage
    const FRAMES_ENOUGH = 1.0; // BOTH opening clips, complete (client)
    // 2s is enough head start: the loop's bitrate (~2.6 Mbit) is below any
    // link that gets the HD file at all, so playback never catches the
    // download — and a frugal connection is on the 1.16MB SD cut instead.
    const VIDEO_LEAD_S = 2;
    // Two caps: a fast line that stalls oddly still exits at 20s, but a line
// the measurement has CONFIRMED slow gets the long cap — the client's
// priority is "smooth even on low band", and a visitor watching an honest
// counter climb is better served than one released into a stuttering film.
const HARD_CAP_MS = 20000;
const HARD_CAP_SLOW_MS = 38000;
    // iOS Safari ignores preload="auto" — a video downloads nothing until it
    // is played — so the video half of this bar never moved on a phone: it sat
    // at 60% (the frames' full weight) until the failsafe fired and then ran
    // to 100 in a blink (client: "on iphone loader stock on 60% and than do
    // 100% in 1 sec"). If nothing has buffered by the time the frames are
    // well underway, the platform is not going to preload it at all, so the
    // loop drops out of the gate and buffers when it plays instead.
    let videoGated = true;
    const PRELOAD_GRACE_MS = 2600;
    const videoReady = () => {
      if (!videoGated) return 1;
      if (
        performance.now() - t0 > PRELOAD_GRACE_MS &&
        gp.readyState < 2 &&
        (!gp.buffered || gp.buffered.length === 0)
      ) {
        videoGated = false;
        return 1;
      }
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
          rail.show("intro60", Math.min(1, tl.progress() / 0.82));
          if (tl.progress() < 0.08) gp.play().catch(() => {});
        },
      });
    };
    const tick = () => {
      if (done) return;
      prime2();
      const got1 = store.loaded.filter(Boolean).length;
      const got2 = store2 ? store2.loaded.filter(Boolean).length : 0;
      const n1 = store.loaded.length;
      const n2 = store2 ? store2.loaded.length : 0;
      const frames = (got1 + got2) / Math.max(1, n1 + n2);
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
      const cap = slowLine ? HARD_CAP_SLOW_MS : HARD_CAP_MS;
      if (import.meta.env.DEV) {
        loader.dataset.dbg = JSON.stringify({
          v: 3, got1, got2, n1, n2, vid: +vid.toFixed(2),
          slow: slowLine, shown: +shown.toFixed(3), real: +real.toFixed(3),
          el: Math.round(elapsed / 100) / 10,
        });
      }
      if (shown > 0.995 && (ready || elapsed > cap)) finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(finish, HARD_CAP_SLOW_MS + 2000); // never trap the visitor
  },
};
