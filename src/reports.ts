import { escapeHtml } from "./helpers";

/** One gathering with its registration counts, as read from the database. */
export type GatheringRow = {
  id: string;
  title: string;
  held_at: string;
  tracked: boolean;
  registered: number;
  attended: number;
  online: number;
  walkin: number;
  imported: number;
};

export type AppearanceRow = { person_id: string; event_id: string; attended: number };

export type Gathering = GatheringRow & {
  /** Calendar day in Singapore, YYYY-MM-DD. */
  day: string;
  /** Attendance was taken and at least one guest is marked. */
  marked: boolean;
  /** Attendance is either known, or was never tracked for this gathering. */
  settled: boolean;
  guests: number;
  returning: number;
  firstTime: number;
  /** The first gathering on record: everyone looks new only because nothing came before it. */
  baseline: boolean;
};

export type RangeKey = "6m" | "12m" | "ytd" | "lastyear" | "all" | "custom";
export type Grain = "gathering" | "month" | "year";

export type Range = { key: RangeKey; from: string; to: string; label: string };

export type Bucket = {
  key: string;
  label: string;
  title: string;
  gatherings: number;
  guests: number;
  returning: number;
  firstTime: number;
  average: number;
  baseline: boolean;
  /** Guests from the first gathering on record, which look new only because nothing came before. */
  baselineGuests: number;
  untracked: boolean;
};

const MONTH_FORMAT = new Intl.DateTimeFormat("en-SG", { month: "short", timeZone: "UTC" });
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" });

export function sgDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : DAY_FORMAT.format(d);
}

/** "Sep" everywhere, not the "Sept" that en-SG writes. */
function monthName(month: number): string {
  return MONTH_FORMAT.format(new Date(Date.UTC(2000, month - 1, 1))).replace("Sept", "Sep");
}

