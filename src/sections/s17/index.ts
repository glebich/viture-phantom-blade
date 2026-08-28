import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { splitWords, scrubTurn, scrubFlare } from "../../lib/textfx";
import { scrubMaskReveal } from "../../lib/assetfx";
import { setRest } from "../../lib/rests";
import { mountWashRail } from "../s16";

const PREORDER_URL =
  "https://www.viture.com/product/viture-x-phantom-blade-zero-phantom-beast-xr-glasses?color=Jet+Black&size=Regular+%28IPD+64.0%C2%B16.0+mm%29";

export const s17: Section = {
  id: "s17",
  html: `
    <img class="s17-ground" src="/assets/ui/bg17-1920.webp" srcset="/assets/ui/bg17-768.webp 768w, /assets/ui/bg17-1280.webp 1280w, /assets/ui/bg17-1920.webp 1920w, /assets/ui/bg17-2880.webp 2880w" sizes="100vw" alt="" aria-hidden="true" />
    <div class="stage">
      <img class="s17-lockup" src="/assets/ui/lockup.png" alt="VITURE × Phantom Blade Ø" />
      <h2 class="s17-title">Pre-order<br/>Exclusive</h2>
      <p class="s17-body t-caps">A hand-drawn map of the world shrouded in darkness. Meticulously crafted, richly detailed—made for those who explore every shadow.</p>
      <a class="cta-paper s17-cta" href="${PREORDER_URL}" target="_blank" rel="noopener" aria-label="Pre-Order Now"></a>
      <p class="s17-maplabel">Limited Collector's Edition Game Map</p>
      <img class="s17-map" src="/assets/ui/map.png" alt="Collector's edition hand-drawn game map" />
      <p class="s17-foot t-caps">Limited To Pre-Order Customers Only.</p>
      <button class="s17-again" type="button" aria-label="Watch again from the top">
        <span class="s17-again-arrow" aria-hidden="true"></span>
        <span class="s17-again-label">Watch Again</span>
      </button>
    </div>
  `,
  init(el, ctx: SectionCtx) {
    const { gsap } = ctx;
    mountWashRail(el);
    const title = el.querySelector<HTMLElement>(".s17-title")!;
    const words = splitWords(title);
    gsap.set(words, { opacity: 0 });
    const rest = [".s17-lockup", ".s17-body", ".s17-cta", ".s17-maplabel", ".s17-foot", ".s17-again"]
      .map((s) => el.querySelector<HTMLElement>(s)!)
      .filter(Boolean);
    const map = el.querySelector<HTMLElement>(".s17-map")!;

    // ---------------------------------------------------------------------
    // Idle life (client: "add some micro animation with assets and text").
    // Time-based, not scrubbed: these run while the finale is on screen and
    // sleep the moment it leaves, so they never fight the arrival tweens —
    // every one animates a property the scrub never touches on that element
    // (the map floats on x-rotation-free y/rotation, the arrival owns
    // opacity/clip). Reduced motion skips the lot.
    // ---------------------------------------------------------------------
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const idle: gsap.core.Tween[] = [];
    if (!reduced) {
      // the scroll HANGS — it sways as if on its cords
      idle.push(gsap.to(map, {
        y: 9, rotation: 0.55, transformOrigin: "50% 8%",
        duration: 3.4, ease: "sine.inOut", yoyo: true, repeat: -1, paused: true,
      }));
      // the paper CTA breathes, the way it would in a hand
      const cta = el.querySelector<HTMLElement>(".s17-cta");
      if (cta) idle.push(gsap.to(cta, {
        scale: 1.016, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1, paused: true,
      }));
      // a hot shimmer walks the title every few breaths, then cools — the
      // same flare language as the arrivals, idling
      const shimmer = gsap.timeline({ repeat: -1, repeatDelay: 6.5, paused: true });
      words.forEach((w, i) => {
        shimmer.to(w, {
          textShadow: "0 0 14px rgba(255,238,230,0.85), 0 0 34px rgba(232,52,42,0.5)",
          duration: 0.34, ease: "sine.in",
        }, i * 0.09).to(w, {
          textShadow: "0 0 0px rgba(255,238,230,0), 0 0 0px rgba(232,52,42,0)",
          duration: 0.8, ease: "sine.out",
        }, i * 0.09 + 0.34);
      });
      idle.push(shimmer as unknown as gsap.core.Tween);
      // the WATCH AGAIN arrow lifts, inviting
      const arrow = el.querySelector<HTMLElement>(".s17-again-arrow");
      if (arrow) idle.push(gsap.to(arrow, {
        y: -5, duration: 1.5, ease: "sine.inOut", yoyo: true, repeat: -1, paused: true,
      }));
      // wake on screen, sleep off screen
      let on = false;
      const gate = () => {
        const r = el.getBoundingClientRect();
        const want = r.bottom > 0 && r.top < innerHeight;
        if (want !== on) { on = want; idle.forEach((t) => (want ? t.play() : t.pause())); }
      };
      ctx.lenis.on("scroll", gate);
      ctx.ScrollTrigger.addEventListener("refresh", gate);
      requestAnimationFrame(gate);
    }

    // the end of the film should offer the way back rather than a dead stop
    el.querySelector<HTMLButtonElement>(".s17-again")!.addEventListener("click", () => {
      ctx.lenis.scrollTo(0, { duration: 2.6, easing: (t) => 1 - Math.pow(1 - t, 3) });
    });

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: el,
        start: "top 55%",
        end: "top top",
        scrub: true,
      },
    });
    setRest("s17", tl, 1);
    tl.to({}, { duration: 1 }, 0);
    scrubTurn(tl, title, words, 0.22, 0.05, { tilt: 0.2 });
    scrubFlare(tl, words, 0.22, 0.05, { cool: 0.16 });
    words.forEach((w, i) => {
      tl.fromTo(w, { opacity: 0 },
        { opacity: 1, duration: 0.22, ease: "power2.out", immediateRender: true },
        0.22 + i * 0.05);
    });
    rest.forEach((r, i) => {
      tl.fromTo(r, { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "sine.out", immediateRender: true }, 0.28 + i * 0.06);
    });
    // the map UNROLLS — the mask sweeps downward like the scroll being let
    // out, the artwork settling inside it (fantasy.co grammar)
    scrubMaskReveal(tl, map, 0.26, { duration: 0.52, dir: "unroll", scaleFrom: 1.06, drift: -20 });
    // the light behind the papyrus breathes in with the page
    tl.fromTo("#wash-glow", { opacity: 0 },
      { opacity: 1, duration: 0.55, ease: "sine.inOut", immediateRender: true }, 0.25);
  },
};
