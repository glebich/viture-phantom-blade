import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { scrubAssetArrival } from "../../lib/assetfx";
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
const CARDS = ["card1", "card2", "card3", "card4"];

export const s16: Section = {
  id: "s16",
  html: `
    <div class="stage">
      <p class="s16-eyebrow">What Else Within The Box</p>
      <h2 class="s16-title">More treasures await within</h2>
      <p class="s16-foot">Starting in October, a new reveal every week.</p>
      ${CARDS.map(
        (c, i) => `<img class="s16-card s16-c${i}" src="/assets/ui/${c}.png" alt="" />`
      ).join("")}
    </div>
  `,
  init(el, ctx: SectionCtx) {
    const { gsap } = ctx;
    mountWashRail(el);
    const title = el.querySelector<HTMLElement>(".s16-title")!;
    const eyebrow = el.querySelector<HTMLElement>(".s16-eyebrow")!;
    const foot = el.querySelector<HTMLElement>(".s16-foot")!;
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
    tl.fromTo(eyebrow, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "sine.out", immediateRender: true }, 0.05);
    scrubFlare(tl, [title], 0.08, 0, { cool: 0.11 });
    tl.fromTo(title, { opacity: 0 }, { opacity: 1, duration: 0.14, ease: "sine.out", immediateRender: true }, 0.08);
    // the relic cards drift up and resolve out of blur, one after another —
    // slow enough to read as a reveal rather than a switch (client)
    cards.forEach((c, i) => {
      scrubAssetArrival(tl, c, 0.16 + i * 0.11, { duration: 0.34, drift: 30, blur: 14 });
    });
    tl.fromTo(foot, { opacity: 0 }, { opacity: 1, duration: 0.12, immediateRender: true }, 0.72);
  },
};