export function monthLabel(ym: string, withYear = true): string {
  const [y, m] = ym.split("-").map(Number);
  return withYear ? `${monthName(m)} ${y}` : monthName(m);
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Work out first-time and returning guests for every gathering, oldest first. */
export function analyze(rows: GatheringRow[], appearances: AppearanceRow[]): Gathering[] {
  const sorted = [...rows].sort((a, b) => Date.parse(a.held_at) - Date.parse(b.held_at));
  const position = new Map(sorted.map((g, i) => [g.id, i]));
  const tracked = new Map(sorted.map((g) => [g.id, g.tracked]));

  // A guest counts as having been there when attendance was not tracked, or when they were marked attended.
  const present = new Map<string, number[]>();
  const listed = new Map<string, Set<string>>();
  for (const a of appearances) {
    const at = position.get(a.event_id);
    if (at === undefined) continue;
    if (!listed.has(a.event_id)) listed.set(a.event_id, new Set());
    listed.get(a.event_id)!.add(a.person_id);
    if (!tracked.get(a.event_id) || a.attended === 1) {
      if (!present.has(a.person_id)) present.set(a.person_id, []);
      present.get(a.person_id)!.push(at);
    }
  }

  return sorted.map((g, i) => {
    const people = listed.get(g.id) || new Set<string>();
    let returning = 0;
    for (const person of people) {
      if ((present.get(person) || []).some((at) => at < i)) returning += 1;
    }
    const guests = g.registered;
    const marked = g.tracked && g.attended > 0;
    return {
      ...g,
      day: sgDay(g.held_at),
      marked,
      settled: !g.tracked || marked,
      guests,
      returning: Math.min(returning, guests),
      firstTime: Math.max(0, guests - returning),
      baseline: i === 0,
    };
  });
}

const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function resolveRange(
  params: { range?: string | null; from?: string | null; to?: string | null },
  all: Gathering[],
  today: string,
): Range {
  const thisMonth = today.slice(0, 7);
  const year = thisMonth.slice(0, 4);
  const earliest = all.length ? all[0].day.slice(0, 7) : thisMonth;

  if (params.from && params.to && ISO_MONTH.test(params.from) && ISO_MONTH.test(params.to)) {
    const [from, to] = params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
    return { key: "custom", from, to, label: `${monthLabel(from)} – ${monthLabel(to)}` };
  }
  switch (params.range) {
    case "6m":
      return { key: "6m", from: addMonths(thisMonth, -5), to: thisMonth, label: "Last 6 months" };
    case "ytd":
      return { key: "ytd", from: `${year}-01`, to: thisMonth, label: `${year} so far` };
    case "lastyear":
      return { key: "lastyear", from: `${Number(year) - 1}-01`, to: `${Number(year) - 1}-12`, label: `${Number(year) - 1}` };
    case "all":
      return { key: "all", from: earliest, to: thisMonth, label: "All time" };
    default:
      return { key: "12m", from: addMonths(thisMonth, -11), to: thisMonth, label: "Last 12 months" };
  }
}

/** Gatherings inside the range that have already happened (today counts). */
export function inRange(all: Gathering[], range: Range, today: string): Gathering[] {
  return all.filter((g) => g.day <= today && g.day.slice(0, 7) >= range.from && g.day.slice(0, 7) <= range.to);
}

export function bucketize(list: Gathering[], grain: Grain): Bucket[] {
  const years = new Set(list.map((g) => g.day.slice(0, 4)));
  const multiYear = years.size > 1;
  const monthCount = new Map<string, number>();
  for (const g of list) monthCount.set(g.day.slice(0, 7), (monthCount.get(g.day.slice(0, 7)) || 0) + 1);

  const groups = new Map<string, Gathering[]>();
  for (const g of list) {
    const key = grain === "gathering" ? g.id : grain === "month" ? g.day.slice(0, 7) : g.day.slice(0, 4);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(g);
  }

  return [...groups.entries()].map(([key, items]) => {
    const first = items[0];
    const ym = first.day.slice(0, 7);
    let label: string;
    let title: string;
    if (grain === "year") {
      label = title = key;
    } else if (grain === "month") {
      label = monthLabel(ym, multiYear);
      title = monthLabel(ym);
    } else {
      // Two gatherings in one month need the day to be told apart.
      const shared = (monthCount.get(ym) || 0) > 1;
      const dayOfMonth = Number(first.day.slice(8, 10));
      label = shared ? `${dayOfMonth} ${monthName(Number(ym.slice(5, 7)))}` : monthLabel(ym, false);
      if (multiYear) label += ` ${ym.slice(2, 4)}`;
      title = `${dayOfMonth} ${monthLabel(ym)}`;
    }
    const guests = items.reduce((sum, g) => sum + g.guests, 0);
    return {
      key,
      label,
      title,
      gatherings: items.length,
      guests,
      returning: items.reduce((sum, g) => sum + g.returning, 0),
      firstTime: items.reduce((sum, g) => sum + g.firstTime, 0),
      average: Math.round(guests / items.length),
      baseline: items.some((g) => g.baseline),
      baselineGuests: items.filter((g) => g.baseline).reduce((sum, g) => sum + g.guests, 0),
      untracked: items.some((g) => !g.tracked),
    };
  });
}

export type Summary = {
  gatherings: number;
  averageGuests: number;
  differentPeople: number;
  firstTimeGuests: number;
  returningShare: number | null;
  busiest: { title: string; guests: number } | null;
  showUp: { rate: number; gatherings: number } | null;
};

export function summarize(list: Gathering[], appearances: AppearanceRow[]): Summary {
  const ids = new Set(list.map((g) => g.id));
  const people = new Set<string>();
  for (const a of appearances) if (ids.has(a.event_id)) people.add(a.person_id);

  const guests = list.reduce((sum, g) => sum + g.guests, 0);
  const counted = list.filter((g) => !g.baseline);
  const countedGuests = counted.reduce((sum, g) => sum + g.guests, 0);
  const busiest = list.reduce<Gathering | null>((best, g) => (!best || g.guests >= best.guests ? g : best), null);
  const marked = list.filter((g) => g.marked);
  const markedRegistered = marked.reduce((sum, g) => sum + g.registered, 0);
  const markedAttended = marked.reduce((sum, g) => sum + g.attended, 0);

  return {
    gatherings: list.length,
    averageGuests: list.length ? Math.round(guests / list.length) : 0,
    differentPeople: people.size,
    firstTimeGuests: list.reduce((sum, g) => sum + g.firstTime, 0),
    returningShare: countedGuests ? Math.round((100 * counted.reduce((sum, g) => sum + g.returning, 0)) / countedGuests) : null,
    busiest: busiest ? { title: shortTitle(busiest), guests: busiest.guests } : null,
    showUp: markedRegistered ? { rate: Math.round((100 * markedAttended) / markedRegistered), gatherings: marked.length } : null,
  };
}

function shortTitle(g: Gathering): string {
  const day = Number(g.day.slice(8, 10));
  return `${day} ${monthLabel(g.day.slice(0, 7))}`;
}

export type FollowUp = {
  windowSize: number;
  regulars: { id: string; count: number }[];
  drifting: { id: string; seen: number; lastSeen: string }[];
};

/** Who keeps coming, and who used to and has gone quiet. Uses every gathering that has happened, not the range. */
export function followUp(all: Gathering[], appearances: AppearanceRow[], today: string): FollowUp {
  const settled = all.filter((g) => g.settled && g.day <= today);
  const last6 = new Set(settled.slice(-6).map((g) => g.id));
  const last3 = new Set(settled.slice(-3).map((g) => g.id));
  const byId = new Map(settled.map((g) => [g.id, g]));

  const seen = new Map<string, { total: number; inLast6: number; inLast3: number; last: Gathering }>();
  for (const a of appearances) {
    const g = byId.get(a.event_id);
    if (!g || (g.tracked && a.attended !== 1)) continue;
    const entry = seen.get(a.person_id) || { total: 0, inLast6: 0, inLast3: 0, last: g };
    entry.total += 1;
    if (last6.has(g.id)) entry.inLast6 += 1;
    if (last3.has(g.id)) entry.inLast3 += 1;
    if (g.held_at > entry.last.held_at) entry.last = g;
    seen.set(a.person_id, entry);
  }

  const regulars = [...seen.entries()]
    .filter(([, e]) => e.inLast6 >= 3)
    .map(([id, e]) => ({ id, count: e.inLast6 }))
    .sort((a, b) => b.count - a.count);
  const drifting = [...seen.entries()]
    .filter(([, e]) => e.total >= 2 && e.inLast3 === 0)
    .map(([id, e]) => ({ id, seen: e.total, lastSeen: monthLabel(e.last.day.slice(0, 7)), lastHeld: e.last.held_at }))
    .sort((a, b) => b.lastHeld.localeCompare(a.lastHeld) || b.seen - a.seen)
    .map(({ id, seen: count, lastSeen }) => ({ id, seen: count, lastSeen }));
  return { windowSize: Math.min(6, settled.length), regulars, drifting };
}

// ---------- charts ----------

const H = 280;
const PAD = { l: 34, r: 6, t: 18, b: 30 };

function niceTop(max: number): { top: number; step: number } {
  const target = Math.max(4, max) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= target) || target;
  return { step: Math.ceil(step), top: Math.ceil(step) * Math.ceil(Math.max(1, max) / Math.ceil(step)) };
}

