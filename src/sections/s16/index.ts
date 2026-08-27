import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { scrubMaskReveal } from "../../lib/assetfx";
import { scrubFlare } from "../../lib/textfx";
import { setRest } from "../../lib/rests";

/* ONE fixed wash behind s16 AND s17 (client: the bg must stay the same
 * across both pages) — sections stay transparent; a red glow layer behind
 * the map scroll fades in/out with s17's scrub. */
let washMounted = false;
const washHosts: HTMLElement[] = [];
export function mountWashRail(host: HTMLElement): void {
  washHosts.push(host);
  if (washMounted) return;
  washMounted = true;
  const wash = document.createElement("div");
  wash.id = "wash-rail";
  const glow = document.createElement("div");
  glow.id = "wash-glow";
  const mainEl = document.getElementById("sections")!;
  document.body.insertBefore(wash, mainEl);
  document.body.insertBefore(glow, mainEl);
  const tick = () => {
    let on = false;
    for (const h of washHosts) {
      const r = h.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) { on = true; break; }
    }
    wash.style.opacity = on ? "1" : "0";
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* Official card PNGs from the client — tilt, border, label and glow baked. */
const CARDS = ["facein1", "facein2", "facein3", "facein4"];

export const s16: Section = {
  id: "s16",
  html: `
    <img class="s16-ground" src="/assets/ui/bg16-1920.webp" srcset="/assets/ui/bg16-768.webp 768w, /assets/ui/bg16-1280.webp 1280w, /assets/ui/bg16-1920.webp 1920w, /assets/ui/bg16-2880.webp 2880w" sizes="100vw" alt="" aria-hidden="true" />
    <div class="stage">
      <p class="s16-eyebrow">What Else Within The Box</p>
      <h2 class="s16-title">More treasures await within</h2>
      ${CARDS.map(
        (c, i) => `<div class="s16-card s16-c${i}"><img src="/assets/ui/${c}.webp" alt="" /></div>`
      ).join("")}
    </div>
  `,
  init(el, ctx: SectionCtx) {
    const { gsap } = ctx;
    mountWashRail(el);
    const title = el.querySelector<HTMLElement>(".s16-title")!;
    const eyebrow = el.querySelector<HTMLElement>(".s16-eyebrow")!;
    const cards = Array.from(el.querySelectorAll<HTMLElement>(".s16-card"));

    // simple, light: blocks rise and fade in, scrub-linked both ways
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: el,
        start: "top top",
        end: "+=130%",
        pin: true,
        scrub: true,
        anticipatePin: 1,
      },
    });
    setRest("s16", tl, 0.8);
    tl.to({}, { duration: 1 }, 0);

    // The heading arrives on the APPROACH, not once the pin has landed. A
    // pinned section only starts its timeline after it has fully scrolled into
    // place, so the hand-off out of the OSD chapter — a whole viewport of
    // scroll — had the outgoing copy already faded and nothing incoming yet:
    // an empty screen you had to scroll through (client). Riding the entry
    // instead means the eyebrow and title are already condensing in as the
    // section rises.
    const intro = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: el, start: "top 92%", end: "top 12%", scrub: true },
    });
    intro.to({}, { duration: 1 }, 0);
    intro.fromTo(eyebrow, { opacity: 0 },
      { opacity: 1, duration: 0.34, ease: "sine.out", immediateRender: true }, 0.1);
    scrubFlare(intro, [title], 0.24, 0, { hold: 0.3, cool: 0.34 });
    intro.fromTo(title, { opacity: 0 },
      { opacity: 1, duration: 0.36, ease: "sine.out", immediateRender: true }, 0.24);
    // each relic card is unveiled — the mask sweeps up its tilted face while
    // the card eases back into place, one after another (fantasy.co grammar)
    cards.forEach((c, i) => {
      scrubMaskReveal(tl, c, 0.16 + i * 0.11, { duration: 0.36, dir: "rise", scaleFrom: 1.05, drift: 30 });
    });
  },
};
