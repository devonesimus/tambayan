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
  youtubeThumb,
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

const menuIconPaths: Record<string, string> = {
  dashboard: `<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>`,
  events: `<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>`,
  registrations: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.7 2.6 3 5.2"/>`,
  gallery: `<rect x="3" y="3.5" width="18" height="17" rx="2"/><circle cx="8.5" cy="9" r="1.8"/><path d="m21 15.5-5-5-9.5 10"/>`,
  videos: `<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="m10 9 5 3-5 3z"/>`,
  activity: `<path d="M3 12h4l2.5-6.5 5 13L17 12h4"/>`,
  password: `<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>`,
  site: `<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>`,
  theme: `<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>`,
  add: `<path d="M12 5v14M5 12h14"/>`,
  upload: `<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19.5h14"/>`,
  trash: `<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.1a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>`,
  arrow: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  account: `<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.9-3.9 3.8-6.2 7.5-6.2s6.6 2.3 7.5 6.2"/>`,
  logout: `<path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9M15 7.5l4.5 4.5-4.5 4.5M19.5 12H9"/>`,
};

/** Small line icons shown beside admin menu items on phones. */
function menuIcon(name: string): string {
  return `<svg class="admin-menu-glyph" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${menuIconPaths[name] || ""}</svg>`;
}