function frame(width: number, top: number, step: number): { grid: string; plotW: number; plotH: number } {
  const plotW = width - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  let grid = "";
  for (let v = 0; v <= top + 0.001; v += step) {
    const y = PAD.t + plotH - (v / top) * plotH;
    grid += `<line class="rc-grid" x1="${PAD.l}" x2="${width - PAD.r}" y1="${y}" y2="${y}"/><text class="rc-axis" x="${PAD.l - 6}" y="${y + 4}" text-anchor="end">${Math.round(v)}</text>`;
  }
  return { grid, plotW, plotH };
}

function xLabels(labels: string[], band: number, plotW: number): string {
  const every = Math.ceil(labels.length / Math.max(2, Math.floor(plotW / 48)));
  return labels
    .map((label, i) =>
      i % every === 0
        ? `<text class="rc-axis" x="${PAD.l + band * i + band / 2}" y="${H - 10}" text-anchor="middle">${escapeHtml(label)}</text>`
        : "",
    )
    .join("");
}

/** Guests per bucket, stacked as returning (bottom) and first time (top). `width` is the drawing width, so a narrow copy stays readable on a phone. */
export function stackedChart(buckets: Bucket[], aria: string, width = 960): string {
  const { top, step } = niceTop(Math.max(0, ...buckets.map((b) => b.guests)));
  const { grid, plotW, plotH } = frame(width, top, step);
  const band = plotW / Math.max(1, buckets.length);
  const bw = Math.min(34, band * 0.62);
  const scale = (v: number) => (v / top) * plotH;
  const bars = buckets
    .map((b, i) => {
      const x = PAD.l + band * i + (band - bw) / 2;
      const baselineGuests = Math.min(b.baselineGuests, b.firstTime);
      // Bottom to top: returning, first time, then the first gathering on record.
      const parts = [
        { cls: "rc-returning", value: b.returning },
        { cls: "rc-first", value: b.firstTime - baselineGuests },
        { cls: "rc-base", value: baselineGuests },
      ].filter((part) => part.value > 0);
      let y = PAD.t + plotH;
      const rects = parts
        .map((part, index) => {
          const height = scale(part.value);
          y -= height + (index > 0 ? 1.5 : 0);
          return `<rect class="${part.cls}" x="${x}" y="${y}" width="${bw}" height="${height}" rx="2"/>`;
        })
        .join("");
      const tip = `${b.title}: ${b.guests} on the list. ${b.returning} returning, ${b.firstTime} first time${b.baselineGuests ? ` (${b.baselineGuests} of them from the first gathering on record, when nothing came before)` : ""}${b.gatherings > 1 ? `. ${b.gatherings} gatherings, ${b.average} on average` : ""}`;
      return `<g><title>${escapeHtml(tip)}</title>${rects}
        ${band >= 24 ? `<text class="rc-val" x="${x + bw / 2}" y="${y - 6}" text-anchor="middle">${b.guests}</text>` : ""}
      </g>`;
    })
    .join("");
  return `<svg class="report-chart" viewBox="0 0 ${width} ${H}" role="img" aria-label="${escapeHtml(aria)}" preserveAspectRatio="xMidYMid meet">${grid}${bars}${xLabels(buckets.map((b) => b.label), band, plotW)}</svg>`;
}

