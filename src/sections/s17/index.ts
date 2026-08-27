import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { splitWords, scrubTurn, scrubFlare } from "../../lib/textfx";
import { scrubMaskReveal } from "../../lib/assetfx";
import { setRest } from "../../lib/rests";
import { mountWashRail } from "../s16";

const PREORDER_URL = "https://www.viture.com/";

export const s17: Section = {
  id: "s17",
  html: `
    <div class="stage">
      <img class="s17-glyph s17-glyph--ying" src="/assets/ui/glyph-ying.png" alt="" aria-hidden="true" />
      <img class="s17-glyph s17-glyph--ling" src="/assets/ui/glyph-ling.png" alt="" aria-hidden="true" />
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
    <img class="s17-mountains" src="/assets/ui/mountains2.webp" alt="" aria-hidden="true" />
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
