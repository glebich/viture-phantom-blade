import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { mountCine, cineHtml } from "../../lib/cine";

/* s02 — Loader → intro cinematic scrub → Ø logo beat → hero rest.
 * The intro clip plays on the shared rail, forward with scroll and in
 * reverse when scrolling back; its final frame is the hero background. */

const PREORDER_URL = "https://www.viture.com/";

export const s02: Section = {
  id: "s02",
  html: cineHtml(`
    <div class="stage stage--d">
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
      <div class="ld-veil"></div>
      <div class="stage stage--d">
        <img class="ld-wordmark" src="/assets/ui/wordmark.png" alt="VITURE" />
        <img class="ld-thread" src="/assets/ui/loader-thread.png" alt="" aria-hidden="true" />
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
      lengthVh: 5,
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
        // Ø logo beat (chapter 04) — in around the 2s mark of the clip
        const logo = el.querySelector<HTMLElement>(".s02-logo")!;
        tl.fromTo(logo, { opacity: 0, scale: 0.97 },
          { opacity: 1, scale: 1, duration: 0.06, ease: "sine.out", immediateRender: true }, 0.36);
        tl.to(logo, { opacity: 0, scale: 1.02, duration: 0.06, ease: "sine.in" }, 0.52);
        const skip = el.querySelector<HTMLElement>(".s02-skip")!;
        tl.fromTo(skip, { opacity: 0.75 }, { opacity: 0, duration: 0.04, immediateRender: false }, 0.8);
      },
    });

    // header phasing: no menu until the hero rest (design 02–04 headers
    // carry no nav)
    const phase = () => {
      document.documentElement.classList.toggle("cinema", tl.progress() < 0.8);
    };
    tl.eventCallback("onUpdate", phase);

    // ---- Skip ----
    el.querySelector<HTMLButtonElement>(".s02-skip")!.addEventListener("click", () => {
      const st = tl.scrollTrigger!;
      ctx.lenis.scrollTo(st.start + (st.end - st.start) * 0.97, {
        duration: 1.6,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    });

    // ---- Loader (chapter 01): the red thread draws in as progress ----
    const loader = el.querySelector<HTMLElement>(".s02-loader")!;
    const num = el.querySelector<HTMLElement>(".ld-num")!;
    const thread = el.querySelector<HTMLElement>(".ld-thread")!;
    ctx.lenis.stop();
    document.documentElement.classList.add("loading", "cinema");

    const store = rail.store("intro")!;
    const t0 = performance.now();
    const MIN_MS = 2400;
    let done = false;
    let shown = 0; // eased displayed progress
    const finish = () => {
      if (done) return;
      done = true;
      gsap.to(loader, {
        opacity: 0,
        duration: 1.0,
        ease: "sine.inOut",
        onComplete: () => {
          loader.style.display = "none";
          document.documentElement.classList.remove("loading");
        },
      });
      ctx.lenis.start();
      rail.show("intro", 0);
    };
    const tick = () => {
      if (done) return;
      const real = store.loaded.filter(Boolean).length / 62;
      const timed = Math.min(1, (performance.now() - t0) / MIN_MS);
      const target = Math.min(timed, real === 1 ? 1 : Math.max(real * 0.92, timed * 0.66));
      shown += (target - shown) * 0.12; // soft ease toward target
      if (target >= 1) shown = Math.min(1, shown + 0.012);
      num.textContent = String(Math.round(shown * 100));
      thread.style.clipPath = `inset(0 ${Math.max(0, 100 - shown * 108)}% 0 0)`;
      if (shown > 0.995 && real >= 0.35) finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(finish, 10000); // never trap the visitor
  },
};