export type PairItem = { label: string; title: string; listed: number; attended: number };

/** On the list next to actually attended, for gatherings where attendance was taken. */
export function pairChart(items: PairItem[], aria: string, width = 960): string {
  const { top, step } = niceTop(Math.max(0, ...items.map((i) => i.listed)));
  const { grid, plotW, plotH } = frame(width, top, step);
  const band = plotW / Math.max(1, items.length);
  const bw = Math.min(26, band * 0.36);
  const base = PAD.t + plotH;
  const bars = items
    .map((item, i) => {
      const cx = PAD.l + band * i + band / 2;
      const hList = (item.listed / top) * plotH;
      const hAtt = (item.attended / top) * plotH;
      const rate = item.listed ? Math.round((100 * item.attended) / item.listed) : 0;
      return `<g><title>${escapeHtml(`${item.title}: ${item.attended} of ${item.listed} came (${rate}%)`)}</title>
        <rect class="rc-list" x="${cx - bw - 1}" y="${base - hList}" width="${bw}" height="${hList}" rx="2"/>
        <rect class="rc-returning" x="${cx + 1}" y="${base - hAtt}" width="${bw}" height="${hAtt}" rx="2"/>
        ${band >= 24 ? `<text class="rc-val" x="${cx + 1 + bw / 2}" y="${base - hAtt - 6}" text-anchor="middle">${item.attended}</text>` : ""}
      </g>`;
    })
    .join("");
  return `<svg class="report-chart" viewBox="0 0 ${width} ${H}" role="img" aria-label="${escapeHtml(aria)}" preserveAspectRatio="xMidYMid meet">${grid}${bars}${xLabels(items.map((i) => i.label), band, plotW)}</svg>`;
}

/** A wide and a narrow copy of one chart. The stylesheet shows whichever fits the screen. */
export function dualChart(make: (width: number) => string): string {
  return `<div class="report-chart-wide">${make(960)}</div><div class="report-chart-narrow">${make(420)}</div>`;
}

// ---------- page ----------

