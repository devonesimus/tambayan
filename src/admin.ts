import {
  clearSessionCookie,
  createSessionCookie,
  hashPassword,
  readSession,
  requireAdmin,
  verifyPassword,
} from "./admin-auth";
import {
  DEFAULT_VENUE,
  enforceSingleOpen,
  escapeHtml,
  formatEventWhen,
  GALLERY_ALLOWED_EXT,
  GALLERY_ALLOWED_MIME,
  GALLERY_MAX_BATCH,
  GALLERY_MAX_FILE_BYTES,
  GALLERY_MAX_PER_EVENT,
  GALLERY_WARN_REMAINING,
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

async function recordAudit(
  env: Env,
  entry: { actor: string; action: string; targetId?: string | null; summary: string },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO admin_audit (id, created_at, actor, action, target_id, summary)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      entry.actor,
      entry.action,
      entry.targetId || null,
      entry.summary.slice(0, 300),
    )
    .run();
}

function auditWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

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
        <nav class="admin-nav" aria-label="Admin">${nav}</nav>
        <div class="admin-bar-actions">
          <button type="button" class="theme-toggle" id="admin-theme" aria-pressed="false">Dark mode</button>
          <a class="admin-site-link${active === "activity" ? " is-active" : ""}" href="/admin/activity">Activity</a>
          <a class="admin-site-link" href="/">View site</a>
          <form method="post" action="/admin/logout"><button class="btn btn-ghost" type="submit">Log out</button></form>
        </div>
      </div>
      ${body}
    </section>
    <script>
      (() => {
        const btn = document.getElementById("admin-theme");
        if (!btn) return;
        const key = "tambayan-admin-theme";
        const apply = (dark) => {
          document.documentElement.toggleAttribute("data-admin-theme", dark);
          if (dark) document.documentElement.setAttribute("data-admin-theme", "dark");
          else document.documentElement.removeAttribute("data-admin-theme");
          btn.setAttribute("aria-pressed", dark ? "true" : "false");
          btn.textContent = dark ? "Light mode" : "Dark mode";
        };
        apply(document.documentElement.getAttribute("data-admin-theme") === "dark");
        btn.addEventListener("click", () => {
          const next = document.documentElement.getAttribute("data-admin-theme") !== "dark";
          try { localStorage.setItem(key, next ? "dark" : "light"); } catch (e) {}
          apply(next);
        });
      })();
    </script>`
  });
}

function sgtWhenFields(iso?: string): { date: string; hour: string; minute: string; period: "AM" | "PM" } {
  const fallback = { date: "", hour: "2", minute: "00", period: "PM" as const };
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || "";
  const minute = Number(get("minute"));
  const snapped = [0, 15, 30, 45].reduce((best, q) =>
    Math.abs(q - minute) < Math.abs(best - minute) ? q : best,
  );
  const period = get("dayPeriod").toUpperCase() === "PM" ? "PM" : "AM";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: String(Number(get("hour")) || 12).padStart(2, "0"),
    minute: String(snapped).padStart(2, "0"),
    period,
  };
}

function shortEventTitle(title: string): string {
  return title
    .replace(/^OFW Tambayan\s*[—–-]\s*/i, "")
    .replace(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi,
      (month) => month.slice(0, 1).toUpperCase() + month.slice(1, 3).toLowerCase(),
    )
    .trim();
}

function statusLabel(status: string, softClosed = false): string {
  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  return softClosed ? `${label} (soft-closed)` : label;
}

function statusBadge(event: EventRow): string {
  const softClosed = event.status === "open" && !isPubliclyOpen(event);
  return `<span class="status-pill status-${escapeHtml(event.status)}${softClosed ? " is-soft-closed" : ""}">${escapeHtml(statusLabel(event.status, softClosed))}</span>`;
}

export async function handleAdmin(request: Request, env: Env, path: string): Promise<Response> {
  if (path === "/admin/login") return handleLogin(request, env);
  const secureCookie = new URL(request.url).protocol === "https:";

  if (path === "/admin/logout" && request.method === "POST") {
    if (env.SESSION_SECRET) {
      const session = await readSession(request, env.SESSION_SECRET);
      if (session) {
        await recordAudit(env, {
          actor: session.email,
          action: "logout",
          summary: "Signed out",
        });
      }
    }
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
  if (path === "/admin/activity") return renderActivity(request, env);

  if (path === "/api/admin/registrations" && request.method === "GET") {
    return apiRegistrations(request, env);
  }
  if (path === "/api/admin/registrations" && request.method === "POST") {
    return apiAdminCreateRegistration(request, env, auth.email);
  }
  if (path === "/api/admin/events" && request.method === "POST") {
    return apiUpsertEvent(request, env, auth.email);
  }
  if (path === "/api/admin/events/status" && request.method === "POST") {
    return apiSetEventStatus(request, env, auth.email);
  }
  if (path === "/api/admin/gallery" && request.method === "POST") {
    return apiUploadGallery(request, env, auth.email);
  }
  if (path === "/api/admin/gallery" && request.method === "DELETE") {
    return apiDeleteGallery(request, env, auth.email);
  }
  if (path === "/api/admin/videos" && request.method === "POST") {
    return apiUpsertVideo(request, env, auth.email);
  }
  if (path === "/api/admin/videos" && request.method === "DELETE") {
    return apiDeleteVideo(request, env, auth.email);
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
    await recordAudit(env, { actor: user.email, action: "login", summary: "Signed in" });
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

async function renderActivity(request: Request, env: Env): Promise<Response> {
  const pageSize = 20;
  const requested = Number(new URL(request.url).searchParams.get("page") || "1");
  const total =
    (await env.DB.prepare(`SELECT COUNT(*) AS c FROM admin_audit`).first<{ c: number }>())?.c || 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number.isFinite(requested) ? requested : 1), pages);
  const rows = await env.DB.prepare(
    `SELECT created_at, actor, summary FROM admin_audit ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(pageSize, (page - 1) * pageSize)
    .all<{ created_at: string; actor: string; summary: string }>();
  const items =
    rows.results.length === 0
      ? `<li class="notice">No admin activity yet.</li>`
      : rows.results
          .map(
            (row) => `<li>
              <time datetime="${escapeHtml(row.created_at)}">${escapeHtml(auditWhen(row.created_at))}</time>
              <span><strong>${escapeHtml(row.actor)}</strong> ${escapeHtml(row.summary)}</span>
            </li>`,
          )
          .join("");
  const prev =
    page > 1
      ? `<a class="btn btn-ghost" href="/admin/activity?page=${page - 1}">Previous</a>`
      : `<button type="button" class="btn btn-ghost" disabled>Previous</button>`;
  const next =
    page < pages
      ? `<a class="btn btn-ghost" href="/admin/activity?page=${page + 1}">Next</a>`
      : `<button type="button" class="btn btn-ghost" disabled>Next</button>`;
  const body = `
    <header class="admin-pagehead">
      <h1>Activity</h1>
      <p>Sign-ins and changes by admins. Newest first.</p>
    </header>
    <section class="admin-panel admin-audit">
      <ul class="admin-audit-list">${items}</ul>
      <div class="reg-pager">
        <p class="reg-pager-size">${total} entr${total === 1 ? "y" : "ies"} · page ${page} of ${pages}</p>
        <div class="reg-pager-nav">${prev}${next}</div>
      </div>
    </section>`;
  return html(adminShell(env, request, "Activity", body, "activity"));
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
    <header class="admin-pagehead">
      <h1>Dashboard</h1>
      <p>Public registration follows the open event. Guests and gallery photos can be added for any event.</p>
    </header>
    <div class="admin-stats">
      ${
        open
          ? `<a class="admin-stat admin-stat-lead" href="/admin/registrations?event_id=${escapeHtml(open.id)}">
        <span>Open for public</span>
        <strong>${escapeHtml(open.title)}</strong>
        <em>${escapeHtml(formatEventWhen(open.held_at))}</em>
      </a>`
          : `<article class="admin-stat admin-stat-lead">
        <span>Open for public</span>
        <strong>None</strong>
        <em>No event is accepting public sign-up</em>
      </article>`
      }
      <article class="admin-stat">
        <span>Registrations</span>
        <strong>${count}</strong>
        <em>${open ? "On the open event" : "No open event"}</em>
      </article>
      <article class="admin-stat">
        <span>Events</span>
        <strong>${totalEvents}</strong>
        <em>Draft, Open, and Closed</em>
      </article>
    </div>
    <div class="admin-actions">
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
            return `<li>
            <div class="admin-event-main">
              <div class="admin-event-title">
                <strong>${escapeHtml(e.title)}</strong>
                ${statusBadge(e)}
              </div>
              <p class="admin-event-meta">${escapeHtml(formatEventWhen(e.held_at))}<br />${escapeHtml(e.address)}</p>
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

  const when = sgtWhenFields(editing?.held_at);
  const hourOptions = Array.from({ length: 12 }, (_, i) => {
    const hour = String(i + 1).padStart(2, "0");
    return `<option value="${hour}" ${when.hour === hour ? "selected" : ""}>${hour}</option>`;
  }).join("");
  const minuteOptions = ["00", "15", "30", "45"]
    .map((m) => `<option value="${m}" ${when.minute === m ? "selected" : ""}>${m}</option>`)
    .join("");
  const formTitle = editing ? "Edit event" : "Create event";
  const body = `
    <header class="admin-pagehead">
      <h1>Events</h1>
      <p>Only one event can be open for public sign-up. It soft-closes after the start time, and you can force close or reopen it here.</p>
    </header>
    <div class="admin-split">
      <section class="admin-panel">
        <h2>All events</h2>
        ${list}
      </section>
      <section class="admin-panel">
        <h2>${formTitle}</h2>
        <form class="form event-form" id="event-form">
          <input type="hidden" name="id" value="${escapeHtml(editing?.id || "")}" />
          <div class="admin-fields">
            <fieldset class="when-field is-wide">
              <legend>When <span>Singapore time</span></legend>
              <div class="when-grid">
                <label class="when-date"><span>Date</span>
                  <div class="date-pick">
                    <input type="hidden" name="held_date" value="${escapeHtml(when.date)}" />
                    <button type="button" class="date-pick-btn" aria-haspopup="dialog" aria-expanded="false">${when.date ? escapeHtml(when.date) : "Choose a date"}</button>
                    <div class="date-pop" hidden role="dialog" aria-label="Choose a date">
                      <div class="date-pop-head">
                        <button type="button" data-cal="prev" aria-label="Previous month">‹</button>
                        <strong data-cal="label"></strong>
                        <button type="button" data-cal="next" aria-label="Next month">›</button>
                      </div>
                      <div class="date-pop-week" aria-hidden="true"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
                      <div class="date-pop-grid" data-cal="grid"></div>
                    </div>
                  </div>
                </label>
                <label><span>Hour</span><select name="held_hour">${hourOptions}</select></label>
                <label><span>Minutes</span><select name="held_minute">${minuteOptions}</select></label>
                <label><span>Period</span>
                  <select name="held_period">
                    <option value="AM" ${when.period === "AM" ? "selected" : ""}>AM</option>
                    <option value="PM" ${when.period === "PM" ? "selected" : ""}>PM</option>
                  </select>
                </label>
              </div>
            </fieldset>
            <label><span>Status</span>
              <select name="status">
                ${(["draft", "open", "closed"] as EventStatus[])
                  .map((s) => {
                    return `<option value="${s}" ${(editing?.status || "draft") === s ? "selected" : ""}>${statusLabel(s)}</option>`;
                  })
                  .join("")}
              </select>
            </label>
            <label class="is-wide"><span>Venue</span><input name="address" required maxlength="300" value="${escapeHtml(editing?.address || DEFAULT_VENUE)}" /></label>
            <label class="is-wide"><span>Announcement title <em>optional</em></span><input name="announcement_title" maxlength="200" value="${escapeHtml(editing?.announcement_title || "")}" /></label>
            <label class="is-wide"><span>Announcement</span><textarea name="announcement_body" rows="4" maxlength="2000">${escapeHtml(editing?.announcement_body || "")}</textarea></label>
          </div>
          <div class="admin-form-actions">
            <button class="btn btn-primary" type="submit">${editing ? "Save event" : "Create event"}</button>
            ${editing ? `<a class="btn btn-ghost" href="/admin/events">Cancel</a>` : ""}
          </div>
          <p id="event-status" class="form-status" role="status"></p>
        </form>
      </section>
    </div>
    <script src="/admin/events.js" defer></script>`;

  return html(adminShell(env, request, "Events", body, "events"));
}

async function apiUpsertEvent(request: Request, env: Env, actor: string): Promise<Response> {
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

  await recordAudit(env, {
    actor,
    action: existing ? "event.update" : "event.create",
    targetId: id,
    summary: existing ? `Updated event ${title}` : `Created event ${title}`,
  });

  return json({ ok: true, id, slug, status });
}

async function apiSetEventStatus(request: Request, env: Env, actor: string): Promise<Response> {
  const body = (await request.json()) as { id?: string; status?: string };
  const id = String(body.id || "").trim();
  const statusRaw = String(body.status || "").toLowerCase();
  if (!id) return json({ error: "id required" }, 400);
  if (statusRaw !== "open" && statusRaw !== "closed" && statusRaw !== "draft") {
    return json({ error: "Status must be Draft, Open, or Closed." }, 400);
  }
  const event = await env.DB.prepare(`SELECT id, title FROM events WHERE id = ?`)
    .bind(id)
    .first<{ id: string; title: string }>();
  if (!event) return json({ error: "event not found" }, 404);

  await env.DB.prepare(`UPDATE events SET status = ? WHERE id = ?`).bind(statusRaw, id).run();
  if (statusRaw === "open") {
    await enforceSingleOpen(env.DB, id);
  }
  const label = statusLabel(statusRaw);
  await recordAudit(env, {
    actor,
    action: "event.status",
    targetId: id,
    summary: `Set ${event.title} to ${label}`,
  });
  return json({ ok: true, id, status: statusRaw });
}

async function renderRegistrations(request: Request, env: Env): Promise<Response> {
  const events = await env.DB.prepare("SELECT * FROM events ORDER BY held_at DESC").all<EventRow>();
  const open = await getOpenEvent(env.DB);
  const requested = new URL(request.url).searchParams.get("event_id") || "";
  const requestedOk = events.results.some((e) => e.id === requested);
  const defaultEvent = (requestedOk ? requested : "") || open?.id || events.results[0]?.id || "";

  const eventOptions = events.results
    .map(
      (e) =>
        `<option value="${escapeHtml(e.id)}" ${e.id === defaultEvent ? "selected" : ""}>${escapeHtml(shortEventTitle(e.title))} · ${escapeHtml(statusLabel(e.status))}</option>`,
    )
    .join("");

  const body = `
    <div class="reg-layout">
    <div class="reg-layout-bar">
      <header class="admin-pagehead">
        <h1>Registrations</h1>
        <p>Filter the guest list, export it, or add a walk-in. A mobile number is optional.</p>
      </header>
      <button type="button" class="btn btn-primary" id="add-guest-open">Add guest</button>
    </div>
    <section class="admin-panel reg-board">
      <div class="reg-filters">
        <label>Event
          <select id="event-filter">
            <option value="">All events</option>
            ${eventOptions}
          </select>
        </label>
        <label>Search
          <input id="reg-search" type="search" placeholder="Name, email, or mobile" />
        </label>
        <div class="reg-exports">
          <button type="button" class="btn btn-ghost" id="export-xlsx">Export Excel</button>
          <button type="button" class="btn btn-ghost" id="export-pdf">Export PDF</button>
        </div>
      </div>
      <p id="page-info" class="reg-count">Loading…</p>
      <div class="table-wrap">
        <table id="reg-table">
          <thead>
            <tr>
              <th class="reg-num" scope="col"><span class="visually-hidden">Number</span></th>
              <th aria-sort="none"><button type="button" class="th-sort" data-sort="name">Name</button></th>
              <th aria-sort="none"><button type="button" class="th-sort" data-sort="email">Email</button></th>
              <th aria-sort="none"><button type="button" class="th-sort" data-sort="mobile">Mobile</button></th>
              <th aria-sort="none"><button type="button" class="th-sort" data-sort="event">Event</button></th>
              <th aria-sort="none"><button type="button" class="th-sort" data-sort="source">Source</button></th>
              <th aria-sort="descending"><button type="button" class="th-sort is-active" data-sort="created_at" data-dir="desc">Registered</button></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="reg-pager">
        <label class="reg-pager-size">Show
          <select id="page-size">
            <option value="10">10</option>
            <option value="20" selected>20</option>
            <option value="30">30</option>
            <option value="50">50</option>
          </select>
        </label>
        <div class="reg-pager-nav">
          <button type="button" class="btn btn-ghost" id="prev-page">Previous</button>
          <button type="button" class="btn btn-ghost" id="next-page">Next</button>
        </div>
      </div>
    </section>
    </div>
    <div class="reg-modal" id="guest-modal" hidden>
      <button type="button" class="reg-modal-backdrop" data-close-modal aria-label="Close"></button>
      <div class="reg-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-modal-title">
        <div class="reg-modal-head">
          <h2 id="guest-modal-title">Add a guest</h2>
          <button type="button" class="reg-modal-close" data-close-modal aria-label="Close">Close</button>
        </div>
        <p class="reg-modal-note">Works for Draft, Open, and Closed events. Mobile is optional.</p>
        <form class="form" id="admin-reg-form">
          <div class="reg-form-grid">
            <label class="is-wide">Event
              <select name="event_id" required>${eventOptions}</select>
            </label>
            <label class="is-wide"><span>Name</span><input name="name" required maxlength="120" autocomplete="name" /></label>
            <label><span>Email <em>optional</em></span><input name="email" type="email" maxlength="200" autocomplete="email" /></label>
            <label><span>Mobile <em>optional</em></span><input name="mobile" maxlength="20" inputmode="tel" autocomplete="tel" placeholder="+65…" /></label>
          </div>
          <div class="admin-form-actions">
            <button class="btn btn-primary" type="submit">Save guest</button>
            <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          </div>
          <p id="admin-reg-status" class="form-status" role="status"></p>
        </form>
      </div>
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
  const requestedSize = Number(url.searchParams.get("page_size") || "20");
  const pageSize = [10, 20, 30, 50].includes(requestedSize) ? requestedSize : 20;

  const [sortCol, sortDirRaw] = sort.split(":");
  const sortColumns: Record<string, string> = {
    created_at: "r.created_at",
    name: "r.name",
    email: "r.email",
    mobile: "r.mobile",
    source: "r.source",
    event: "e.title",
  };
  const col = sortColumns[sortCol] || "r.created_at";
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

  const countSql = `SELECT COUNT(*) AS c FROM (${sql}) AS counted`;
  const total =
    (await env.DB.prepare(countSql)
      .bind(...binds)
      .first<{ c: number }>())?.c || 0;

  sql += ` ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`;
  const rows = await env.DB.prepare(sql)
    .bind(...binds, pageSize, (page - 1) * pageSize)
    .all<RegistrationRow & { event_title: string; event_slug: string }>();

  return json({
    total,
    page,
    page_size: pageSize,
    rows: rows.results.map((row) => ({
      ...row,
      event_title: shortEventTitle(row.event_title),
    })),
  });
}

