import {
  clearSessionCookie,
  createSessionCookie,
  hashPassword,
  requireAdmin,
  verifyPassword,
} from "./admin-auth";
import {
  escapeHtml,
  formatEventWhen,
  getSettings,
  html,
  json,
  youtubeId,
  type EventRow,
  type RegistrationRow,
  type VideoRow,
} from "./helpers";
import { layout } from "./layout";

function adminShell(
  env: Env,
  request: Request,
  title: string,
  body: string,
  active: string,
): string {
  const nav = [
    ["dashboard", "/admin", "Dashboard"],
    ["announcement", "/admin/announcement", "Announcement"],
    ["registrations", "/admin/registrations", "Registrations"],
    ["gallery", "/admin/gallery", "Gallery"],
    ["videos", "/admin/videos", "Videos"],
  ]
    .map(
      ([id, href, label]) =>
        `<a href="${href}" class="${active === id ? "is-active" : ""}">${label}</a>`,
    )
    .join("");

  return layout({
    env,
    request,
    title: `${title} · Admin`,
    active: "admin",
    body: `<section class="admin">
      <div class="admin-bar">
        <nav class="admin-nav">${nav}</nav>
        <form method="post" action="/admin/logout"><button class="btn btn-ghost" type="submit">Log out</button></form>
      </div>
      ${body}
    </section>`,
  });
}

export async function handleAdmin(request: Request, env: Env, path: string): Promise<Response> {
  if (path === "/admin/login") return handleLogin(request, env);
  const secureCookie = new URL(request.url).protocol === "https:";

  if (path === "/admin/logout" && request.method === "POST") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/admin/login",
        "Set-Cookie": clearSessionCookie(secureCookie),
      },
    });
  }

  // Local-only helper to generate password hashes for seed SQL
  if (path === "/api/admin/hash-password" && request.method === "POST") {
    const url = new URL(request.url);
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return json({ error: "Only available on localhost" }, 403);
    }
    const body = (await request.json()) as { password?: string };
    if (!body.password) return json({ error: "password required" }, 400);
    const hash = await hashPassword(body.password);
    return json({ hash });
  }

  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) {
    if (path.startsWith("/api/admin")) return json({ error: "Unauthorized" }, 401);
    return auth;
  }

  if (path === "/admin" || path === "/admin/") return renderDashboard(request, env);
  if (path === "/admin/announcement") return handleAnnouncement(request, env);
  if (path === "/admin/registrations") return renderRegistrations(request, env);
  if (path === "/admin/gallery") return handleAdminGallery(request, env);
  if (path === "/admin/videos") return handleAdminVideos(request, env);

  if (path === "/api/admin/registrations") return apiRegistrations(request, env);
  if (path === "/api/admin/announcement" && request.method === "POST") {
    return apiSaveAnnouncement(request, env);
  }
  if (path === "/api/admin/gallery" && request.method === "POST") {
    return apiUploadGallery(request, env);
  }
  if (path === "/api/admin/gallery" && request.method === "DELETE") {
    return apiDeleteGallery(request, env);
  }
  if (path === "/api/admin/videos" && request.method === "POST") {
    return apiUpsertVideo(request, env);
  }
  if (path === "/api/admin/videos" && request.method === "DELETE") {
    return apiDeleteVideo(request, env);
  }
  if (path === "/api/admin/events" && request.method === "POST") {
    return apiCreateEvent(request, env);
  }

  return json({ error: "Not found" }, 404);
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (request.method === "POST") {
    const form = await request.formData();
    const email = String(form.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") || "");
    const user = await env.DB.prepare("SELECT email, password_hash FROM admin_users WHERE email = ?")
      .bind(email)
      .first<{ email: string; password_hash: string }>();

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return html(
        layout({
          env,
          request,
          title: "Admin login",
          body: loginForm("Invalid email or password."),
        }),
        401,
      );
    }
    if (!env.SESSION_SECRET) {
      return html(
        layout({
          env,
          request,
          title: "Admin login",
          body: loginForm("SESSION_SECRET is not configured."),
        }),
        500,
      );
    }
    const cookie = await createSessionCookie(
      user.email,
      env.SESSION_SECRET,
      new URL(request.url).protocol === "https:",
    );
    return new Response(null, {
      status: 302,
      headers: { Location: "/admin", "Set-Cookie": cookie },
    });
  }

  return html(
    layout({
      env,
      request,
      title: "Admin login",
      body: loginForm(),
    }),
  );
}