/** Drop the scheme and "www." so a link reads cleanly in a list. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
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
        `<a href="${href}" class="${active === id ? "is-active" : ""}"${active === id ? ` aria-current="page"` : ""}>${menuIcon(id)}${label}</a>`,
    )
    .join("");

  return layout({
    env,
    request,
    title: `${title} · Admin`,
    active: "admin",
    headerEnd: `<div class="admin-head">
        <button type="button" class="admin-menu" id="admin-menu" aria-expanded="false" aria-controls="admin-menu-panel">
          <span class="admin-menu-icon" aria-hidden="true"></span>
          <span class="admin-menu-label">Menu</span>
        </button>
        <div class="admin-menu-panel" id="admin-menu-panel">
          <nav class="admin-nav" aria-label="Admin">${nav}</nav>
          <div class="admin-bar-actions">
            <button type="button" class="theme-toggle" id="admin-theme" aria-pressed="false" title="Dark mode">${menuIcon("theme")}<span class="theme-toggle-label">Dark mode</span><span class="theme-switch" aria-hidden="true"></span></button>
            <div class="admin-account">
              <button type="button" class="admin-account-btn${active === "activity" || active === "password" ? " is-active" : ""}" id="admin-account" aria-expanded="false" aria-controls="admin-account-menu">${menuIcon("account")}<span>Account</span></button>
              <div class="admin-account-menu" id="admin-account-menu">
                <p class="admin-menu-heading">Account</p>
                <a class="admin-site-link${active === "activity" ? " is-active" : ""}" href="/admin/activity">${menuIcon("activity")}Activity</a>
                <a class="admin-site-link${active === "password" ? " is-active" : ""}" href="/admin/password">${menuIcon("password")}Password</a>
                <a class="admin-site-link" href="/">${menuIcon("site")}View site</a>
                <form method="post" action="/admin/logout"><button class="btn btn-ghost admin-logout" type="submit">${menuIcon("logout")}Log out</button></form>
              </div>
            </div>
          </div>
        </div>
      </div>`,
    body: `<section class="admin">
      <div class="admin-scrim" id="admin-scrim" aria-hidden="true"></div>
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
        };
        apply(document.documentElement.getAttribute("data-admin-theme") === "dark");
        btn.addEventListener("click", () => {
          const next = document.documentElement.getAttribute("data-admin-theme") !== "dark";
          try { localStorage.setItem(key, next ? "dark" : "light"); } catch (e) {}
          apply(next);
        });
      })();
      (() => {
        const menu = document.getElementById("admin-menu");
        const label = menu && menu.querySelector(".admin-menu-label");
        if (!menu) return;
        const place = () => {
          const header = document.querySelector(".site-header");
          if (!header) return;
          document.documentElement.style.setProperty(
            "--admin-menu-top",
            header.getBoundingClientRect().bottom + "px",
          );
        };
        const set = (open) => {
          document.body.classList.toggle("admin-menu-open", open);
          menu.setAttribute("aria-expanded", open ? "true" : "false");
          if (label) label.textContent = open ? "Close" : "Menu";
          if (open) place();
        };
        const isOpen = () => document.body.classList.contains("admin-menu-open");
        menu.addEventListener("click", () => set(!isOpen()));
        document.getElementById("admin-scrim")?.addEventListener("click", () => set(false));
        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape" || !isOpen()) return;
          set(false);
          menu.focus();
        });
        const account = document.getElementById("admin-account");
        const accountWrap = account && account.closest(".admin-account");
        const setAccount = (open) => {
          if (!account || !accountWrap) return;
          accountWrap.classList.toggle("is-open", open);
          account.setAttribute("aria-expanded", open ? "true" : "false");
        };
        account?.addEventListener("click", () => setAccount(!accountWrap?.classList.contains("is-open")));
        document.addEventListener("click", (event) => {
          if (accountWrap && event.target instanceof Node && !accountWrap.contains(event.target)) setAccount(false);
        });
        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape" || !accountWrap?.classList.contains("is-open")) return;
          setAccount(false);
          account?.focus();
        });
        const wide = window.matchMedia("(min-width: 721px)");
        wide.addEventListener("change", () => {
          set(false);
          setAccount(false);
        });
        window.addEventListener("resize", () => {
          if (isOpen()) place();
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

  const mustChange = await passwordChangeRequired(env, auth.email);
  if (mustChange && path !== "/admin/password") {
    return new Response(null, { status: 302, headers: { Location: "/admin/password" } });
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
  if (path === "/admin/password") return handlePassword(request, env, auth.email);

  if (path === "/api/admin/registrations" && request.method === "GET") {
    return apiRegistrations(request, env);
  }
  if (path === "/api/admin/registrations" && request.method === "POST") {
    return apiAdminCreateRegistration(request, env, auth.email);
  }
  if (path === "/api/admin/registrations/update" && request.method === "POST") {
    return apiAdminUpdateRegistration(request, env, auth.email);
  }
  if (path === "/api/admin/registrations/attendance" && request.method === "POST") {
    return apiAdminSetAttendance(request, env, auth.email);
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
    const user = await env.DB.prepare(
      "SELECT email, password_hash, must_change_password FROM admin_users WHERE email = ?",
    )
      .bind(email)
      .first<{ email: string; password_hash: string; must_change_password: number }>();

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
    const next = user.must_change_password ? "/admin/password" : "/admin";
    return new Response(null, {
      status: 302,
      headers: { Location: next, "Set-Cookie": cookie },
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

async function passwordChangeRequired(env: Env, email: string): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT must_change_password FROM admin_users WHERE email = ?`)
    .bind(email)
    .first<{ must_change_password: number }>();
  return row?.must_change_password === 1;
}

function passwordForm(
  email: string,
  hints: { current?: string; next?: string; confirm?: string } = {},
  ok = false,
  required = false,
): string {
  const hint = (field: "current" | "next" | "confirm") =>
    hints[field] ? `<span class="field-hint">${escapeHtml(hints[field])}</span>` : "";
  const lede = required
    ? `Choose a new password for ${escapeHtml(email)} before the rest of the admin opens.`
    : `Update the password for ${escapeHtml(email)}. You stay signed in on this browser.`;
  return `
    <header class="admin-pagehead">
      <h1>Password</h1>
      <p>${lede}</p>
    </header>
    <section class="admin-panel password-panel">
      <form class="form" method="post" action="/admin/password">
        <label>
          <span class="field-label">Current password ${hint("current")}</span>
          <input name="current" type="password" autocomplete="current-password" required />
        </label>
        <label>
          <span class="field-label">New password ${hint("next")}</span>
          <input name="next" type="password" autocomplete="new-password" required minlength="10" />
        </label>
        <label>
          <span class="field-label">Confirm new password ${hint("confirm")}</span>
          <input name="confirm" type="password" autocomplete="new-password" required minlength="10" />
        </label>
        <div class="admin-form-actions">
          <button class="btn btn-primary" type="submit">Update password</button>
        </div>
        ${ok ? `<p class="form-status" role="status">Password updated.</p>` : ""}
      </form>
    </section>`;
}

async function handlePassword(request: Request, env: Env, email: string): Promise<Response> {
  if (request.method === "POST") {
    const form = await request.formData();
    const current = String(form.get("current") || "");
    const next = String(form.get("next") || "");
    const confirm = String(form.get("confirm") || "");
    const hints: { current?: string; next?: string; confirm?: string } = {};

    const user = await env.DB.prepare(`SELECT email, password_hash FROM admin_users WHERE email = ?`)
      .bind(email)
      .first<{ email: string; password_hash: string }>();
    if (!user || !(await verifyPassword(current, user.password_hash))) {
      hints.current = "That password doesn’t match";
    }
    if (next.length < 10) hints.next = "Use at least 10 characters";
    else if (current && next === current) hints.next = "Choose a different password";
    if (next !== confirm) hints.confirm = "Doesn’t match the new password";

    const required = await passwordChangeRequired(env, email);
    if (Object.keys(hints).length === 0 && user) {
      const hash = await hashPassword(next);
      await env.DB.prepare(
        `UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE email = ?`,
      )
        .bind(hash, user.email)
        .run();
      await recordAudit(env, {
        actor: user.email,
        action: "password.change",
        summary: "Changed password",
      });
      if (required) {
        return new Response(null, { status: 302, headers: { Location: "/admin" } });
      }
      return html(adminShell(env, request, "Password", passwordForm(email, {}, true), "password"));
    }

    return html(
      adminShell(env, request, "Password", passwordForm(email, hints, false, required), "password"),
      400,
    );
  }

  const required = await passwordChangeRequired(env, email);
  return html(adminShell(env, request, "Password", passwordForm(email, {}, false, required), "password"));
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

  const recent = await env.DB.prepare(
    `SELECT created_at, actor, summary FROM admin_audit ORDER BY created_at DESC LIMIT 5`,
  ).all<{ created_at: string; actor: string; summary: string }>();
  const regHref = open
    ? `/admin/registrations?event_id=${encodeURIComponent(open.id)}`
    : "/admin/registrations";
  const galleryHref = open ? `/admin/gallery?event_id=${encodeURIComponent(open.id)}` : "/admin/gallery";
  const quick = [
    ["add", `${regHref}${open ? "&" : "?"}add=1`, "Add a walk-in", "Guest at the door"],
    ["upload", galleryHref, "Upload photos", open ? `For ${shortEventTitle(open.title)}` : "Pick an event first"],
    ["videos", "/admin/videos", "Add a short", "YouTube or Shorts link"],
    ["site", "/register", "Registration page", "See what guests see"],
  ]
    .map(
      ([icon, href, label, hint]) =>
        `<a class="admin-quick" href="${escapeHtml(href)}"${href === "/register" ? ` target="_blank" rel="noopener"` : ""}>
          <span class="admin-quick-icon">${menuIcon(icon)}</span>
          <span class="admin-quick-text"><strong>${escapeHtml(label)}</strong><em>${escapeHtml(hint)}</em></span>
        </a>`,
    )
    .join("");
  const activity =
    recent.results.length === 0
      ? `<li class="admin-audit-empty">No admin activity yet.</li>`
      : recent.results
          .map(
            (row) => `<li>
              <time datetime="${escapeHtml(row.created_at)}">${escapeHtml(auditWhen(row.created_at))}</time>
              <span><strong>${escapeHtml(row.actor)}</strong> ${escapeHtml(row.summary)}</span>
            </li>`,
          )
          .join("");

  const body = `
    <header class="admin-pagehead">
      <h1>Dashboard</h1>
      <p>Public registration follows the open event. Guests and gallery photos can be added for any event.</p>
    </header>
    <div class="admin-stats">
      ${
        open
          ? `<a class="admin-stat admin-stat-lead" href="/admin/events?id=${escapeHtml(open.id)}">
        <span>Open for public ${statusBadge(open)}</span>
        <strong>${escapeHtml(open.title)}</strong>
        <em>${escapeHtml(formatEventWhen(open.held_at))}</em>
      </a>`
          : `<a class="admin-stat admin-stat-lead" href="/admin/events">
        <span>Open for public</span>
        <strong>None</strong>
        <em>No event is accepting public sign-up</em>
      </a>`
      }
      <a class="admin-stat" href="${escapeHtml(regHref)}">
        <span>Registrations</span>
        <strong>${count}</strong>
        <em>${open ? "On the open event" : "No open event"}</em>
      </a>
      <a class="admin-stat" href="/admin/events">
        <span>Events</span>
        <strong>${totalEvents}</strong>
        <em>Draft, Open, and Closed</em>
      </a>
    </div>
    <section class="admin-dash-section" aria-labelledby="quick-title">
      <h2 id="quick-title" class="admin-section-title">Quick actions</h2>
      <div class="admin-quick-grid">${quick}</div>
    </section>
    <section class="admin-panel admin-dash-activity" aria-labelledby="recent-title">
      <div class="admin-panel-head">
        <h2 id="recent-title">Recent activity</h2>
        <a class="admin-panel-link" href="/admin/activity">View all</a>
      </div>
      <ul class="admin-audit-list">${activity}</ul>
    </section>`;

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
            return `<li${e.id === editing?.id ? ` class="is-editing" aria-current="true"` : ""}>
            <div class="admin-event-main">
              <div class="admin-event-title">
                <strong>${escapeHtml(e.title)}</strong>
                ${statusBadge(e)}
              </div>
              <p class="admin-event-meta"><span>${escapeHtml(formatEventWhen(e.held_at))}</span><span>${escapeHtml(e.address)}</span></p>
            </div>
            <div class="admin-row-actions">
              <a class="btn btn-ghost btn-sm" href="/admin/events?id=${escapeHtml(e.id)}#event-form">${e.id === editing?.id ? "Editing" : "Edit"}</a>
              ${
                e.status === "open"
                  ? `<button type="button" class="btn btn-ghost btn-sm" data-status="${escapeHtml(e.id)}" data-to="closed">Force close</button>`
                  : e.status === "closed"
                    ? `<button type="button" class="btn btn-ghost btn-sm" data-status="${escapeHtml(e.id)}" data-to="open">Reopen</button>`
                    : `<button type="button" class="btn btn-ghost btn-sm" data-status="${escapeHtml(e.id)}" data-to="open">Open</button>
                       <button type="button" class="btn btn-ghost btn-sm" data-status="${escapeHtml(e.id)}" data-to="closed">Close</button>`
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
        <div class="admin-panel-head">
          <h2>All events</h2>
          <a class="btn btn-primary btn-sm" href="/admin/events#event-form">${menuIcon("add")}New event</a>
        </div>
        ${list}
      </section>
      <section class="admin-panel${editing ? " is-editing" : ""}" id="event-form-panel">
        <h2>${formTitle}</h2>
        <form class="form event-form" id="event-form" tabindex="-1">
          <input type="hidden" name="id" value="${escapeHtml(editing?.id || "")}" />
          <fieldset class="ef-group">
            <legend class="visually-hidden">When</legend>
            <div class="ef-field">
              <span class="ef-label" id="event-date-label">Date</span>
              <div class="date-pick">
                <input type="hidden" name="held_date" value="${escapeHtml(when.date)}" />
                <button type="button" class="date-pick-btn" aria-haspopup="dialog" aria-expanded="false" aria-labelledby="event-date-label">${when.date ? escapeHtml(when.date) : "Choose a date"}</button>
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
              <p class="ef-hint" id="event-title-preview" aria-live="polite">${editing ? `Listed as “${escapeHtml(editing.title)}”` : "The event name comes from the month you pick."}</p>
            </div>
            <div class="ef-field">
              <span class="ef-label">Time <em>Singapore</em></span>
              <div class="time-row">
                <select name="held_hour" aria-label="Hour">${hourOptions}</select>
                <span class="time-sep" aria-hidden="true">:</span>
                <select name="held_minute" aria-label="Minutes">${minuteOptions}</select>
                <div class="segmented segmented--sm" role="radiogroup" aria-label="AM or PM">
                  ${(["AM", "PM"] as const)
                    .map(
                      (p) =>
                        `<label><input type="radio" name="held_period" value="${p}" ${when.period === p ? "checked" : ""} /><span>${p}</span></label>`,
                    )
                    .join("")}
                </div>
              </div>
            </div>
          </fieldset>
          <fieldset class="ef-group">
            <legend class="ef-label">Status</legend>
            <div class="segmented" role="radiogroup" aria-describedby="event-status-hint">
              ${(["draft", "open", "closed"] as EventStatus[])
                .map(
                  (st) =>
                    `<label><input type="radio" name="status" value="${st}" ${(editing?.status || "draft") === st ? "checked" : ""} /><span>${statusLabel(st)}</span></label>`,
                )
                .join("")}
            </div>
            <p class="ef-hint" id="event-status-hint" data-hints='${escapeHtml(
              JSON.stringify({
                draft: "Not taking public sign-ups yet. Can show on the home page as upcoming.",
                open: "Takes public sign-ups. Any other open event will be closed.",
                closed: "No public sign-ups. You can still add guests here.",
              }),
            )}'></p>
          </fieldset>
          <div class="ef-group">
            <label class="ef-field"><span class="ef-label">Venue</span>
              <input name="address" required maxlength="300" value="${escapeHtml(editing?.address || DEFAULT_VENUE)}" />
            </label>
          </div>
          <details class="ef-group ef-more"${editing?.announcement_title || editing?.announcement_body ? " open" : ""}>
            <summary>
              <span>${editing?.announcement_title || editing?.announcement_body ? "Announcement" : "Add an announcement"}</span>
              <em>optional</em>
            </summary>
            <div class="ef-more-body">
              <label class="ef-field"><span class="ef-label">Title</span>
                <input name="announcement_title" maxlength="200" value="${escapeHtml(editing?.announcement_title || "")}" placeholder="Defaults to the event name" />
              </label>
              <label class="ef-field"><span class="ef-label">Message</span>
                <textarea name="announcement_body" rows="4" maxlength="2000" placeholder="Shown on the home page">${escapeHtml(editing?.announcement_body || "")}</textarea>
              </label>
            </div>
          </details>
          <div class="admin-form-actions ef-actions">
            <button class="btn btn-primary" type="submit">${editing ? "Save changes" : "Create event"}</button>
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
    <header class="admin-pagehead">
      <h1>Registrations</h1>
      <p>Filter the guest list, export it, or add a walk-in. Tap a guest to mark attendance or edit their details.</p>
    </header>
    <section class="admin-panel reg-board">
      <div class="reg-filters">
        <label class="reg-event">
          <span class="visually-hidden">Event</span>
          <select id="event-filter">
            <option value="">All events</option>
            ${eventOptions}
          </select>
        </label>
        <label class="reg-search">
          <span class="visually-hidden">Search guests</span>
          <svg class="reg-search-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>
          <input id="reg-search" type="search" placeholder="Search name, email, or mobile" autocomplete="off" />
          <button type="button" class="reg-search-clear" id="reg-search-clear" aria-label="Clear search" hidden>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </label>
      </div>
      <div class="reg-toolbar">
        <p id="page-info" class="reg-count" aria-live="polite">Loading…</p>
        <div class="reg-toolbar-actions">
          <div class="reg-export">
            <button type="button" class="btn btn-ghost btn-sm" id="export-toggle" aria-expanded="false" aria-controls="export-menu" aria-haspopup="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/></svg>
              <span class="reg-export-label">Export</span>
            </button>
            <div class="reg-export-menu" id="export-menu">
              <button type="button" id="export-xlsx">Excel <em>.xlsx</em></button>
              <button type="button" id="export-pdf">PDF <em>.pdf</em></button>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="add-guest-open">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            <span>Add<span class="reg-add-more"> guest</span></span>
          </button>
        </div>
      </div>
      <div class="table-wrap">
        <table id="reg-table">
          <thead>
            <tr>
              <th class="reg-num" scope="col"><span class="visually-hidden">Number</span></th>
              <th aria-sort="none"><button type="button" class="th-sort" data-sort="name">Name</button></th>
              <th aria-sort="none"><button type="button" class="th-sort" data-sort="mobile">Mobile</button></th>
              <th aria-sort="none"><button type="button" class="th-sort" data-sort="attended">Attended</button></th>
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
    <div class="reg-modal" id="guest-edit-modal" hidden>
      <button type="button" class="reg-modal-backdrop" data-close-edit aria-label="Close"></button>
      <div class="reg-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-edit-title">
        <div class="reg-modal-head">
          <h2 id="guest-edit-title">Guest</h2>
          <button type="button" class="reg-modal-close" data-close-edit aria-label="Close">Close</button>
        </div>
        <div class="reg-tabs" role="tablist" aria-label="Guest">
          <button type="button" class="reg-tab is-active" id="tab-attendance" role="tab" aria-selected="true" aria-controls="panel-attendance">Attendance</button>
          <button type="button" class="reg-tab" id="tab-details" role="tab" aria-selected="false" aria-controls="guest-edit-form" tabindex="-1">Details</button>
        </div>
        <div id="panel-attendance" role="tabpanel" aria-labelledby="tab-attendance">
          <p class="reg-modal-note" id="guest-edit-context"></p>
          <div class="reg-attend-choices" role="group" aria-label="Attendance">
            <button type="button" class="reg-attend-choice" data-attended="0" aria-pressed="false">Not yet</button>
            <button type="button" class="reg-attend-choice" data-attended="1" aria-pressed="false">Attended</button>
          </div>
          <p id="guest-attend-status" class="form-status" role="status"></p>
        </div>
        <form class="form" id="guest-edit-form" hidden role="tabpanel" aria-labelledby="tab-details">
          <div class="reg-form-grid">
            <label class="is-wide">Event
              <select name="event_id" required>${eventOptions}</select>
            </label>
            <label class="is-wide"><span>Name</span><input name="name" required maxlength="120" autocomplete="name" /></label>
            <label><span>Email <em>optional</em></span><input name="email" type="email" maxlength="200" autocomplete="email" /></label>
            <label><span>Mobile <em>optional</em></span><input name="mobile" maxlength="20" inputmode="tel" autocomplete="tel" placeholder="+65…" /></label>
          </div>
          <div class="admin-form-actions">
            <button class="btn btn-primary" type="submit">Save details</button>
          </div>
          <p id="guest-edit-status" class="form-status" role="status"></p>
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
    attended: "r.attended",
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

async function apiAdminUpdateRegistration(request: Request, env: Env, actor: string): Promise<Response> {
  const body = (await request.json()) as {
    id?: string;
    event_id?: string;
    name?: string;
    email?: string;
    mobile?: string;
  };
  const id = String(body.id || "").trim();
  const eventId = String(body.event_id || "").trim();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const mobile = String(body.mobile || "").trim();

  if (!id) return json({ error: "id required" }, 400);
  if (!eventId) return json({ error: "event_id required" }, 400);
  if (!name || name.length > 120) return json({ error: "Name is required." }, 400);
  if (!isValidOptionalEmail(email)) return json({ error: "Email looks invalid." }, 400);
  const mobileNorm = mobile ? normalizeMobile(mobile) : "";
  if (mobile && !mobileNorm) return json({ error: "Enter a valid mobile number." }, 400);

  const existing = await env.DB.prepare(`SELECT id FROM registrations WHERE id = ?`).bind(id).first<{ id: string }>();
  if (!existing) return json({ error: "Registration not found." }, 404);

  const event = await env.DB.prepare(`SELECT id, title FROM events WHERE id = ?`)
    .bind(eventId)
    .first<{ id: string; title: string }>();
  if (!event) return json({ error: "event not found" }, 404);

  await env.DB.prepare(
    `UPDATE registrations SET event_id = ?, name = ?, email = ?, mobile = ? WHERE id = ?`,
  )
    .bind(eventId, name, email || null, mobileNorm, id)
    .run();

  await recordAudit(env, {
    actor,
    action: "guest.update",
    targetId: id,
    summary: `Updated guest ${name} on ${shortEventTitle(event.title)}`,
  });

  return json({ ok: true, id });
}

async function apiAdminSetAttendance(request: Request, env: Env, actor: string): Promise<Response> {
  const body = (await request.json()) as { id?: string; attended?: unknown };
  const id = String(body.id || "").trim();
  const attended = body.attended === 1 || body.attended === "1" ? 1 : body.attended === 0 || body.attended === "0" ? 0 : null;
  if (!id) return json({ error: "id required" }, 400);
  if (attended === null) return json({ error: "attended must be 0 or 1" }, 400);

  const row = await env.DB.prepare(
    `SELECT r.id, r.name, e.title AS event_title
     FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE r.id = ?`,
  )
    .bind(id)
    .first<{ id: string; name: string; event_title: string }>();
  if (!row) return json({ error: "Registration not found." }, 404);

  await env.DB.prepare(`UPDATE registrations SET attended = ? WHERE id = ?`).bind(attended, id).run();

  await recordAudit(env, {
    actor,
    action: "guest.attend",
    targetId: id,
    summary: attended
      ? `Marked ${row.name} attended at ${shortEventTitle(row.event_title)}`
      : `Cleared attendance for ${row.name} at ${shortEventTitle(row.event_title)}`,
  });

  return json({ ok: true, id, attended });
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
                <img src="/api/media/${encodeURIComponent(key)}" alt="${escapeHtml(caption)}" loading="lazy" />
                <button type="button" class="admin-photo-delete" data-delete-image="${escapeHtml(id)}" aria-label="Delete photo${caption ? `: ${escapeHtml(caption)}` : ""}" title="Delete photo">${menuIcon("trash")}</button>
                <p class="admin-photo-caption${caption ? "" : " is-empty"}">${escapeHtml(caption || "No caption")}</p>
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
        : "";

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
      <div class="admin-panel-head">
        <h2>Photos</h2>
        ${selected ? `<span class="admin-panel-meta">${photoCount} of ${GALLERY_MAX_PER_EVENT}</span>` : ""}
      </div>
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
      <h1>Videos</h1>
      <p>Add a YouTube or Shorts link. Videos appear on the public Shorts page, lowest sort order first.</p>
    </header>
    <div class="admin-split is-form-aside">
    <section class="admin-panel">
    <h2>Add a video</h2>
    <form class="form" id="video-form">
      <input type="hidden" name="id" value="" />
      <div class="admin-fields">
        <label class="is-wide"><span>Title</span><input name="title" required maxlength="200" /></label>
        <label class="is-wide"><span>YouTube URL</span><input name="youtube_url" required placeholder="https://www.youtube.com/shorts/…" /></label>
        <label><span>Sort order</span><input name="sort_order" type="number" value="0" inputmode="numeric" /></label>
      </div>
      <div class="admin-form-actions">
        <button class="btn btn-primary" type="submit">Save video</button>
      </div>
      <p id="video-status" class="form-status" role="status"></p>
    </form>
    </section>
    <section class="admin-panel">
    <div class="admin-panel-head">
      <h2>Published</h2>
      <span class="admin-panel-meta">${videos.results.length}</span>
    </div>
    <ul class="admin-video-list">
      ${videos.results
        .map((v) => {
          const thumb = youtubeThumb(v.youtube_url);
          return `<li>
          <a class="admin-video-thumb" href="${escapeHtml(v.youtube_url)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${
            thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" />` : menuIcon("videos")
          }</a>
          <div class="admin-video-main">
            <strong>${escapeHtml(v.title)}</strong>
            <a href="${escapeHtml(v.youtube_url)}" target="_blank" rel="noopener">${escapeHtml(shortUrl(v.youtube_url))}</a>
            <span class="admin-video-order">Order ${escapeHtml(String(v.sort_order))}</span>
          </div>
          <button type="button" class="admin-icon-btn is-danger" data-delete-video="${escapeHtml(v.id)}" aria-label="Delete ${escapeHtml(v.title)}" title="Delete video">${menuIcon("trash")}</button>
        </li>`;
        })
        .join("") || `<li class="admin-list-empty">No videos yet. Add the first one here.</li>`}
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