async function apiAdminCreateRegistration(request: Request, env: Env, actor: string): Promise<Response> {
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
  const mobileNorm = mobile ? normalizeMobile(mobile) : "";
  if (mobile && !mobileNorm) return json({ error: "Enter a valid mobile number." }, 400);

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

  await recordAudit(env, {
    actor,
    action: "guest.add",
    targetId: id,
    summary: `Added guest ${name} to ${shortEventTitle(event.title)}`,
  });

  return json({ ok: true, id, event: { id: event.id, title: event.title } });
}

async function handleAdminGallery(request: Request, env: Env): Promise<Response> {
  const events = await env.DB.prepare("SELECT * FROM events ORDER BY held_at DESC").all<EventRow>();
  const selected = new URL(request.url).searchParams.get("event_id") || events.results[0]?.id || "";
  let photoCount = 0;
  let imagesHtml = "<p class=\"notice\">Create an event first, then upload photos anytime.</p>";
  if (selected) {
    const images = await env.DB.prepare(
      `SELECT * FROM gallery_images WHERE event_id = ? ORDER BY sort_order, created_at`,
    )
      .bind(selected)
      .all();
    photoCount = images.results.length;
    imagesHtml =
      images.results.length === 0
        ? `<p class="notice">No photos yet for this event. Upload anytime — registration status does not matter.</p>`
        : `<ul class="admin-photo-list">
          ${images.results
            .map((img: Record<string, unknown>) => {
              const key = String(img.r2_key);
              const id = String(img.id);
              const caption = String(img.caption || "").trim();
              return `<li>
                <img src="/api/media/${encodeURIComponent(key)}" alt="" />
                <div class="admin-photo-meta">
                  <span>${escapeHtml(caption || "Untitled")}</span>
                  <button type="button" class="btn btn-ghost btn-danger" data-delete-image="${escapeHtml(id)}">Delete</button>
                </div>
              </li>`;
            })
            .join("")}
        </ul>`;
  }

  const remaining = Math.max(0, GALLERY_MAX_PER_EVENT - photoCount);
  const atCap = remaining === 0;
  const nearLimit = !atCap && remaining <= GALLERY_WARN_REMAINING;
  const limitNote = !selected
    ? ""
    : atCap
      ? `<p class="notice gallery-limit-warn" role="status">This event is at the ${GALLERY_MAX_PER_EVENT}-photo limit. Delete some photos before uploading more.</p>`
      : nearLimit
        ? `<p class="notice gallery-limit-warn" role="status">Near the limit: ${photoCount} of ${GALLERY_MAX_PER_EVENT} photos used, ${remaining} left.</p>`
        : `<p class="gallery-limit-meta">${photoCount} of ${GALLERY_MAX_PER_EVENT} photos</p>`;

  const body = `
    <header class="admin-pagehead">
      <h1>Gallery</h1>
      <p>Photos belong to an event. You can upload as soon as the event exists, whether it is Draft, Open, or Closed.</p>
    </header>
    <section class="admin-panel gallery-upload">
      <h2>Add photos</h2>
      ${limitNote}
      <form class="form gallery-upload-form" id="gallery-form"
        data-max-file-bytes="${GALLERY_MAX_FILE_BYTES}"
        data-max-batch="${GALLERY_MAX_BATCH}"
        data-max-per-event="${GALLERY_MAX_PER_EVENT}"
        data-photo-count="${photoCount}"
        data-remaining="${remaining}">
        <label><span>Event</span>
          <select name="event_id" id="gallery-event" required>
            ${events.results
              .map(
                (e) =>
                  `<option value="${escapeHtml(e.id)}" ${e.id === selected ? "selected" : ""}>${escapeHtml(shortEventTitle(e.title))}</option>`,
              )
              .join("")}
          </select>
        </label>
        <label><span>Caption <em>optional</em></span>
          <input name="caption" maxlength="200" placeholder="A short note" ${atCap ? "disabled" : ""} />
        </label>
        <div class="gallery-file${atCap ? " is-disabled" : ""}">
          <span class="gallery-file-label">Photos</span>
          <div class="gallery-file-row">
            <label class="file-pick" for="gallery-files">
              <input id="gallery-files" name="file" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple ${atCap ? "disabled" : "required"} />
              <span id="gallery-file-name">${atCap ? "Event is full" : "Choose photos"}</span>
            </label>
            <button class="btn btn-primary" type="submit" ${atCap ? "disabled" : ""}>Upload</button>
          </div>
          <p class="field-hint">JPEG, PNG, or WebP · 5 MB each · up to ${GALLERY_MAX_BATCH} at a time · ${GALLERY_MAX_PER_EVENT} per event. One caption applies to the whole batch.</p>
        </div>
        <p id="gallery-status" class="form-status" role="status"></p>
      </form>
    </section>
    <section class="admin-panel">
      <h2>Photos</h2>
      <div id="gallery-list">${imagesHtml}</div>
    </section>
    <script src="/admin/gallery.js" defer></script>`;

  return html(adminShell(env, request, "Gallery", body, "gallery"));
}