function loginForm(error?: string): string {
  return `<section class="narrow">
    <h1>Admin login</h1>
    <p class="lede">Seeded organizers only — no public sign-up.</p>
    ${error ? `<p class="form-status is-error">${escapeHtml(error)}</p>` : ""}
    <form class="form" method="post" action="/admin/login">
      <label><span>Email</span><input name="email" type="email" required autocomplete="username" /></label>
      <label><span>Password</span><input name="password" type="password" required autocomplete="current-password" /></label>
      <button class="btn btn-primary" type="submit">Sign in</button>
    </form>
  </section>`;
}

async function renderDashboard(request: Request, env: Env): Promise<Response> {
  const settings = await getSettings(env.DB);
  const event = settings.next_event_id
    ? await env.DB.prepare("SELECT * FROM events WHERE id = ?")
        .bind(settings.next_event_id)
        .first<EventRow>()
    : null;
  const count = event
    ? (
        await env.DB.prepare("SELECT COUNT(*) AS c FROM registrations WHERE event_id = ?")
          .bind(event.id)
          .first<{ c: number }>()
      )?.c || 0
    : 0;

  const body = `
    <h1>Dashboard</h1>
    <p class="lede">Manage the next OFW Tambayan announcement, registrations, gallery, and shorts.</p>
    <dl class="event-meta">
      <div><dt>Next event</dt><dd>${event ? escapeHtml(event.title) : "Not set"}</dd></div>
      <div><dt>When</dt><dd>${event ? escapeHtml(formatEventWhen(event.held_at)) : "—"}</dd></div>
      <div><dt>Registrations</dt><dd>${count}</dd></div>
    </dl>
    <div class="cta-row">
      <a class="btn btn-primary" href="/admin/announcement">Edit announcement</a>
      <a class="btn btn-ghost" href="/admin/registrations">View registrations</a>
    </div>`;

  return html(adminShell(env, request, "Dashboard", body, "dashboard"));
}

async function handleAnnouncement(request: Request, env: Env): Promise<Response> {
  const settings = await getSettings(env.DB);
  const events = await env.DB.prepare("SELECT * FROM events ORDER BY held_at DESC").all<EventRow>();

  const body = `
    <h1>Announcement</h1>
    <p class="lede">This copy appears on the home page and drives public registration.</p>
    <form class="form" id="announcement-form">
      <label>
        <span>Title</span>
        <input name="announcement_title" required maxlength="200" value="${escapeHtml(settings.announcement_title)}" />
      </label>
      <label>
        <span>Body</span>
        <textarea name="announcement_body" rows="5" required maxlength="2000">${escapeHtml(settings.announcement_body)}</textarea>
      </label>
      <label>
        <span>Location override</span>
        <input name="location_override" maxlength="200" value="${escapeHtml(settings.location_override || "")}" placeholder="${escapeHtml(env.DEFAULT_LOCATION)}" />
      </label>
      <label>
        <span>Next event (registrations target)</span>
        <select name="next_event_id">
          <option value="">— none —</option>
          ${events.results
            .map(
              (e) =>
                `<option value="${escapeHtml(e.id)}" ${settings.next_event_id === e.id ? "selected" : ""}>${escapeHtml(e.title)} (${escapeHtml(e.slug)})</option>`,
            )
            .join("")}
        </select>
      </label>
      <button class="btn btn-primary" type="submit">Save announcement</button>
      <p id="announcement-status" class="form-status" role="status"></p>
    </form>
    <hr class="divider" />
    <h2>Create event</h2>
    <form class="form" id="event-form">
      <label><span>Title</span><input name="title" required maxlength="200" placeholder="OFW Tambayan — March 2026" /></label>
      <label><span>Slug</span><input name="slug" required maxlength="80" placeholder="2026-03-29" /></label>
      <label><span>Held at (ISO, Asia/Singapore)</span><input name="held_at" required placeholder="2026-03-29T14:00:00+08:00" /></label>
      <button class="btn btn-ghost" type="submit">Create event</button>
      <p id="event-status" class="form-status" role="status"></p>
    </form>
    <script src="/admin/announcement.js" defer></script>`;

  return html(adminShell(env, request, "Announcement", body, "announcement"));
}

