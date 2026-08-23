/** Fixed left-edge chapter rail — the Phantom Blade Ø paginator.
 *
 *  Design (Figma, every desktop frame): a vertical column of small warm-white
 *  dots whose size tapers with distance from the current chapter; the current
 *  chapter itself renders as the brush-stroked Ø glyph. Clicking any dot
 *  navigates to its chapter (caller supplies the scroll).
 *
 *  Motion: the Ø hands off between slots with a condense-in (scale + slight
 *  rotation + blur, like ink hitting paper); dots breathe to their new taper
 *  sizes on a soft transition. Hidden ≤640px (dock owns mobile navigation). */
import "../styles/paginator.css";

export interface Paginator {
  setPage(index: number): void;
  setIds(ids: string[]): void;
}

const SLOT = 19; // px between dot centres (design rhythm)
const O_EXTRA = 13; // the Ø cell breathes: +13px above and below

export function mountPaginator(
  sectionIds: string[],
  navigate: (sectionId: string) => void
): Paginator {
  let ids = sectionIds.slice();
  const el = document.createElement("div");
  el.id = "paginator";
  const mq = window.matchMedia("(max-width: 640px)");
  const applyMq = () => (el.style.display = mq.matches ? "none" : "block");
  mq.addEventListener("change", applyMq);
  applyMq();
  document.body.appendChild(el);

  // hug the design's 40px offset, crop-aware (same math as scrollhint)
  function place() {
    const s = Math.max(window.innerWidth / 1920, window.innerHeight / 1080);
    const cropLeft = (window.innerWidth - 1920 * s) / 2; // ≤ 0 when cropped
    el.style.left = `${Math.max(14, cropLeft + 40 * s)}px`;
  }
  place();
  window.addEventListener("resize", place);

  el.addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>(".pg-slot")
      ?.dataset.id;
    if (id) navigate(id);
  });

  let current = -1;
  let slots: HTMLButtonElement[] = [];

  // Carousel window: at most WIN slots; dots taper by distance from the
  // current index, edges dissipate when more chapters continue past them.
  const WIN = 9;

  function buildSlots(count: number) {
    el.innerHTML = "";
    slots = [];
    for (let p = 0; p < count; p++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pg-slot";
      b.innerHTML = `<span class="pg-dot"></span>`;
      el.appendChild(b);
      slots.push(b);
    }
  }

  const GLYPH = `<img class="pg-oglyph" src="/assets/ui/pg-o.svg" alt="" aria-hidden="true" />`;

  function render(index: number) {
    if (index === current) return;
    current = index;
    const w = Math.min(ids.length, WIN);
    if (slots.length !== w) buildSlots(w);
    const start = Math.max(0, Math.min(index - (w >> 1), ids.length - w));
    // dynamic rhythm: uniform 19px dots, the Ø cell gets extra air
    let y = 0;
    slots.forEach((btn, p) => {
      const isCur = start + p === index;
      if (isCur) y += O_EXTRA;
      btn.style.top = `${y}px`;
      y += SLOT + (isCur ? O_EXTRA : 0);
    });
    el.style.height = `${y}px`;
    const moreTop = start > 0;
    const moreBtm = start + w < ids.length;
    slots.forEach((btn, p) => {
      const i = start + p;
      btn.dataset.id = ids[i];
      const isCur = i === index;
      btn.setAttribute(
        "aria-label",
        isCur ? "Current chapter" : `Go to chapter ${i + 1}`
      );
      if (isCur) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
      // distance taper: nearer dots are larger, like the design column
      const dist = Math.min(3, Math.abs(i - index));
      let lvl = dist; // 0(cur) 1 2 3
      if (moreTop && p === 0) lvl = 3;
      if (moreBtm && p === w - 1) lvl = 3;
      if (isCur) {
        if (!btn.querySelector(".pg-oglyph")) {
          btn.innerHTML = GLYPH;
          // restart the condense-in animation
          const g = btn.firstElementChild as HTMLElement;
          g.classList.remove("pg-oglyph--in");
          void g.getBoundingClientRect();
          g.classList.add("pg-oglyph--in");
        }
      } else {
        const hasDot = btn.querySelector(".pg-dot");
        if (!hasDot) btn.innerHTML = `<span class="pg-dot"></span>`;
        (btn.firstElementChild as HTMLElement).className = `pg-dot d${lvl}`;
      }
    });
  }

  render(0);
  return {
    setPage: render,
    setIds(next: string[]) {
      ids = next.slice();
      const keep = Math.min(Math.max(current, 0), ids.length - 1);
      current = -1;
      render(keep);
    },
  };
}