export type TrendsView = {
  range: Range;
  grain: Grain;
  today: string;
  all: Gathering[];
  list: Gathering[];
  buckets: Bucket[];
  summary: Summary;
  followUp: FollowUp;
  names: Map<string, string>;
  duplicatesPending: number;
};

export function trendsHref(view: { range: Range; grain: Grain }, override: Partial<{ range: string; from: string; to: string; by: Grain }>): string {
  const params = new URLSearchParams({ view: "trends" });
  const by = override.by ?? view.grain;
  if (by !== "gathering") params.set("by", by);
  if (override.from && override.to) {
    params.set("from", override.from);
    params.set("to", override.to);
  } else {
    const range = override.range ?? (view.range.key === "custom" ? "" : view.range.key);
    if (range && range !== "12m") params.set("range", range);
    if (!override.range && view.range.key === "custom") {
      params.set("from", view.range.from);
      params.set("to", view.range.to);
    }
  }
  return `/admin/reports?${params.toString()}`;
}

const GRAINS: [Grain, string][] = [
  ["gathering", "Each gathering"],
  ["month", "By month"],
  ["year", "By year"],
];
const PRESETS: [RangeKey, string][] = [
  ["6m", "Last 6 months"],
  ["12m", "Last 12 months"],
  ["ytd", "This year"],
  ["lastyear", "Last year"],
  ["all", "All time"],
];

function kpi(label: string, value: string, hint = ""): string {
  return `<div class="report-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${hint ? `<em>${escapeHtml(hint)}</em>` : ""}</div>`;
}

function personList(rows: { id: string; note: string }[], names: Map<string, string>, empty: string): string {
  if (!rows.length) return `<p class="report-note">${escapeHtml(empty)}</p>`;
  const item = (row: { id: string; note: string }) =>
    `<li><a href="/admin/people?person=${encodeURIComponent(row.id)}">${escapeHtml(names.get(row.id) || "Unknown")}</a><span>${escapeHtml(row.note)}</span></li>`;
  const head = rows.slice(0, 10).map(item).join("");
  const rest = rows.slice(10);
  return `<ul class="report-people">${head}</ul>${
    rest.length ? `<details class="report-more"><summary>Show ${rest.length} more</summary><ul class="report-people">${rest.map(item).join("")}</ul></details>` : ""
  }`;
}

