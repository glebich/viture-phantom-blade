import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { splitWords } from "../../lib/textfx";

const PREORDER_URL = "https://www.viture.com/";

export const s17: Section = {
  id: "s17",
  html: `
    <div class="s17-plate"></div>
    <div class="stage">
      <img class="pb-threads" src="/assets/ui/threads17.png" alt="" aria-hidden="true" />
      <img class="s17-lockup" src="/assets/ui/lockup.png" alt="VITURE × Phantom Blade Ø" />
      <h2 class="s17-title">Pre-order<br/>Exclusive</h2>
      <p class="s17-body t-caps">A hand-drawn map of the world shrouded in darkness. Meticulously crafted, richly detailed—made for those who explore every shadow.</p>
      <a class="cta-paper s17-cta" href="${PREORDER_URL}" target="_blank" rel="noopener" aria-label="Pre-Order Now"></a>
      <p class="s17-maplabel">Limited Collector's Edition Game Map</p>
      <img class="s17-map" src="/assets/ui/map.webp" alt="Collector's edition hand-drawn game map" />
      <p class="s17-foot t-caps">Limited To Pre-Order Customers Only.</p>
    </div>
  `,
  init(el, ctx: SectionCtx) {
    const { gsap } = ctx;
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
      tl.fromTo(w, { opacity: 0, y: 26, filter: "blur(7px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.22, ease: "power2.out", immediateRender: true },
        0.22 + i * 0.05);
    });
    rest.forEach((r, i) => {
      tl.fromTo(r, { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.3, ease: "sine.out", immediateRender: true }, 0.28 + i * 0.06);
    });
    tl.fromTo(map, { opacity: 0, y: 60, rotation: 2 },
      { opacity: 1, y: 0, rotation: 0, duration: 0.5, ease: "power2.out", immediateRender: true }, 0.3);
  },
};
