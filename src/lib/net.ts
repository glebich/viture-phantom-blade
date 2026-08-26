/* ---------------------------------------------------------------------------
 * net.ts — one place that decides how heavy this visit is allowed to be.
 *
 * Client: "review the issue with lower speed internet — make sure it's smooth
 * even on low band network." The film ships as webp frame sequences plus a
 * couple of mp4 loops, and the desktop tier is ~3x the bytes of the small
 * one. Choosing that tier on viewport width alone meant a laptop on tethered
 * 3G pulled the full-fat assets and the intro stuttered.
 *
 * So the tier is the LOWER of what the screen needs and what the connection
 * can carry. The Network Information API is Chromium-only, so its absence is
 * treated as "fine" (the viewport rule still applies) — the small tier is
 * never forced on a browser that simply doesn't report.
 * ------------------------------------------------------------------------- */

interface NetInfo {
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
}

function info(): NetInfo {
  return (
    (navigator as Navigator & { connection?: NetInfo }).connection ?? {}
  );
}

/** the visitor asked for less data, or the link is slow enough that the big
 *  tier would stall the film */
export function isFrugal(): boolean {
  const c = info();
  if (c.saveData) return true;
  if (c.effectiveType && /(^|-)(2g|slow-2g|3g)$/.test(c.effectiveType)) return true;
  // downlink is an estimate in Mbit/s; the 1920 tier wants ~3 Mbit/s to keep
  // ahead of a scrub, so anything under that gets the small one
  if (typeof c.downlink === "number" && c.downlink > 0 && c.downlink < 3) return true;
  return false;
}

/** phones get the client's VERTICAL film (1080x1920 renders framed for
 *  portrait) instead of a hard centre-crop of the 16:9 one */
export function isPhone(): boolean {
  return window.matchMedia("(max-width: 640px)").matches;
}

/** 1920 or 960 — the frame tier this visit should download */
export function frameTier(): 1920 | 960 {
  if (isFrugal()) return 960;
  const small = window.matchMedia("(max-width: 1024px)").matches;
  // high-DPR phones upscale the 960 tier visibly, so they keep the big one
  return small && (window.devicePixelRatio || 1) < 2.5 ? 960 : 1920;
}

/** the portrait sequences' own tiers */
export function phoneFrameTier(): 1080 | 540 {
  return isFrugal() ? 540 : 1080;
}

/** filename suffix for the video loops: "" (HD) or "-sd" */
export function videoTier(): "" | "-sd" {
  return isFrugal() ? "-sd" : "";
}
