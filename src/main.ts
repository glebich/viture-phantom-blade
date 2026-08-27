import "./styles/base.css";
import "./styles/textfx.css";
import "./styles/scrollfx.css";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Section, SectionCtx } from "./lib/section";
import { sections } from "./sections";
import { header } from "./sections/header";
import { mountPaginator } from "./lib/paginator";
import { restY, stopYs, filmFramesBetween } from "./lib/rests";
import { mountScrollHint } from "./lib/scrollhint";
import { mountIdleCue } from "./lib/idlecue";
import { mountThread } from "./lib/thread";
import { mountChapterNav } from "./lib/chapternav";

gsap.registerPlugin(ScrollTrigger);

const isWebKit =
  /AppleWebKit/i.test(navigator.userAgent) &&
  !/Chrome|CriOS|Chromium|Edg\//i.test(navigator.userAgent);
if (isWebKit) document.documentElement.classList.add("safari");

history.scrollRestoration = "manual";
window.scrollTo(0, 0);

// Heavy-but-controlled smoothing (matches the shipped minidock feel).
//
// These numbers set how fast the FILM plays, not just how fast the page
// moves: the chapters scrub their clips off scroll position, and at the
// intro's geometry one kept frame is 42.9px of scroll, so ~648px/s of scroll
// is real-time playback. Round 9 raised the multiplier to 1.75 to cut the
// number of swipes per chapter, and that multiplied the scrub rate with it —
// the film visibly raced and surged (client: "playing too fast… before was
// smooth 30fps, without this acceleration"). Back to the values that read as
// natural playback. If chapters ever feel too long again, lengthen or
// shorten the PINS (lengthVh), which changes px-per-frame — never this gain,
// which changes the speed of the film itself.
const lenis = new Lenis({
  lerp: 0.095,
  wheelMultiplier: 0.95,
  smoothWheel: true,
});

const resetToTop = () => {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  lenis.scrollTo(0, { immediate: true, force: true });
};
requestAnimationFrame(() => requestAnimationFrame(resetToTop));
window.addEventListener("load", resetToTop, { once: true });
window.addEventListener("pageshow", resetToTop);

lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

const ctx: SectionCtx = { gsap, ScrollTrigger, lenis };

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__pb = {
    lenis,
    gsap,
    ScrollTrigger,
    stopYs,
    filmFrames: filmFramesBetween,
  };
}

// ScrollTrigger refreshes triggers in CREATION order; re-sort by live
// document position on every refresh (pinned timelines built late).
ScrollTrigger.addEventListener("refreshInit", () => void ScrollTrigger.sort());

// Keep the unitless .stage cover-scale factor synced (100vh probe — see
// minidock round 21b: innerHeight is the SMALL viewport on iOS at load).
const vhProbe = document.createElement("div");
vhProbe.style.cssText =
  "position:fixed;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none;";
document.documentElement.appendChild(vhProbe);
function syncStageScale() {
  const cs = getComputedStyle(document.documentElement);
  const w = parseFloat(cs.getPropertyValue("--stage-w")) || 1920;
  const h = parseFloat(cs.getPropertyValue("--stage-h")) || 1080;
  const vh = vhProbe.offsetHeight || window.innerHeight;
  // CONTAIN, not cover. The stage carries the copy, prices and CTAs; the
  // film/room/wash backdrops are separate fixed rails that cover on their
  // own. Cover-scaling the stage meant any window that wasn't 16:9 pushed
  // the design wider (or taller) than the viewport and sliced the content
  // off the edges — the hero title and the price were both losing characters
  // on a tall desktop window (client). Containing keeps every element on
  // screen at any size, and the design's own margins scale with it, so the
  // spacing off the edges stays proportional.
  const s = Math.min(window.innerWidth / w, vh / h);
  document.documentElement.style.setProperty("--s", String(s));
}
syncStageScale();
window.addEventListener("resize", () => {
  syncStageScale();
  ScrollTrigger.refresh();
});

const headerEl = document.getElementById("site-header")!;
headerEl.innerHTML = header.html;
header.init?.(headerEl, ctx);

// QA harness (dev): ?only=s06[&progress=0.5] mounts a single section.
const qaParams = new URLSearchParams(location.search);
const qaOnly = import.meta.env.DEV ? qaParams.get("only") : null;
const qaSections = qaOnly
  ? (sections as Section[]).filter((s) => s.id === qaOnly)
  : (sections as Section[]);

const mainEl = document.getElementById("sections")!;
const EAGER = new Set(["s01", "s02"]);
const lazyImgs = (html: string) =>
  html
    .replace(/<img(?![^>]*\bloading=)/g, '<img loading="lazy" decoding="async"')
    .replace(/(<video\b[^>]*?)\sautoplay/g, "$1");
