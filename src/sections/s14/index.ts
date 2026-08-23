import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import { splitWords } from "../../lib/textfx";

/* Shared builder for the two living-room chapters (s14 duel-world dimming,
 * s15 exclusive OSD). Short pin; copy + insert reveal scrub both ways. */

function livingRoom(opts: {
  id: string;
  title: string;
  note: string;
  patches: string[]; // inline styles for the baked-text veils
}): Section {
  return {
    id: opts.id,
    html: `
      <div class="lr-plate"></div>
      <div class="stage stage--d">
        ${opts.patches.map((p) => `<div class="lr-patch" style="${p}"></div>`).join("")}
        <h2 class="lr-title">${opts.title}</h2>
        <p class="lr-note t-caps">${opts.note}</p>
        <div class="lr-insert"></div>
      </div>
    `,
    init(el, ctx: SectionCtx) {
      const { gsap } = ctx;
      const title = el.querySelector<HTMLElement>(".lr-title")!;
      const note = el.querySelector<HTMLElement>(".lr-note")!;
      const insert = el.querySelector<HTMLElement>(".lr-insert")!;
      const words = splitWords(title);
      gsap.set(words, { opacity: 0 });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "+=160%",
          pin: true,
          scrub: true,
          anticipatePin: 1,
        },
      });
      tl.to({}, { duration: 1 }, 0); // normalize length
      words.forEach((w, i) => {
        tl.fromTo(w, { opacity: 0, y: 24, filter: "blur(7px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.1, ease: "power2.out", immediateRender: true },
          0.12 + i * 0.012);
      });
      tl.fromTo(note, { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.12, ease: "sine.out", immediateRender: true }, 0.2);
      tl.fromTo(insert, { opacity: 0, scale: 0.955, transformOrigin: "50% 60%" },
        { opacity: 1, scale: 1, duration: 0.2, ease: "sine.out", immediateRender: true }, 0.16);
    },
  };
}

export const s14 = livingRoom({
  id: "s14",
  title: "Duel world. Real world.<br/>Seamless switch.",
  note: "Auto-dimming electrochromic lenses dynamically adjust light transmission in real time.",
  patches: [
    "left:150px;top:120px;width:700px;height:180px",
    "left:1290px;top:130px;width:480px;height:160px",
  ],
});

export const s15 = livingRoom({
  id: "s15",
  title: "Exclusive OSD<br/>menu",
  note: "A custom UI inspired by the world of Phantom Blade Zero, built for immersion.",
  patches: [
    "left:150px;top:120px;width:620px;height:180px",
    "left:1290px;top:130px;width:480px;height:160px",
  ],
});
