import { formatEventHeadline } from "./helpers";

/** Gatherings run 2–4 PM. The extra hour keeps the page from calling it over while people are still leaving. */
export const GATHERING_HOURS = 3;

export type Phase = "before" | "live" | "after";

/** Where a gathering is in time: not started, happening now, or over. */
export function gatheringPhase(heldAtIso: string, now = Date.now()): Phase | null {
  const start = new Date(heldAtIso).getTime();
  if (Number.isNaN(start)) return null;
  if (now < start) return "before";
  return now < start + GATHERING_HOURS * 3600 * 1000 ? "live" : "after";
}

const DAY_PARTS = new Intl.DateTimeFormat("en-SG", {
  timeZone: "Asia/Singapore",
  weekday: "long",
  day: "numeric",
  month: "short",
});

/** "Sunday 27 Sep", always three letters for the month. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const part = (type: Intl.DateTimeFormatPartTypes) => DAY_PARTS.formatToParts(d).find((p) => p.type === type)?.value || "";
  return `${part("weekday")} ${part("day")} ${part("month").replace(/\./g, "").replace("Sept", "Sep")}`;
}

/** "2–4 PM", taken from the same headline the hero already uses so the two never disagree. */
export function timeWindow(iso: string): string {
  return formatEventHeadline(iso).split(" · ").at(-1) || "";
}

export function directionsUrl(venue: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
}
