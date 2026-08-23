import "./style.css";
import type { Section, SectionCtx } from "../../lib/section";
import lottie from "lottie-web";

/* Fixed header — VITURE mark (lottie plays logo_in on hover, logo_out on
 * leave), nav links, glasses-glyph price readout and THE paper CTA. The
 * commerce cluster stays hidden during the intro cinematic and fades in
 * when the hero rest is reached (s02's pin end). Mobile gets the dock. */

const PREORDER_URL = "https://www.viture.com/";

export const header: Section = {
  id: "header",
  html: `
    <div class="hd">
      <a class="hd-logo" href="#" aria-label="VITURE home">
        <img src="/assets/ui/vmark-rest.png" alt="VITURE" />
        <span class="hd-lottie" aria-hidden="true"></span>
      </a>
      <nav class="hd-menu" aria-label="Primary">
        <a class="hd-l1" href="#" data-nav>Products</a>
        <a class="hd-l2" href="#" data-nav>Store</a>
        <a class="hd-l3" href="#" data-nav>Discover</a>
        <a class="hd-l4" href="#" data-nav>Support</a>
      </nav>
      <div class="hd-buy" data-buy style="opacity:0">
        <span class="hd-price">
          <img src="/assets/ui/glasses.png" alt="" aria-hidden="true" />
          <span class="hd-from">FROM</span>&nbsp;<b>$599</b>
        </span>
        <a class="cta-paper" href="${PREORDER_URL}" target="_blank" rel="noopener" aria-label="Pre-Order Now"></a>
      </div>
      <button class="hd-burger" aria-label="Menu"><span></span></button>
      <div class="hd-sheet" aria-hidden="true">
        <a href="#" data-nav><i>01</i>Products</a>
        <a href="#" data-nav><i>02</i>Store</a>
        <a href="#" data-nav><i>03</i>Discover</a>
        <a href="#" data-nav><i>04</i>Support</a>
        <div class="hd-sheet-cta">
          <a class="cta-paper" href="${PREORDER_URL}" target="_blank" rel="noopener" aria-label="Pre-Order Now"></a>
        </div>
      </div>
    </div>
    <div id="dock-slot"></div>
  `,
  init(el: HTMLElement, ctx: SectionCtx) {
    // mobile dock lives on <body> so it never inherits header transforms
    const dock = document.createElement("div");
    dock.id = "dock";
    dock.innerHTML = `
      <div class="dk-info">
        <span class="dk-cap">Limited Edition</span>
        <span class="dk-price">From $599</span>
      </div>
      <a class="cta-paper" href="${PREORDER_URL}" target="_blank" rel="noopener" aria-label="Pre-Order Now"></a>`;
    document.body.appendChild(dock);

    // burger / sheet
    const burger = el.querySelector<HTMLButtonElement>(".hd-burger")!;
    const sheet = el.querySelector<HTMLElement>(".hd-sheet")!;
    burger.addEventListener("click", () => {
      const open = el.classList.toggle("menu-open");
      sheet.setAttribute("aria-hidden", open ? "false" : "true");
      if (open) ctx.lenis.stop();
      else ctx.lenis.start();
    });
    sheet.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        el.classList.remove("menu-open");
        ctx.lenis.start();
      })
    );

    // logo hover lottie (in/out image-sequence pair)
    const holder = el.querySelector<HTMLElement>(".hd-lottie")!;
    const still = el.querySelector<HTMLImageElement>(".hd-logo img")!;
    let anim: ReturnType<typeof lottie.loadAnimation> | null = null;
    let mode: "in" | "out" | null = null;
    const play = (which: "in" | "out") => {
      if (mode === which) return;
      mode = which;
      anim?.destroy();
      anim = lottie.loadAnimation({
        container: holder,
        renderer: "canvas",
        loop: false,
        autoplay: true,
        path: `/lottie/logo_${which}.json`,
      });
      still.style.opacity = "0";
      anim.addEventListener("complete", () => {
        if (which === "out") {
          still.style.opacity = "1";
          anim?.destroy();
          anim = null;
          mode = null;
          holder.innerHTML = "";
        }
      });
    };
    const logo = el.querySelector<HTMLElement>(".hd-logo")!;
    if (matchMedia("(hover: hover)").matches) {
      logo.addEventListener("mouseenter", () => play("in"));
      logo.addEventListener("mouseleave", () => play("out"));
    }

    // commerce cluster appears once the hero rest is reached
    const buy = el.querySelector<HTMLElement>("[data-buy]")!;
    let shown = false;
    const sync = () => {
      const s06 = document.getElementById("s06");
      if (!s06) {
        // QA harness without s06: just show it
        buy.style.opacity = "1";
        return;
      }
      const box = s06.parentElement?.classList.contains("pin-spacer")
        ? (s06.parentElement as HTMLElement)
        : s06;
      const near = box.getBoundingClientRect().top < window.innerHeight * 1.5;
      if (near !== shown) {
        shown = near;
        ctx.gsap.to(buy, { opacity: near ? 1 : 0, duration: 0.6, ease: "sine.out" });
      }
    };
    ctx.lenis.on("scroll", sync);
    ctx.ScrollTrigger.addEventListener("refresh", sync);
    requestAnimationFrame(sync);

    // dock mirrors the same gating on mobile
    const dockSync = () => {
      const on = shown && matchMedia("(max-width: 640px)").matches;
      dock.style.transform = on ? "translateY(0)" : "translateY(110%)";
      dock.style.transition = "transform 0.5s ease";
    };
    ctx.lenis.on("scroll", dockSync);
    ctx.ScrollTrigger.addEventListener("refresh", dockSync);
    requestAnimationFrame(dockSync);
  },
};
