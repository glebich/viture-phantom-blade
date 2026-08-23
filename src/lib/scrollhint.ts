import "../styles/scrollhint.css";

/* Bottom-left scroll hint — a small mouse glyph whose wheel dot drifts
 * down on a loop (client round 21). Alignment mirrors lib/paginator.ts
 * exactly: the same cover-crop-aware left offset so the icon sits on the
 * dots' column, and the same ≤640px hide (touch visitors don't scroll a
 * mouse). Persistent on every page like the dots — it never unmounts. */
export function mountScrollHint(): void {
  const el = document.createElement("div");
  el.id = "scrollhint";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <svg width="16" height="24.6" viewBox="0 0 26 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.25" y="1.25" width="23.5" height="37.5" rx="11.75"
        stroke="#fff" stroke-width="2.5" />
      <rect class="sh-dot" x="10.75" y="9" width="4.5" height="6" rx="2.25"
        fill="#fff" />
    </svg>`;

  const mq = window.matchMedia("(max-width: 640px)");
  const applyMq = () => (el.style.display = mq.matches ? "none" : "block");
  mq.addEventListener("change", applyMq);
  applyMq();
  document.body.appendChild(el);

  // same crop-aware placement math as the paginator dots (keep in sync)
  const place = () => {
    const s = Math.max(window.innerWidth / 1920, window.innerHeight / 1080);
    const cropLeft = (window.innerWidth - 1920 * s) / 2; // ≤ 0 when cropped
    const cropTop = (window.innerHeight - 1080 * s) / 2;
    el.style.left = `${Math.max(12, cropLeft + 40 * s)}px`;
    el.style.bottom = `${Math.max(16, cropTop + 40 * s)}px`;
  };
  place();
  window.addEventListener("resize", place);
}
