/** Shared helpers for OFW Tambayan Worker */

export type EventStatus = "draft" | "open" | "closed";

export type SiteSettings = {
  id: number;
  next_event_id: string | null;
  announcement_title: string;
  announcement_body: string;
  location_override: string | null;
  updated_at: string;
};

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  held_at: string;
  cover_image_key: string | null;
  created_at: string;
  status: EventStatus;
  address: string;
  announcement_title: string | null;
  announcement_body: string;
};

export type RegistrationRow = {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  mobile: string;
  privacy_policy_agreed_at: string | null;
  source: "public" | "admin" | "import";
  attended: number;
  person_id: string | null;
  created_at: string;
};

export type PersonRow = {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  birth_date: string | null;
  joined_on: string | null;
  carer_id: string | null;
  carer_name: string | null;
  created_at: string;
};

export type GalleryImageRow = {
  id: string;
  event_id: string;
  r2_key: string;
  sort_order: number;
  caption: string | null;
  created_at: string;
};

export type VideoRow = {
  id: string;
  title: string;
  youtube_url: string;
  sort_order: number;
  published_at: string;
  created_at: string;
};

export const DEFAULT_VENUE = "Level 1 Main Auditorium, 798 Thomson Road, Singapore 298186";

/** Locked gallery upload limits — keep in sync with public/admin/gallery.js */
export const GALLERY_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const GALLERY_MAX_BATCH = 20;
export const GALLERY_MAX_PER_EVENT = 120;
export const GALLERY_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const GALLERY_ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
export const GALLERY_WARN_REMAINING = 20;

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function html(body: string, status = 200, headers: HeadersInit = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function siteBase(env: Env, request: Request): string {
  const configured = (env.SITE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

export async function getSettings(db: D1Database): Promise<SiteSettings> {
  const row = await db
    .prepare("SELECT * FROM site_settings WHERE id = 1")
    .first<SiteSettings>();
  if (!row) {
    throw new Error("site_settings row missing — run migrations");
  }
  return row;
}

/** Admin-controlled status is soft-closed for the public once held_at has passed. */
export function isPubliclyOpen(event: EventRow, now = new Date()): boolean {
  if (event.status !== "open") return false;
  const held = new Date(event.held_at);
  if (Number.isNaN(held.getTime())) return false;
  return held.getTime() > now.getTime();
}

export function publicRegistrationState(
  event: EventRow | null,
  now = new Date(),
): "open" | "closed" | "none" {
  if (!event) return "none";
  if (isPubliclyOpen(event, now)) return "open";
  return "closed";
}

/** The single event currently open for public registration (status=open and not past held_at). */
export async function getOpenEvent(db: D1Database): Promise<EventRow | null> {
  const row = await db
    .prepare(
      `SELECT * FROM events
       WHERE status = 'open'
       ORDER BY held_at ASC
       LIMIT 1`,
    )
    .first<EventRow>();
  if (!row) return null;
  if (!isPubliclyOpen(row)) return null;
  return row;
}

/**
 * Home hero source: current open event, else soonest upcoming (open/draft with future held_at),
 * else most recent non-draft.
 */
export async function getHomeEvent(db: D1Database): Promise<EventRow | null> {
  const open = await getOpenEvent(db);
  if (open) return open;

  const upcoming = await db
    .prepare(
      `SELECT * FROM events
       WHERE status IN ('open', 'draft')
         AND datetime(held_at) >= datetime('now')
       ORDER BY held_at ASC
       LIMIT 1`,
    )
    .first<EventRow>();
  if (upcoming) return upcoming;

  return (
    (await db
      .prepare(
        `SELECT * FROM events
         WHERE status != 'draft'
         ORDER BY held_at DESC
         LIMIT 1`,
      )
      .first<EventRow>()) ?? null
  );
}

/** @deprecated Prefer getOpenEvent / getHomeEvent — kept for gradual migration. */
export async function getNextEvent(db: D1Database): Promise<EventRow | null> {
  return getOpenEvent(db);
}

export function eventAnnouncementTitle(event: EventRow): string {
  return (event.announcement_title || event.title || "OFW Tambayan").trim();
}

export function eventAnnouncementBody(event: EventRow): string {
  return (event.announcement_body || "").trim();
}

export function eventVenue(event: EventRow, env?: Env): string {
  return (event.address || env?.DEFAULT_LOCATION || DEFAULT_VENUE).trim();
}

export function formatEventWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Compact hero headline, e.g. `SUN · 27 SEP · 2–4 PM` (SGT). */
export function formatEventHeadline(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || "";
  const weekday = get("weekday").toUpperCase().slice(0, 3);
  const day = get("day");
  // Force 3-letter month (en-SG may yield "Sept").
  const month = get("month").toUpperCase().replace(/\./g, "").slice(0, 3);
  // Gatherings usually run 2–4 PM; show that window only when the event really starts at 2:00 PM.
  const hour = Number(get("hour"));
  const minute = get("minute");
  const dayPeriod = get("dayPeriod").toUpperCase();
  const start = `${hour}${minute && minute !== "00" ? `:${minute}` : ""}${dayPeriod ? ` ${dayPeriod}` : ""}`;
  const timeWindow = dayPeriod === "PM" && hour === 2 && minute === "00" ? "2–4 PM" : start;
  return `${weekday} · ${day} ${month} · ${timeWindow}`;
}

export function normalizeMobile(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, "");
  if (!/^\+?[0-9]{8,15}$/.test(cleaned)) return null;
  return cleaned;
}

export function isValidOptionalEmail(email: string): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function foldName(name: string): string {
  return name
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** The shorter full name sits inside the longer one. A shared first name alone does not count. */
export function namesSuspect(a: string, b: string): boolean {
  const fa = foldName(a);
  const fb = foldName(b);
  if (!fa || !fb || fa === fb) return false;
  const [short, long] = fa.length <= fb.length ? [fa, fb] : [fb, fa];
  if (short.length < 4) return false;
  if (long.indexOf(short) !== 0) return false;
  const next = long[short.length];
  return next === " " || (next !== undefined && next !== " " && /[a-z0-9]/.test(next));
}

export function personCompleteness(row: {
  name: string;
  email: string | null;
  mobile: string | null;
  birth_date?: string | null;
  joined_on?: string | null;
  carer_name?: string | null;
}): number {
  let score = registrationCompleteness({
    name: row.name,
    email: row.email,
    mobile: row.mobile || "",
  });
  if (row.birth_date) score += 4;
  if (row.joined_on) score += 2;
  if (row.carer_name?.trim()) score += 2;
  return score;
}

export function linkPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function birthMonth(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? month : null;
}

export function eventMonth(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    month: "numeric",
  }).format(d);
  const n = Number(month);
  return n >= 1 && n <= 12 ? n : null;
}

function mobileDigits(mobile: string): string {
  return mobile.replace(/\D/g, "");
}

export function mobilesMatch(a: string, b: string): boolean {
  const da = mobileDigits(a);
  const db = mobileDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const [short, long] = da.length <= db.length ? [da, db] : [db, da];
  return short.length >= 8 && long.endsWith(short);
}

/** Higher means a fuller guest record: more of the name, plus email and mobile. */
export function registrationCompleteness(row: {
  name: string;
  email: string | null;
  mobile: string;
}): number {
  const name = row.name.trim().replace(/\s+/g, " ");
  const words = name ? name.split(" ").filter(Boolean).length : 0;
  let score = Math.min(words, 4) * 2;
  if (row.email?.trim()) score += 4;
  if (row.mobile?.trim()) score += 4;
  return score;
}

export function sameRegistration(
  row: { name: string; email: string | null; mobile: string },
  incoming: { name: string; email: string; mobile: string },
): boolean {
  const rowMobile = (row.mobile || "").trim();
  const incomingMobile = incoming.mobile.trim();
  if (rowMobile && incomingMobile && mobilesMatch(rowMobile, incomingMobile)) return true;

  if (foldName(row.name) !== foldName(incoming.name) || !foldName(incoming.name)) return false;
  if (rowMobile && incomingMobile && !mobilesMatch(rowMobile, incomingMobile)) return false;
  const rowEmail = (row.email || "").trim().toLowerCase();
  const incomingEmail = incoming.email.trim().toLowerCase();
  if (rowEmail && incomingEmail && rowEmail !== incomingEmail) return false;
  return true;
}

export function preferRegistrationField(
  current: { name: string; email: string | null; mobile: string },
  incoming: { name: string; email: string; mobile: string },
): { name: string; email: string | null; mobile: string } {
  const currentName = current.name.trim().replace(/\s+/g, " ");
  const incomingName = incoming.name.trim().replace(/\s+/g, " ");
  const currentWords = currentName ? currentName.split(" ").filter(Boolean).length : 0;
  const incomingWords = incomingName ? incomingName.split(" ").filter(Boolean).length : 0;
  const name =
    incomingWords > currentWords || (incomingWords === currentWords && incomingName.length > currentName.length)
      ? incomingName
      : currentName;
  const email = current.email?.trim() ? current.email : incoming.email.trim() || null;
  const currentDigits = mobileDigits(current.mobile || "");
  const incomingDigits = mobileDigits(incoming.mobile || "");
  const mobile =
    !current.mobile?.trim() || incomingDigits.length > currentDigits.length
      ? incoming.mobile.trim() || current.mobile
      : current.mobile;
  return { name, email, mobile };
}

export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Ensure at most one open event; closes other open rows when opening `keepOpenId`. */
export async function enforceSingleOpen(db: D1Database, keepOpenId: string): Promise<void> {
  await db
    .prepare(`UPDATE events SET status = 'closed' WHERE status = 'open' AND id != ?`)
    .bind(keepOpenId)
    .run();
}

/** Extract YouTube video id from common URL shapes. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace(/^\//, "").split("/")[0] || null;
    }
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const shorts = u.pathname.match(/\/shorts\/([^/]+)/);
    if (shorts) return shorts[1];
    const embed = u.pathname.match(/\/embed\/([^/]+)/);
    if (embed) return embed[1];
    return null;
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function youtubeThumb(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
