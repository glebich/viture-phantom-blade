import type Lenis from "lenis";
import type { gsap as Gsap } from "gsap";
import type { ScrollTrigger as ST } from "gsap/ScrollTrigger";

export interface SectionCtx {
  gsap: typeof Gsap;
  ScrollTrigger: typeof ST;
  lenis: Lenis;
}

export interface Section {
  /** e.g. "s07" — becomes the <section> id */
  id: string;
  /** Inner HTML of the <section class="screen"> element. Should contain
   *  a `.stage.stage--d` (1920×1080) and, when the design differs,
   *  a `.stage.stage--m` (375×812). */
  html: string;
  /** Called after the section is in the DOM. Set up ScrollTriggers here. */
  init?: (el: HTMLElement, ctx: SectionCtx) => void;
}
