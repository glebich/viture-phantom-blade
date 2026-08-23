import "../styles/idlecue.css";
import type Lenis from "lenis";

/* Bottom-centre idle prompt (client): if the visitor goes 5s without moving —
 * no scroll, no mouse — invite them onward. It arms on EVERY page, not just
 * the landing (client: "needs to appear at any page where you hold for more
 * than 5 sec without moving"). It condenses in with the site's ambient
 * language (fade + drift + blur clearing), breathes, and dissolves the
 * instant the visitor does anything.
 *
 * It stays quiet in two places: while the loader still owns the screen, and
 * at the very bottom of the page, where there is nothing left to scroll to
 * and the prompt would be a lie. */
const IDLE_MS = 5000;
const END_SLACK = 120; // px from the bottom that still counts as "the end"

export function mountIdleCue(lenis: Lenis): void {
  const el = document.createElement("div");
  el.id = "idlecue";
  el.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "ic-label";
  label.textContent = "Start Scrolling";
  const line = document.createElement("span");
  line.className = "ic-line";
  el.append(label, line);
  document.body.appendChild(el);

  let timer = 0;
  let moved = false; // once they've scrolled, it's "keep", not "start"

  const atEnd = () =>
    window.scrollY + window.innerHeight >= document.body.scrollHeight - END_SLACK;

  const show = () => {
    if (document.documentElement.classList.contains("loading")) return;
    if (atEnd()) return;
    label.textContent = moved ? "Keep Scrolling" : "Start Scrolling";
    el.classList.add("on");
  };

  const wake = () => {
    el.classList.remove("on");
    clearTimeout(timer);
    timer = window.setTimeout(show, IDLE_MS);
  };

  lenis.on("scroll", ({ scroll }: { scroll: number }) => {
    if (scroll > 1) moved = true;
    wake();
  });
  for (const ev of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(ev, wake, { passive: true });
  }

  wake();
}
