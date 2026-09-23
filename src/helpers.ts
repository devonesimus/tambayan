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
  source: "public" | "admin";
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

export function normalizeMobile(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, "");
  if (!/^\+?[0-9]{8,15}$/.test(cleaned)) return null;
  return cleaned;
}

export function isValidOptionalEmail(email: string): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