for (const s of qaSections) {
  const el = document.createElement("section");
  el.className = "screen";
  el.id = s.id;
  el.innerHTML = EAGER.has(s.id) ? s.html : lazyImgs(s.html);
  mainEl.appendChild(el);
}
for (const s of qaSections) {
  const el = document.getElementById(s.id)!;
  s.init?.(el, ctx);
}

if (qaOnly) {
  const p = parseFloat(qaParams.get("progress") ?? "");
  if (!Number.isNaN(p)) {
    requestAnimationFrame(() => {
      ScrollTrigger.getAll().forEach((st) => {
        if (!st.vars.scrub) return;
        st.disable(false);
        const anim = st.animation;
        if (anim) anim.progress(p).pause();
      });
    });
  }
  lenis.stop();
}

// ---------------------------------------------------------------------------
// Chapter paginator — the dots+Ø rail. Entries are section ids; the intro
// pin exposes interior beats through data-chapter markers.
// ---------------------------------------------------------------------------
if (!qaOnly) {
  const pageIds = qaSections.map((s) => s.id);
  const paginator = mountPaginator(pageIds, (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    // land on where the chapter READS — copy in, film settled — not on the
    // transition at the top of its pin (client). See lib/rests.ts.
    const box = el.parentElement?.classList.contains("pin-spacer")
      ? (el.parentElement as HTMLElement)
      : el;
    const y = restY(id) ?? box.getBoundingClientRect().top + window.scrollY;
    lenis.scrollTo(y, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 3) });
  });

  let centers: { id: string; top: number; bottom: number }[] = [];
  const measure = () => {
    centers = pageIds.map((id) => {
      const el = document.getElementById(id)!;
      const box = el.parentElement?.classList.contains("pin-spacer")
        ? (el.parentElement as HTMLElement)
        : el;
      const r = box.getBoundingClientRect();
      return { id, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
    });
  };
  ScrollTrigger.addEventListener("refresh", measure);
  const trackPage = () => {
    if (!centers.length) return;
    const mid = window.scrollY + window.innerHeight / 2;
    let idx = 0;
    for (let i = 0; i < centers.length; i++) {
      if (mid >= centers[i].top) idx = i;
    }
    paginator.setPage(idx);
  };
  lenis.on("scroll", trackPage);
  ScrollTrigger.addEventListener("refresh", trackPage);

  mountScrollHint();
  mountIdleCue(lenis);
  // the pages are the only scroll stops (see lib/chapternav.ts)
  mountChapterNav(lenis, gsap);
  // the one continuous cord — it fades up once the loader (which draws its
  // own thread as the progress bar) has handed the screen over
  mountThread(ctx);
  const threadOn = () => {
    if (document.documentElement.classList.contains("loading")) {
      setTimeout(threadOn, 200);
      return;
    }
    document.documentElement.classList.add("thread-on");
  };
  threadOn();
}


// ---------------------------------------------------------------------------
// ?probe — on-device geometry readout. The bottom-line reports come from one
// real phone that has served stale builds for days before; this puts the
// numbers on the screen so a photograph of the failing state carries the
// diagnosis with it: which build, which viewport, where each ground's box
// actually ends.
// ---------------------------------------------------------------------------
if (location.search.includes("probe")) {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:8px;top:80px;z-index:9999;background:rgba(0,0,0,.82);color:#7dff9a;" +
    "font:11px/1.5 monospace;padding:8px 10px;pointer-events:none;white-space:pre;border:1px solid #333";
  document.body.appendChild(box);
  const lvhProbe = document.createElement("div");
  lvhProbe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none;";
  document.body.appendChild(lvhProbe);
  const upd = () => {
    const vv = window.visualViewport;
    const rail = document.getElementById("cine-rail")?.getBoundingClientRect();
    const wash = document.getElementById("wash-rail")?.getBoundingClientRect();
    const loader = document.querySelector(".s02-loader")?.getBoundingClientRect();
    const f = (r?: DOMRect | null) => (r ? `${Math.round(r.top)}..${Math.round(r.bottom)}` : "-");
    box.textContent =
      `build 3a604ba+\n` +
      `innerH ${innerHeight}  lvh ${lvhProbe.offsetHeight}\n` +
      `vv.h ${vv ? Math.round(vv.height) : "-"}  vv.top ${vv ? Math.round(vv.offsetTop) : "-"}\n` +
      `cine ${f(rail)}\nwash ${f(wash)}\nloader ${f(loader)}\n` +
      `y ${Math.round(scrollY)}  dpr ${devicePixelRatio}`;
  };
  setInterval(upd, 300);
  upd();
}

requestAnimationFrame(() => ScrollTrigger.refresh());
