import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { splitWords } from "../../lib/textfx";

/* The relic cards were cropped from the plate at these exact design rects —
 * landing at identity hides the baked twins beneath (pixel-registered). */
const CARDS = [
  { src: "card-blade", x: 180, y: 342, w: 315, h: 395, rot: -10 },
  { src: "card-strap", x: 548, y: 408, w: 305, h: 360, rot: 8 },
  { src: "card-cloth", x: 886, y: 375, w: 275, h: 335, rot: -7 },
  { src: "card-cards", x: 1276, y: 335, w: 280, h: 355, rot: 9 },
];

export const s16: Section = {
  id: "s16",
  html: `
    <div class="s16-plate"></div>
    <div class="stage stage--d">
      <div class="s16-patch" style="left:560px;top:140px;width:800px;height:200px"></div>
      <div class="s16-patch" style="left:640px;top:930px;width:640px;height:90px"></div>
      <p class="s16-eyebrow">What Else Within The Box</p>
      <h2 class="s16-title">More treasures await within</h2>
      <p class="s16-foot">Starting in October, a new reveal every week.</p>
      ${CARDS.map(
        (c) => `<img class="s16-card" src="/assets/ui/${c.src}.webp" alt=""
          style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px" data-rot="${c.rot}" />`
      ).join("")}
    </div>
  `,
  init(el, ctx: SectionCtx) {
    const { gsap } = ctx;
    const title = el.querySelector<HTMLElement>(".s16-title")!;
    const eyebrow = el.querySelector<HTMLElement>(".s16-eyebrow")!;
    const foot = el.querySelector<HTMLElement>(".s16-foot")!;
    const cards = Array.from(el.querySelectorAll<HTMLElement>(".s16-card"));
    const words = splitWords(title);
    gsap.set(words, { opacity: 0 });

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: el,
        start: "top top",
        end: "+=260%",
        pin: true,
        scrub: true,
        anticipatePin: 1,
      },
    });
    tl.to({}, { duration: 1 }, 0);

    tl.fromTo(eyebrow, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.08, immediateRender: true }, 0.06);
    words.forEach((w, i) => {
      tl.fromTo(w, { opacity: 0, y: 22, filter: "blur(7px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.09, ease: "power2.out", immediateRender: true },
        0.09 + i * 0.012);
    });
    cards.forEach((c, i) => {
      const rot = Number(c.dataset.rot);
      tl.fromTo(c,
        { opacity: 0, y: 90, rotation: rot, transformOrigin: "50% 50%" },
        { opacity: 1, y: 0, rotation: 0, duration: 0.16, ease: "power2.out", immediateRender: true },
        0.18 + i * 0.12);
    });
    tl.fromTo(foot, { opacity: 0 }, { opacity: 1, duration: 0.1, immediateRender: true }, 0.68);
  },
};