async function apiSaveAnnouncement(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    announcement_title?: string;
    announcement_body?: string;
    location_override?: string;
    next_event_id?: string;
  };
  const title = String(body.announcement_title || "").trim();
  const text = String(body.announcement_body || "").trim();
  if (!title || !text) return json({ error: "Title and body are required" }, 400);
  const location = String(body.location_override || "").trim() || null;
  const nextId = String(body.next_event_id || "").trim() || null;
  await env.DB.prepare(
    `UPDATE site_settings
     SET announcement_title = ?, announcement_body = ?, location_override = ?, next_event_id = ?, updated_at = datetime('now')
     WHERE id = 1`,
  )
    .bind(title, text, location, nextId)
    .run();
  return json({ ok: true });
}

async function apiCreateEvent(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { title?: string; slug?: string; held_at?: string };
  const title = String(body.title || "").trim();
  const slug = String(body.slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const held_at = String(body.held_at || "").trim();
  if (!title || !slug || !held_at) return json({ error: "title, slug, held_at required" }, 400);
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO events (id, slug, title, held_at) VALUES (?, ?, ?, ?)`,
    )
      .bind(id, slug, title, held_at)
      .run();
  } catch {
    return json({ error: "Could not create event (slug may already exist)" }, 400);
  }
  return json({ ok: true, id, slug });
}

async function renderRegistrations(request: Request, env: Env): Promise<Response> {
  const events = await env.DB.prepare("SELECT * FROM events ORDER BY held_at DESC").all<EventRow>();
  const settings = await getSettings(env.DB);
  const defaultEvent = settings.next_event_id || events.results[0]?.id || "";

  const body = `
    <h1>Registrations</h1>
    <p class="lede">Search, sort, paginate, and export. Filter by event.</p>
    <div class="toolbar">
      <label>Event
        <select id="event-filter">
          <option value="">All events</option>
          ${events.results
            .map(
              (e) =>
                `<option value="${escapeHtml(e.id)}" ${e.id === defaultEvent ? "selected" : ""}>${escapeHtml(e.title)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label>Search
        <input id="reg-search" type="search" placeholder="Name, email, mobile" />
      </label>
      <label>Sort
        <select id="reg-sort">
          <option value="created_at:desc">Newest</option>
          <option value="created_at:asc">Oldest</option>
          <option value="name:asc">Name A–Z</option>
          <option value="name:desc">Name Z–A</option>
        </select>
      </label>
      <div class="toolbar-actions">
        <button type="button" class="btn btn-ghost" id="export-xlsx">Export Excel</button>
        <button type="button" class="btn btn-ghost" id="export-pdf">Export PDF</button>
      </div>
    </div>
    <div class="table-wrap">
      <table id="reg-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Mobile</th>
            <th>Event</th>
            <th>Registered</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="pager">
      <button type="button" class="btn btn-ghost" id="prev-page">Previous</button>
      <span id="page-info">Page 1</span>
      <button type="button" class="btn btn-ghost" id="next-page">Next</button>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js" defer></script>
    <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js" defer></script>
    <script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js" defer></script>
    <script src="/admin/registrations.js" defer></script>`;

  return html(adminShell(env, request, "Registrations", body, "registrations"));
}

async function apiRegistrations(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("event_id") || "";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const sort = url.searchParams.get("sort") || "created_at:desc";
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get("page_size") || "25")));

  const [sortCol, sortDirRaw] = sort.split(":");
  const allowedSort = new Set(["created_at", "name", "email", "mobile"]);
  const col = allowedSort.has(sortCol) ? sortCol : "created_at";
  const dir = sortDirRaw?.toLowerCase() === "asc" ? "ASC" : "DESC";

  let sql = `SELECT r.*, e.title AS event_title, e.slug AS event_slug
             FROM registrations r
             JOIN events e ON e.id = r.event_id
             WHERE 1=1`;
  const binds: unknown[] = [];
  if (eventId) {
    sql += ` AND r.event_id = ?`;
    binds.push(eventId);
  }
  if (q) {
    sql += ` AND (lower(r.name) LIKE ? OR lower(coalesce(r.email,'')) LIKE ? OR lower(r.mobile) LIKE ?)`;
    const like = `%${q}%`;
    binds.push(like, like, like);
  }

  const countSql = `SELECT COUNT(*) AS c FROM (${sql})`;
  const total =
    (await env.DB.prepare(countSql)
      .bind(...binds)
      .first<{ c: number }>())?.c || 0;

  sql += ` ORDER BY r.${col} ${dir} LIMIT ? OFFSET ?`;
  const rows = await env.DB.prepare(sql)
    .bind(...binds, pageSize, (page - 1) * pageSize)
    .all<RegistrationRow & { event_title: string; event_slug: string }>();

  return json({
    total,
    page,
    page_size: pageSize,
    rows: rows.results,
  });
}