async function apiUploadGallery(request: Request, env: Env, actor: string): Promise<Response> {
  const form = await request.formData();
  const eventId = String(form.get("event_id") || "");
  const caption = String(form.get("caption") || "").trim() || null;
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);

  if (!eventId) return json({ error: "Choose an event before uploading." }, 400);
  if (files.length === 0) return json({ error: "Choose at least one photo to upload." }, 400);
  if (files.length > GALLERY_MAX_BATCH) {
    return json(
      { error: `Too many files in one upload. Select at most ${GALLERY_MAX_BATCH} images at a time.` },
      400,
    );
  }

  const event = await env.DB.prepare("SELECT id, slug, title FROM events WHERE id = ?")
    .bind(eventId)
    .first<{ id: string; slug: string; title: string }>();
  if (!event) return json({ error: "Event not found." }, 404);

  const existing =
    (
      await env.DB.prepare(`SELECT COUNT(*) AS c FROM gallery_images WHERE event_id = ?`)
        .bind(eventId)
        .first<{ c: number }>()
    )?.c ?? 0;

  if (existing >= GALLERY_MAX_PER_EVENT) {
    return json(
      {
        error: `This event already has ${GALLERY_MAX_PER_EVENT} photos (the maximum). Delete some before uploading more.`,
      },
      400,
    );
  }
  if (existing + files.length > GALLERY_MAX_PER_EVENT) {
    const room = GALLERY_MAX_PER_EVENT - existing;
    return json(
      {
        error: `Only ${room} photo slot${room === 1 ? "" : "s"} left for this event (max ${GALLERY_MAX_PER_EVENT}). You selected ${files.length}.`,
      },
      400,
    );
  }

  for (const file of files) {
    const ext = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const mimeOk = GALLERY_ALLOWED_MIME.has(file.type);
    const extOk = GALLERY_ALLOWED_EXT.has(ext);
    if (!mimeOk && !extOk) {
      return json({ error: `"${file.name}" is not an allowed type. Use JPEG, PNG, or WebP only.` }, 400);
    }
    if (file.size > GALLERY_MAX_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return json({ error: `"${file.name}" is ${mb} MB. Each photo must be 5 MB or smaller.` }, 400);
    }
  }

  let maxSort =
    (
      await env.DB.prepare(
        `SELECT COALESCE(MAX(sort_order), -1) AS m FROM gallery_images WHERE event_id = ?`,
      )
        .bind(eventId)
        .first<{ m: number }>()
    )?.m ?? -1;

  const uploaded: { id: string; key: string }[] = [];
  for (const file of files) {
    const rawExt = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const ext = GALLERY_ALLOWED_EXT.has(rawExt)
      ? rawExt === "jpeg"
        ? "jpg"
        : rawExt
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const contentType =
      file.type && GALLERY_ALLOWED_MIME.has(file.type)
        ? file.type
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg";

    const id = crypto.randomUUID();
    const key = `gallery/${event.slug}/${id}.${ext}`;
    await env.GALLERY.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType },
    });
    maxSort += 1;
    await env.DB.prepare(
      `INSERT INTO gallery_images (id, event_id, r2_key, sort_order, caption) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(id, eventId, key, maxSort, caption)
      .run();
    uploaded.push({ id, key });
  }

  if (uploaded[0]) {
    await env.DB.prepare(
      `UPDATE events SET cover_image_key = COALESCE(cover_image_key, ?) WHERE id = ?`,
    )
      .bind(uploaded[0].key, eventId)
      .run();
  }

  const count = uploaded.length;
  await recordAudit(env, {
    actor,
    action: "gallery.upload",
    targetId: eventId,
    summary:
      count === 1
        ? `Uploaded 1 photo to ${shortEventTitle(event.title)}`
        : `Uploaded ${count} photos to ${shortEventTitle(event.title)}`,
  });

  return json({
    ok: true,
    count,
    ids: uploaded.map((u) => u.id),
    keys: uploaded.map((u) => u.key),
    photo_count: existing + count,
  });
}

async function apiDeleteGallery(request: Request, env: Env, actor: string): Promise<Response> {
  const body = (await request.json()) as { id?: string };
  if (!body.id) return json({ error: "id required" }, 400);
  const row = await env.DB.prepare(`SELECT * FROM gallery_images WHERE id = ?`)
    .bind(body.id)
    .first<{ id: string; r2_key: string; event_id: string }>();
  if (!row) return json({ error: "not found" }, 404);
  const event = await env.DB.prepare(`SELECT title FROM events WHERE id = ?`)
    .bind(row.event_id)
    .first<{ title: string }>();
  await env.GALLERY.delete(row.r2_key);
  await env.DB.prepare(`DELETE FROM gallery_images WHERE id = ?`).bind(row.id).run();
  await recordAudit(env, {
    actor,
    action: "gallery.delete",
    targetId: row.id,
    summary: event ? `Deleted a photo from ${shortEventTitle(event.title)}` : "Deleted a gallery photo",
  });
  return json({ ok: true });
}

async function handleAdminVideos(request: Request, env: Env): Promise<Response> {
  const videos = await env.DB.prepare(
    `SELECT * FROM videos ORDER BY sort_order ASC, published_at DESC`,
  ).all<VideoRow>();

  const body = `
    <header class="admin-pagehead">
      <h1>Shorts</h1>
      <p>Add a YouTube or Shorts link. It shows on the public Shorts page in sort order.</p>
    </header>
    <div class="admin-split is-form-aside">
    <section class="admin-panel">
    <h2>Add a short</h2>
    <form class="form" id="video-form">
      <input type="hidden" name="id" value="" />
      <div class="admin-fields">
        <label class="is-wide"><span>Title</span><input name="title" required maxlength="200" /></label>
        <label class="is-wide"><span>YouTube URL</span><input name="youtube_url" required placeholder="https://www.youtube.com/shorts/…" /></label>
        <label><span>Sort order</span><input name="sort_order" type="number" value="0" /></label>
      </div>
      <div class="admin-form-actions">
        <button class="btn btn-primary" type="submit">Save video</button>
      </div>
      <p id="video-status" class="form-status" role="status"></p>
    </form>
    </section>
    <section class="admin-panel">
    <h2>Published</h2>
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
    </section>
    </div>
    <script src="/admin/videos.js" defer></script>`;

  return html(adminShell(env, request, "Videos", body, "videos"));
}

async function apiUpsertVideo(request: Request, env: Env, actor: string): Promise<Response> {
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
  await recordAudit(env, {
    actor,
    action: body.id ? "video.update" : "video.create",
    targetId: id,
    summary: body.id ? `Updated short ${title}` : `Added short ${title}`,
  });
  return json({ ok: true, id });
}

async function apiDeleteVideo(request: Request, env: Env, actor: string): Promise<Response> {
  const body = (await request.json()) as { id?: string };
  if (!body.id) return json({ error: "id required" }, 400);
  const video = await env.DB.prepare(`SELECT id, title FROM videos WHERE id = ?`)
    .bind(body.id)
    .first<{ id: string; title: string }>();
  if (!video) return json({ error: "not found" }, 404);
  await env.DB.prepare(`DELETE FROM videos WHERE id = ?`).bind(body.id).run();
  await recordAudit(env, {
    actor,
    action: "video.delete",
    targetId: video.id,
    summary: `Deleted short ${video.title}`,
  });
  return json({ ok: true });
}
