import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { splitWords } from "../../lib/textfx";
import { scrubAssetArrival } from "../../lib/assetfx";
import { mountWashRail } from "../s16";

const PREORDER_URL = "https://www.viture.com/";

export const s17: Section = {
  id: "s17",
  html: `
    <div class="stage">
      <img class="s17-lockup" src="/assets/ui/lockup.png" alt="VITURE × Phantom Blade Ø" />
      <h2 class="s17-title">Pre-order<br/>Exclusive</h2>
      <p class="s17-body t-caps">A hand-drawn map of the world shrouded in darkness. Meticulously crafted, richly detailed—made for those who explore every shadow.</p>
      <a class="cta-paper s17-cta" href="${PREORDER_URL}" target="_blank" rel="noopener" aria-label="Pre-Order Now"></a>
      <p class="s17-maplabel">Limited Collector's Edition Game Map</p>
      <img class="s17-map" src="/assets/ui/map.png" alt="Collector's edition hand-drawn game map" />
      <p class="s17-foot t-caps">Limited To Pre-Order Customers Only.</p>
    </div>
  `,
  init(el, ctx: SectionCtx) {
    const { gsap } = ctx;
    mountWashRail(el);
    const title = el.querySelector<HTMLElement>(".s17-title")!;
    const words = splitWords(title);
    gsap.set(words, { opacity: 0 });
    const rest = [".s17-lockup", ".s17-body", ".s17-cta", ".s17-maplabel", ".s17-foot"]
      .map((s) => el.querySelector<HTMLElement>(s)!)
      .filter(Boolean);
    const map = el.querySelector<HTMLElement>(".s17-map")!;

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: el,
        start: "top 55%",
        end: "top top",
        scrub: true,
      },
    });
    tl.to({}, { duration: 1 }, 0);
    words.forEach((w, i) => {
      tl.fromTo(w, { opacity: 0 },
        { opacity: 1, duration: 0.22, ease: "power2.out", immediateRender: true },
        0.22 + i * 0.05);
    });
    rest.forEach((r, i) => {
      tl.fromTo(r, { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "sine.out", immediateRender: true }, 0.28 + i * 0.06);
    });
    // the map scroll unrolls out of the dark — the slowest asset on the page
    scrubAssetArrival(tl, map, 0.26, { duration: 0.52, drift: 34, blur: 16, scale: 0.955 });
    // the light behind the papyrus breathes in with the page
    tl.fromTo("#wash-glow", { opacity: 0 },
      { opacity: 1, duration: 0.55, ease: "sine.inOut", immediateRender: true }, 0.25);
  },
};