export function renderTrends(view: TrendsView): string {
  const { range, grain, list, buckets, summary } = view;
  const tabs = reportTabs("trends");
  const presets = PRESETS.map(
    ([key, label]) =>
      `<a class="report-chip${range.key === key ? " is-active" : ""}" href="${trendsHref(view, { range: key })}"${range.key === key ? ' aria-current="true"' : ""}>${label}</a>`,
  ).join("");
  const grains = GRAINS.map(
    ([key, label]) =>
      `<a class="report-seg-item${grain === key ? " is-active" : ""}" href="${trendsHref(view, { by: key })}"${grain === key ? ' aria-current="true"' : ""}>${label}</a>`,
  ).join("");
  const csvParams = new URLSearchParams({ from: range.from, to: range.to });

  const controls = `
    <div class="report-controls">
      <div class="report-chips" role="group" aria-label="Period">${presets}</div>
      <details class="report-customwrap"${range.key === "custom" ? " open" : ""}>
        <summary>Custom range</summary>
        <form class="report-custom" method="get" action="/admin/reports">
          <input type="hidden" name="view" value="trends" />
          ${grain !== "gathering" ? `<input type="hidden" name="by" value="${grain}" />` : ""}
          <label><span>From</span><input type="month" name="from" value="${escapeHtml(range.from)}" required /></label>
          <label><span>To</span><input type="month" name="to" value="${escapeHtml(range.to)}" required /></label>
          <button type="submit" class="btn btn-primary btn-sm">Apply</button>
        </form>
      </details>
    </div>
    <div class="report-toolbar">
      <p class="report-range-label"><strong>${escapeHtml(range.label)}</strong> · ${summary.gatherings} ${summary.gatherings === 1 ? "gathering" : "gatherings"}</p>
      <div class="report-seg" role="group" aria-label="Group by">${grains}</div>
      <a class="btn btn-ghost btn-sm" href="/admin/reports.csv?${csvParams.toString()}">Export CSV</a>
    </div>`;

  if (list.length === 0) {
    return `${header()}${tabs}${controls}<p class="notice">No gatherings in this period yet. Try a wider range.</p>`;
  }

  const anyUntracked = list.some((g) => !g.tracked);
  const kpis = `<div class="report-kpis">
    ${kpi("Average", String(summary.averageGuests), anyUntracked ? "per gathering, on the guest list" : "per gathering")}
    ${kpi("Different people", String(summary.differentPeople), "across the period")}
    ${kpi("Returning share", summary.returningShare === null ? "—" : `${summary.returningShare}%`, list.some((g) => g.baseline) ? "excludes the first gathering on record" : "")}
    ${summary.showUp ? kpi("Show-up", `${summary.showUp.rate}%`, `${summary.showUp.gatherings} ${summary.showUp.gatherings === 1 ? "gathering" : "gatherings"} with attendance`) : ""}
    ${summary.busiest ? kpi("Busiest", String(summary.busiest.guests), summary.busiest.title) : ""}
  </div>`;

  const chartAria = `Guests on the list for ${buckets.length} ${grain === "gathering" ? "gatherings" : grain === "month" ? "months" : "years"}. ${buckets.map((b) => `${b.title}: ${b.guests}`).join(", ")}.`;
  const rollupNote =
    grain === "gathering"
      ? ""
      : `<p class="report-note">Totals across each ${grain}'s gatherings. The table shows the average per gathering.</p>`;
  const untrackedNote = anyUntracked
    ? `<p class="report-note">Attendance was only taken from ${escapeHtml(firstTracked(view.all))} on. Earlier gatherings show the guest list from the spreadsheet, not a headcount.</p>`
    : "";
  const baseline = list.some((g) => g.baseline)
    ? `<span class="report-key"><i class="rc-swatch rc-swatch-base"></i>First gathering on record</span>`
    : "";

  const table = `<details class="report-more report-numbers"><summary>Show the numbers</summary>
    <div class="table-wrap"><table>
      <thead><tr><th>${grain === "gathering" ? "Gathering" : grain === "month" ? "Month" : "Year"}</th>${grain !== "gathering" ? "<th>Gatherings</th>" : ""}<th>On the list</th>${grain !== "gathering" ? "<th>Average</th>" : ""}<th>Returning</th><th>First time</th></tr></thead>
      <tbody>${buckets
        .map(
          (b) =>
            `<tr><td>${escapeHtml(b.title)}</td>${grain !== "gathering" ? `<td>${b.gatherings}</td>` : ""}<td>${b.guests}</td>${grain !== "gathering" ? `<td>${b.average}</td>` : ""}<td>${b.returning}</td><td>${b.firstTime}</td></tr>`,
        )
        .join("")}</tbody>
    </table></div></details>`;

  const chart1 = `<section class="admin-panel report-wide">
    <h2>Guests on the list</h2>
    <div class="report-legend"><span class="report-key"><i class="rc-swatch rc-swatch-returning"></i>Returning</span><span class="report-key"><i class="rc-swatch rc-swatch-first"></i>First time</span>${baseline}</div>
    ${dualChart((w) => stackedChart(buckets, chartAria, w))}
    ${rollupNote}${untrackedNote}${table}
  </section>`;

  const markedList = list.filter((g) => g.marked);
  const waiting = list.filter((g) => g.tracked && !g.marked);
  const pairItems: PairItem[] = markedList.map((g) => ({
    label: buckets.length && grain === "gathering" ? (buckets.find((b) => b.key === g.id)?.label ?? shortTitle(g)) : shortTitle(g),
    title: shortTitle(g),
    listed: g.registered,
    attended: g.attended,
  }));
  const waitingNote = waiting.length
    ? `<p class="report-note">Attendance hasn't been marked yet for ${waiting.map((g) => escapeHtml(shortTitle(g))).join(", ")}. <a href="/admin/registrations">Open the guest list</a> to mark who came.</p>`
    : "";
  const chart2 = `<section class="admin-panel report-wide">
    <h2>Who actually came</h2>
    ${
      pairItems.length
        ? `<div class="report-legend"><span class="report-key"><i class="rc-swatch rc-swatch-list"></i>On the list</span><span class="report-key"><i class="rc-swatch rc-swatch-returning"></i>Came</span></div>
           ${dualChart((w) => pairChart(pairItems, `On the list next to who came: ${pairItems.map((i) => `${i.title} ${i.attended} of ${i.listed}`).join(", ")}.`, w))}`
        : waiting.length
          ? `<p class="report-note">Attendance is taken from ${escapeHtml(firstTracked(view.all))} on. It hasn't been marked yet for ${waiting.map((g) => escapeHtml(shortTitle(g))).join(", ")}. <a href="/admin/registrations">Open the guest list</a> to mark who came, and this chart fills in.</p>`
          : `<p class="report-note">No attendance was taken in this period. It has been taken from ${escapeHtml(firstTracked(view.all))} on, so this chart fills in as gatherings are marked.</p>`
    }
    ${pairItems.length ? waitingNote : ""}
  </section>`;

  const names = view.names;
  const f = view.followUp;
  const regulars = personList(
    f.regulars.map((r) => ({ id: r.id, note: `${r.count} of the last ${f.windowSize}` })),
    names,
    "No one yet. Regulars are people who came to at least 3 of the last 6 gatherings.",
  );
  const drifting = personList(
    f.drifting.map((d) => ({ id: d.id, note: `last came ${d.lastSeen}` })),
    names,
    "No one has gone quiet. This lists people who came at least twice but not in the last 3 gatherings.",
  );
  const dupNote =
    view.duplicatesPending > 0
      ? `<p class="report-note">${view.duplicatesPending} ${view.duplicatesPending === 1 ? "profile has" : "profiles have"} a possible duplicate that hasn't been reviewed, which can make one person look like two guests. <a href="/admin/people">Review them</a>.</p>`
      : "";
  const people = `<section class="admin-panel">
      <div class="admin-panel-head"><h2>Regulars</h2><span class="admin-panel-meta">${f.regulars.length}</span></div>
      <p class="report-note">Came to at least 3 of the last ${f.windowSize} gatherings.</p>
      ${regulars}
    </section>
    <section class="admin-panel">
      <div class="admin-panel-head"><h2>Worth a check-in</h2><span class="admin-panel-meta">${f.drifting.length}</span></div>
      <p class="report-note">Came at least twice, but not in the last 3 gatherings.</p>
      ${drifting}
    </section>`;

  return `${header()}${tabs}${controls}${kpis}
    <div class="report-grid">${chart1}${chart2}${people}</div>${dupNote}`;
}

