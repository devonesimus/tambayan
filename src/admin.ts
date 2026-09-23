import {
  clearSessionCookie,
  createSessionCookie,
  hashPassword,
  requireAdmin,
  verifyPassword,
} from "./admin-auth";
import {
  DEFAULT_VENUE,
  enforceSingleOpen,
  escapeHtml,
  formatEventWhen,
  getOpenEvent,
  html,
  isPubliclyOpen,
  isValidOptionalEmail,
  json,
  normalizeMobile,
  slugify,
  youtubeId,
  type EventRow,
  type EventStatus,
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
    ["events", "/admin/events", "Events"],
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

function statusBadge(event: EventRow): string {
  const softClosed = event.status === "open" && !isPubliclyOpen(event);
  const label = softClosed
    ? "open (soft-closed)"
    : event.status;
  return `<span class="status-pill status-${escapeHtml(event.status)}${softClosed ? " is-soft-closed" : ""}">${escapeHtml(label)}</span>`;
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
  if (path === "/admin/events") return handleAdminEvents(request, env);
  if (path === "/admin/announcement") {
    return new Response(null, { status: 302, headers: { Location: "/admin/events" } });
  }
  if (path === "/admin/registrations") return renderRegistrations(request, env);
  if (path === "/admin/gallery") return handleAdminGallery(request, env);
  if (path === "/admin/videos") return handleAdminVideos(request, env);

  if (path === "/api/admin/registrations" && request.method === "GET") {
    return apiRegistrations(request, env);
  }
  if (path === "/api/admin/registrations" && request.method === "POST") {
    return apiAdminCreateRegistration(request, env);
  }
  if (path === "/api/admin/events" && request.method === "POST") {
    return apiUpsertEvent(request, env);
  }
  if (path === "/api/admin/events/status" && request.method === "POST") {
    return apiSetEventStatus(request, env);
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
  const open = await getOpenEvent(env.DB);
  const count = open
    ? (
        await env.DB.prepare("SELECT COUNT(*) AS c FROM registrations WHERE event_id = ?")
          .bind(open.id)
          .first<{ c: number }>()
      )?.c || 0
    : 0;
  const totalEvents =
    (await env.DB.prepare(`SELECT COUNT(*) AS c FROM events`).first<{ c: number }>())?.c || 0;

  const body = `
    <h1>Dashboard</h1>
    <p class="lede">Events gate public registration. Admins can still add guests and upload gallery photos anytime an event exists.</p>
    <dl class="event-meta">
      <div><dt>Open for public</dt><dd>${open ? escapeHtml(open.title) : "None"}</dd></div>
      <div><dt>When</dt><dd>${open ? escapeHtml(formatEventWhen(open.held_at)) : "—"}</dd></div>
      <div><dt>Registrations</dt><dd>${count}</dd></div>
      <div><dt>Events</dt><dd>${totalEvents}</dd></div>
    </dl>
    <div class="cta-row">
      <a class="btn btn-primary" href="/admin/events">Manage events</a>
      <a class="btn btn-ghost" href="/admin/registrations">View registrations</a>
    </div>`;

  return html(adminShell(env, request, "Dashboard", body, "dashboard"));
}

async function handleAdminEvents(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const editId = url.searchParams.get("id") || "";
  const events = await env.DB.prepare("SELECT * FROM events ORDER BY held_at DESC").all<EventRow>();
  const editing = editId
    ? events.results.find((e) => e.id === editId) || null
    : null;

  const list =
    events.results.length === 0
      ? `<p class="notice">No events yet. Create the next OFW Tambayan below.</p>`
      : `<ul class="admin-event-list">
        ${events.results
          .map((e) => {
            const soft = e.status === "open" && !isPubliclyOpen(e);
            return `<li>
            <div>
              <strong>${escapeHtml(e.title)}</strong>
              ${statusBadge(e)}
              <div class="latest-meta">${escapeHtml(formatEventWhen(e.held_at))} · ${escapeHtml(e.address)}</div>
            </div>
            <div class="toolbar-actions">
              <a class="btn btn-ghost" href="/admin/events?id=${escapeHtml(e.id)}">Edit</a>
              ${
                e.status === "open"
                  ? `<button type="button" class="btn btn-ghost" data-status="${escapeHtml(e.id)}" data-to="closed">Force close</button>`
                  : e.status === "closed"
                    ? `<button type="button" class="btn btn-ghost" data-status="${escapeHtml(e.id)}" data-to="open">Reopen</button>`
                    : `<button type="button" class="btn btn-ghost" data-status="${escapeHtml(e.id)}" data-to="open">Open</button>
                       <button type="button" class="btn btn-ghost" data-status="${escapeHtml(e.id)}" data-to="closed">Close</button>`
              }
            </div>
          </li>`;
          })
          .join("")}
      </ul>`;

  const formTitle = editing ? "Edit event" : "Create event";
  const body = `
    <h1>Events</h1>
    <p class="lede">One open event at a time for public registration. Soft-close kicks in after <code>held_at</code>; you can force close or reopen anytime. Gallery uploads work for draft, open, or closed events.</p>
    ${list}
    <hr class="divider" />
    <h2>${formTitle}</h2>
    <form class="form" id="event-form">
      <input type="hidden" name="id" value="${escapeHtml(editing?.id || "")}" />
      <label><span>Title</span><input name="title" required maxlength="200" value="${escapeHtml(editing?.title || "")}" placeholder="OFW Tambayan — March 2026" /></label>
      <label><span>Slug</span><input name="slug" required maxlength="80" value="${escapeHtml(editing?.slug || "")}" placeholder="2026-03-29" /></label>
      <label><span>Held at (ISO, Asia/Singapore)</span><input name="held_at" required value="${escapeHtml(editing?.held_at || "")}" placeholder="2026-03-29T14:00:00+08:00" /></label>
      <label><span>Venue / address</span><input name="address" required maxlength="300" value="${escapeHtml(editing?.address || DEFAULT_VENUE)}" /></label>
      <label><span>Announcement title <em>optional — defaults to event title</em></span><input name="announcement_title" maxlength="200" value="${escapeHtml(editing?.announcement_title || "")}" /></label>
      <label><span>Announcement body</span><textarea name="announcement_body" rows="4" maxlength="2000">${escapeHtml(editing?.announcement_body || "")}</textarea></label>
      <label><span>Status</span>
        <select name="status">
          ${(["draft", "open", "closed"] as EventStatus[])
            .map(
              (s) =>
                `<option value="${s}" ${(editing?.status || "draft") === s ? "selected" : ""}>${s}</option>`,
            )
            .join("")}
        </select>
      </label>
      <button class="btn btn-primary" type="submit">${editing ? "Save event" : "Create event"}</button>
      ${editing ? `<a class="btn btn-ghost" href="/admin/events">Cancel edit</a>` : ""}
      <p id="event-status" class="form-status" role="status"></p>
    </form>
    <script src="/admin/events.js" defer></script>`;

  return html(adminShell(env, request, "Events", body, "events"));
}

async function apiUpsertEvent(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    slug?: string;
    held_at?: string;
    address?: string;
    announcement_title?: string;
    announcement_body?: string;
    status?: string;
  };
  const title = String(body.title || "").trim();
  const slug = slugify(String(body.slug || title));
  const held_at = String(body.held_at || "").trim();
  const address = String(body.address || "").trim() || DEFAULT_VENUE;
  const announcement_title = String(body.announcement_title || "").trim() || null;
  const announcement_body = String(body.announcement_body || "").trim();
  const statusRaw = String(body.status || "draft").toLowerCase();
  const status: EventStatus =
    statusRaw === "open" || statusRaw === "closed" || statusRaw === "draft" ? statusRaw : "draft";

  if (!title || !slug || !held_at) return json({ error: "title, slug, held_at required" }, 400);
  if (Number.isNaN(new Date(held_at).getTime())) {
    return json({ error: "held_at must be a valid datetime" }, 400);
  }

  const id = String(body.id || "").trim() || crypto.randomUUID();
  const existing = await env.DB.prepare(`SELECT id FROM events WHERE id = ?`)
    .bind(id)
    .first<{ id: string }>();

  try {
    if (existing) {
      await env.DB.prepare(
        `UPDATE events
         SET slug = ?, title = ?, held_at = ?, address = ?, announcement_title = ?, announcement_body = ?, status = ?
         WHERE id = ?`,
      )
        .bind(slug, title, held_at, address, announcement_title, announcement_body, status, id)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO events (id, slug, title, held_at, address, announcement_title, announcement_body, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, slug, title, held_at, address, announcement_title, announcement_body, status)
        .run();
    }
  } catch {
    return json({ error: "Could not save event (slug may already exist)" }, 400);
  }

  if (status === "open") {
    await enforceSingleOpen(env.DB, id);
  }

  return json({ ok: true, id, slug, status });
}

async function apiSetEventStatus(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { id?: string; status?: string };
  const id = String(body.id || "").trim();
  const statusRaw = String(body.status || "").toLowerCase();
  if (!id) return json({ error: "id required" }, 400);
  if (statusRaw !== "open" && statusRaw !== "closed" && statusRaw !== "draft") {
    return json({ error: "status must be draft, open, or closed" }, 400);
  }
  const event = await env.DB.prepare(`SELECT id FROM events WHERE id = ?`)
    .bind(id)
    .first<{ id: string }>();
  if (!event) return json({ error: "event not found" }, 404);

  await env.DB.prepare(`UPDATE events SET status = ? WHERE id = ?`).bind(statusRaw, id).run();
  if (statusRaw === "open") {
    await enforceSingleOpen(env.DB, id);
  }
  return json({ ok: true, id, status: statusRaw });
}

async function renderRegistrations(request: Request, env: Env): Promise<Response> {
  const events = await env.DB.prepare("SELECT * FROM events ORDER BY held_at DESC").all<EventRow>();
  const open = await getOpenEvent(env.DB);
  const defaultEvent = open?.id || events.results[0]?.id || "";

  const body = `
    <h1>Registrations</h1>
    <p class="lede">Search, sort, paginate, and export. Filter by event. Add a walk-in or late guest for any event, including closed ones.</p>
    <div class="toolbar">
      <label>Event
        <select id="event-filter">
          <option value="">All events</option>
          ${events.results
            .map(
              (e) =>
                `<option value="${escapeHtml(e.id)}" ${e.id === defaultEvent ? "selected" : ""}>${escapeHtml(e.title)} (${escapeHtml(e.status)})</option>`,
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
            <th>Source</th>
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
    <hr class="divider" />
    <h2>Add registration</h2>
    <p class="lede">For walk-ins or late guests — works on draft, open, or closed events.</p>
    <form class="form" id="admin-reg-form">
      <label>Event
        <select name="event_id" required>
          ${events.results
            .map(
              (e) =>
                `<option value="${escapeHtml(e.id)}" ${e.id === defaultEvent ? "selected" : ""}>${escapeHtml(e.title)} (${escapeHtml(e.status)})</option>`,
            )
            .join("")}
        </select>
      </label>
      <label><span>Name</span><input name="name" required maxlength="120" /></label>
      <label><span>Email <em>optional</em></span><input name="email" type="email" maxlength="200" /></label>
      <label><span>Mobile</span><input name="mobile" required maxlength="20" placeholder="+65…" /></label>
      <button class="btn btn-primary" type="submit">Add guest</button>
      <p id="admin-reg-status" class="form-status" role="status"></p>
    </form>
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

async function apiAdminCreateRegistration(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    event_id?: string;
    name?: string;
    email?: string;
    mobile?: string;
  };
  const eventId = String(body.event_id || "").trim();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const mobile = String(body.mobile || "").trim();

  if (!eventId) return json({ error: "event_id required" }, 400);
  if (!name || name.length > 120) return json({ error: "Name is required." }, 400);
  if (!isValidOptionalEmail(email)) return json({ error: "Email looks invalid." }, 400);
  const mobileNorm = normalizeMobile(mobile);
  if (!mobileNorm) return json({ error: "Enter a valid mobile number." }, 400);

  const event = await env.DB.prepare(`SELECT id, title FROM events WHERE id = ?`)
    .bind(eventId)
    .first<{ id: string; title: string }>();
  if (!event) return json({ error: "event not found" }, 404);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO registrations (id, event_id, name, email, mobile, privacy_policy_agreed_at, source, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, 'admin', ?)`,
  )
    .bind(id, eventId, name, email || null, mobileNorm, now)
    .run();

  return json({ ok: true, id, event: { id: event.id, title: event.title } });
}

async function handleAdminGallery(request: Request, env: Env): Promise<Response> {
  const events = await env.DB.prepare("SELECT * FROM events ORDER BY held_at DESC").all<EventRow>();
  const selected = new URL(request.url).searchParams.get("event_id") || events.results[0]?.id || "";
  let imagesHtml = "<p class=\"notice\">Create an event first, then upload photos anytime.</p>";
  if (selected) {
    const images = await env.DB.prepare(
      `SELECT * FROM gallery_images WHERE event_id = ? ORDER BY sort_order, created_at`,
    )
      .bind(selected)
      .all();
    imagesHtml =
      images.results.length === 0
        ? `<p class="notice">No photos yet for this event. Upload anytime — registration status does not matter.</p>`
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
    <p class="lede">Images are stored in R2 and linked to an event. Upload as soon as the event exists (draft, open, or closed).</p>
    <form class="form" id="gallery-form">
      <label>Event
        <select name="event_id" id="gallery-event" required>
          ${events.results
            .map(
              (e) =>
                `<option value="${escapeHtml(e.id)}" ${e.id === selected ? "selected" : ""}>${escapeHtml(e.title)} (${escapeHtml(e.status)})</option>`,
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