async function handleAdminGallery(request: Request, env: Env): Promise<Response> {
  const events = await env.DB.prepare("SELECT * FROM events ORDER BY held_at DESC").all<EventRow>();
  const selected = new URL(request.url).searchParams.get("event_id") || events.results[0]?.id || "";
  let imagesHtml = "<p class=\"notice\">Select an event.</p>";
  if (selected) {
    const images = await env.DB.prepare(
      `SELECT * FROM gallery_images WHERE event_id = ? ORDER BY sort_order, created_at`,
    )
      .bind(selected)
      .all();
    imagesHtml =
      images.results.length === 0
        ? `<p class="notice">No photos yet for this event.</p>`
        : `<ul class="admin-photo-list">
          ${images.results
            .map((img: Record<string, unknown>) => {
              const key = String(img.r2_key);
              const id = String(img.id);
              return `<li>
                <img src="/api/media/${encodeURIComponent(key)}" alt="" />
                <div>
                  <code>${escapeHtml(key)}</code>
                  <button type="button" class="btn btn-ghost btn-danger" data-delete-image="${escapeHtml(id)}">Delete</button>
                </div>
              </li>`;
            })
            .join("")}
        </ul>`;
  }

  const body = `
    <h1>Gallery upload</h1>
    <p class="lede">Images are stored in R2 and linked to an event.</p>
    <form class="form" id="gallery-form">
      <label>Event
        <select name="event_id" id="gallery-event" required>
          ${events.results
            .map(
              (e) =>
                `<option value="${escapeHtml(e.id)}" ${e.id === selected ? "selected" : ""}>${escapeHtml(e.title)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label>Caption <em>optional</em>
        <input name="caption" maxlength="200" />
      </label>
      <label>Photo
        <input name="file" type="file" accept="image/*" required />
      </label>
      <button class="btn btn-primary" type="submit">Upload</button>
      <p id="gallery-status" class="form-status" role="status"></p>
    </form>
    <div id="gallery-list">${imagesHtml}</div>
    <script src="/admin/gallery.js" defer></script>`;

  return html(adminShell(env, request, "Gallery", body, "gallery"));
}

async function apiUploadGallery(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const eventId = String(form.get("event_id") || "");
  const caption = String(form.get("caption") || "").trim() || null;
  const file = form.get("file");
  if (!eventId || !(file instanceof File)) return json({ error: "event_id and file required" }, 400);
  const event = await env.DB.prepare("SELECT id, slug FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ id: string; slug: string }>();
  if (!event) return json({ error: "event not found" }, 404);

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const id = crypto.randomUUID();
  const key = `gallery/${event.slug}/${id}.${ext}`;
  await env.GALLERY.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "image/jpeg" },
  });
  const maxSort =
    (
      await env.DB.prepare(
        `SELECT COALESCE(MAX(sort_order), -1) AS m FROM gallery_images WHERE event_id = ?`,
      )
        .bind(eventId)
        .first<{ m: number }>()
    )?.m ?? -1;
  await env.DB.prepare(
    `INSERT INTO gallery_images (id, event_id, r2_key, sort_order, caption) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, eventId, key, maxSort + 1, caption)
    .run();

  // Set cover if missing
  await env.DB.prepare(
    `UPDATE events SET cover_image_key = COALESCE(cover_image_key, ?) WHERE id = ?`,
  )
    .bind(key, eventId)
    .run();

  return json({ ok: true, id, key });
}

