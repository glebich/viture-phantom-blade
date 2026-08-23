import "../styles/idlecue.css";
import type Lenis from "lenis";

/* Bottom-centre idle prompt (client): if the visitor has landed and hasn't
 * scrolled for 5s, invite them to. It condenses in with the site's ambient
 * language (fade + drift + blur clearing), breathes, and dissolves for good
 * on the first scroll — it never nags a second time. */
const IDLE_MS = 5000;

export function mountIdleCue(lenis: Lenis): void {
  const el = document.createElement("div");
  el.id = "idlecue";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<span class="ic-label">Start Scrolling</span><span class="ic-line"></span>`;
  document.body.appendChild(el);

  let timer = 0;
  let retired = false;

  const hide = () => {
    if (!el.classList.contains("on")) return;
    el.classList.remove("on");
  };
  const show = () => {
    if (retired) return;
    el.classList.add("on");
  };
  const arm = () => {
    if (retired) return;
    clearTimeout(timer);
    timer = window.setTimeout(show, IDLE_MS);
  };

  // any scroll retires the cue permanently
  lenis.on("scroll", ({ scroll }: { scroll: number }) => {
    if (scroll <= 1) return;
    retired = true;
    clearTimeout(timer);
    hide();
  });

  // the loader owns the screen first — only start counting once it's gone
  const start = () => {
    if (document.documentElement.classList.contains("loading")) {
      setTimeout(start, 250);
      return;
    }
    arm();
  };
  start();
}