function firstTracked(all: Gathering[]): string {
  const g = all.find((item) => item.tracked);
  return g ? monthLabel(g.day.slice(0, 7)) : "now";
}

function header(): string {
  return `<header class="admin-pagehead">
      <h1>Reports</h1>
      <p>How gatherings are doing, one at a time and over time.</p>
    </header>`;
}

export function reportTabs(active: "gathering" | "trends"): string {
  return `<nav class="report-tabs" aria-label="Report type">
    <a class="report-tab${active === "gathering" ? " is-active" : ""}" href="/admin/reports"${active === "gathering" ? ' aria-current="page"' : ""}>One gathering</a>
    <a class="report-tab${active === "trends" ? " is-active" : ""}" href="/admin/reports?view=trends"${active === "trends" ? ' aria-current="page"' : ""}>Trends</a>
  </nav>`;
}

// ---------- CSV ----------

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function trendsCsv(list: Gathering[]): string {
  const header = ["Date", "Gathering", "On the guest list", "First time", "Returning", "Attendance taken", "Came", "Show-up %", "Online sign-ups", "Walk-ins", "Imported"];
  const lines = list.map((g) =>
    [
      g.day,
      g.title,
      g.guests,
      g.firstTime,
      g.returning,
      g.tracked ? "Yes" : "No",
      g.marked ? g.attended : null,
      g.marked && g.registered ? Math.round((100 * g.attended) / g.registered) : null,
      g.online,
      g.walkin,
      g.imported,
    ]
      .map(csvCell)
      .join(","),
  );
  return `﻿${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`;
}