async function apiDeleteGallery(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { id?: string };
  if (!body.id) return json({ error: "id required" }, 400);
  const row = await env.DB.prepare(`SELECT * FROM gallery_images WHERE id = ?`)
    .bind(body.id)
    .first<{ id: string; r2_key: string; event_id: string }>();
  if (!row) return json({ error: "not found" }, 404);
  await env.GALLERY.delete(row.r2_key);
  await env.DB.prepare(`DELETE FROM gallery_images WHERE id = ?`).bind(row.id).run();
  return json({ ok: true });
}

async function handleAdminVideos(request: Request, env: Env): Promise<Response> {
  const videos = await env.DB.prepare(
    `SELECT * FROM videos ORDER BY sort_order ASC, published_at DESC`,
  ).all<VideoRow>();

  const body = `
    <h1>Videos / Shorts</h1>
    <p class="lede">Paste YouTube (or Shorts) URLs. No Stream in v1.</p>
    <form class="form" id="video-form">
      <input type="hidden" name="id" value="" />
      <label><span>Title</span><input name="title" required maxlength="200" /></label>
      <label><span>YouTube URL</span><input name="youtube_url" required placeholder="https://www.youtube.com/shorts/…" /></label>
      <label><span>Sort order</span><input name="sort_order" type="number" value="0" /></label>
      <button class="btn btn-primary" type="submit">Save video</button>
      <p id="video-status" class="form-status" role="status"></p>
    </form>
    <ul class="admin-video-list">
      ${videos.results
        .map(
          (v) => `<li>
          <div>
            <strong>${escapeHtml(v.title)}</strong>
            <a href="${escapeHtml(v.youtube_url)}" target="_blank" rel="noopener">${escapeHtml(v.youtube_url)}</a>
          </div>
          <button type="button" class="btn btn-ghost btn-danger" data-delete-video="${escapeHtml(v.id)}">Delete</button>
        </li>`,
        )
        .join("") || "<li class=\"notice\">No videos yet.</li>"}
    </ul>
    <script src="/admin/videos.js" defer></script>`;

  return html(adminShell(env, request, "Videos", body, "videos"));
}

async function apiUpsertVideo(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    youtube_url?: string;
    sort_order?: number;
  };
  const title = String(body.title || "").trim();
  const youtube_url = String(body.youtube_url || "").trim();
  const sort_order = Number(body.sort_order || 0);
  if (!title || !youtube_url) return json({ error: "title and youtube_url required" }, 400);
  if (!youtubeId(youtube_url)) return json({ error: "Unrecognized YouTube URL" }, 400);
  const id = body.id || crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO videos (id, title, youtube_url, sort_order, published_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, youtube_url = excluded.youtube_url, sort_order = excluded.sort_order`,
  )
    .bind(id, title, youtube_url, sort_order)
    .run();
  return json({ ok: true, id });
}

async function apiDeleteVideo(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { id?: string };
  if (!body.id) return json({ error: "id required" }, 400);
  await env.DB.prepare(`DELETE FROM videos WHERE id = ?`).bind(body.id).run();
  return json({ ok: true });
}
