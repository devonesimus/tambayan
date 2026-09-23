/** Shared helpers for OFW Tambayan Worker */

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
};

export type RegistrationRow = {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  mobile: string;
  privacy_policy_agreed_at: string;
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

export async function getNextEvent(db: D1Database): Promise<EventRow | null> {
  const settings = await getSettings(db);
  if (!settings.next_event_id) return null;
  return (
    (await db
      .prepare("SELECT * FROM events WHERE id = ?")
      .bind(settings.next_event_id)
      .first<EventRow>()) ?? null
  );
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
