import {
  escapeHtml,
  formatEventWhen,
  getNextEvent,
  getSettings,
  html,
  isValidOptionalEmail,
  json,
  normalizeMobile,
  siteBase,
  youtubeEmbedUrl,
  youtubeThumb,
  type EventRow,
  type GalleryImageRow,
  type VideoRow,
} from "./helpers";
import { layout, shareButtons } from "./layout";

async function locationLine(env: Env): Promise<string> {
  const settings = await getSettings(env.DB);
  return settings.location_override || env.DEFAULT_LOCATION;
}

export async function renderHome(request: Request, env: Env): Promise<Response> {
  const settings = await getSettings(env.DB);
  const event = await getNextEvent(env.DB);
  const base = siteBase(env, request);
  const location = await locationLine(env);
  const when = event ? formatEventWhen(event.held_at) : "Every last Sunday, 2–4 PM";
  const title = settings.announcement_title || "OFW Tambayan SG";
  const bodyHtml = `
    <section class="hero">
      <p class="eyebrow">Fellowship · Singapore</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(settings.announcement_body)}</p>
      <dl class="event-meta">
        <div><dt>When</dt><dd>${escapeHtml(when)}</dd></div>
        <div><dt>Where</dt><dd>${escapeHtml(location)}</dd></div>
        ${event ? `<div><dt>Event</dt><dd>${escapeHtml(event.title)}</dd></div>` : ""}
      </dl>
      <div class="cta-row">
        <a class="btn btn-primary" href="/register">Register for the next gathering</a>
        <a class="btn btn-ghost" href="${escapeHtml(env.FACEBOOK_URL)}" target="_blank" rel="noopener noreferrer">Follow on Facebook</a>
      </div>
      ${shareButtons(base, `Join us at OFW Tambayan SG — ${when}`)}
    </section>
    <section class="band">
      <h2>What to expect</h2>
      <p>Warm fellowship with fellow OFWs, worship, and space to belong. Come as you are — bring a friend.</p>
    </section>`;

  return html(
    layout({
      env,
      request,
      title: `${title} · OFW Tambayan SG`,
      description: settings.announcement_body.slice(0, 160),
      active: "home",
      og: {
        title,
        description: settings.announcement_body.slice(0, 200),
        url: base,
        image: event?.cover_image_key
          ? `${base}/api/media/${encodeURIComponent(event.cover_image_key)}`
          : `${base}/og-default.svg`,
      },
      body: bodyHtml,
    }),
  );
}

export async function renderRegister(request: Request, env: Env): Promise<Response> {
  const event = await getNextEvent(env.DB);
  const when = event ? formatEventWhen(event.held_at) : "the next OFW Tambayan";
  const body = `
    <section class="narrow">
      <h1>Register</h1>
      <p class="lede">Sign up for ${escapeHtml(event?.title || "the next gathering")} · ${escapeHtml(when)}</p>
      ${
        event
          ? `<form id="register-form" class="form" method="post" action="/api/register" novalidate>
        <label>
          <span>Name <em>required</em></span>
          <input name="name" type="text" autocomplete="name" required maxlength="120" />
        </label>
        <label>
          <span>Email <em>optional</em></span>
          <input name="email" type="email" autocomplete="email" maxlength="200" />
        </label>
        <label>
          <span>Mobile <em>required</em></span>
          <input name="mobile" type="tel" autocomplete="tel" required placeholder="+65…" maxlength="20" />
        </label>
        <label class="check">
          <input name="privacy" type="checkbox" value="1" required />
          <span>I agree to the <a href="/privacy" target="_blank">Privacy Policy</a></span>
        </label>
        <button class="btn btn-primary" type="submit">Submit registration</button>
        <p id="register-status" class="form-status" role="status" aria-live="polite"></p>
      </form>
      <script src="/register.js" defer></script>`
          : `<p class="notice">Registration opens when the next event is announced. Check back soon, or follow us on <a href="${escapeHtml(env.FACEBOOK_URL)}" target="_blank" rel="noopener noreferrer">Facebook</a>.</p>`
      }
    </section>`;

  return html(
    layout({
      env,
      request,
      title: "Register · OFW Tambayan SG",
      active: "register",
      description: `Register for OFW Tambayan — ${when}`,
      og: {
        title: "Register for OFW Tambayan SG",
        description: `Join us ${when} at Level 1 Auditorium, 798 Thomson Road.`,
        url: `${siteBase(env, request)}/register`,
      },
      body,
    }),
  );
}

export async function handleRegisterApi(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const event = await getNextEvent(env.DB);
  if (!event) return json({ error: "No upcoming event is open for registration." }, 400);

  let name = "";
  let email = "";
  let mobile = "";
  let privacy = false;

  const ctype = request.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    name = String(body.name || "").trim();
    email = String(body.email || "").trim();
    mobile = String(body.mobile || "").trim();
    privacy = Boolean(body.privacy);
  } else {
    const form = await request.formData();
    name = String(form.get("name") || "").trim();
    email = String(form.get("email") || "").trim();
    mobile = String(form.get("mobile") || "").trim();
    privacy = form.get("privacy") === "1" || form.get("privacy") === "on" || form.get("privacy") === "true";
  }

  if (!name || name.length > 120) return json({ error: "Name is required." }, 400);
  if (!isValidOptionalEmail(email)) return json({ error: "Email looks invalid." }, 400);
  const mobileNorm = normalizeMobile(mobile);
  if (!mobileNorm) return json({ error: "Enter a valid mobile number." }, 400);
  if (!privacy) return json({ error: "Please accept the Privacy Policy." }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO registrations (id, event_id, name, email, mobile, privacy_policy_agreed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, event.id, name, email || null, mobileNorm, now, now)
    .run();

  return json({ ok: true, id, event: { id: event.id, title: event.title } });
}

export async function renderPrivacy(request: Request, env: Env): Promise<Response> {
  const body = `
    <section class="narrow prose">
      <h1>Privacy Policy</h1>
      <p>OFW Tambayan SG collects the information you provide on the registration form so we can plan seating, follow up about the gathering, and keep you informed about upcoming fellowship nights.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Name (required)</li>
        <li>Mobile number (required)</li>
        <li>Email address (optional)</li>
        <li>The time you accepted this policy</li>
      </ul>
      <h2>How we use it</h2>
      <p>Registration details are stored in our Cloudflare D1 database and are visible only to seeded site admins. We do not sell your data. We may contact you about the event you registered for or related OFW Tambayan gatherings.</p>
      <h2>Retention</h2>
      <p>We keep registrations for operational needs across monthly events. Contact an organizer via our <a href="${escapeHtml(env.FACEBOOK_URL)}" target="_blank" rel="noopener noreferrer">Facebook page</a> if you want your details removed.</p>
      <h2>Contact</h2>
      <p>Questions about privacy: message <a href="${escapeHtml(env.FACEBOOK_URL)}" target="_blank" rel="noopener noreferrer">OFW Tambayan SG on Facebook</a>.</p>
    </section>`;

  return html(
    layout({
      env,
      request,
      title: "Privacy Policy · OFW Tambayan SG",
      active: "privacy",
      body,
      og: {
        title: "Privacy Policy · OFW Tambayan SG",
        description: "How OFW Tambayan SG handles registration data.",
        url: `${siteBase(env, request)}/privacy`,
      },
    }),
  );
}

export async function renderGalleryIndex(request: Request, env: Env): Promise<Response> {
  const events = await env.DB.prepare(
    `SELECT e.*,
      (SELECT COUNT(*) FROM gallery_images g WHERE g.event_id = e.id) AS photo_count
     FROM events e
     ORDER BY e.held_at DESC`,
  ).all<EventRow & { photo_count: number }>();

  const cards =
    events.results.length === 0
      ? `<p class="notice">Photo galleries will appear here after each gathering.</p>`
      : `<ul class="gallery-list">
        ${events.results
          .map(
            (e) => `<li>
            <a href="/gallery/${escapeHtml(e.slug)}">
              <strong>${escapeHtml(e.title)}</strong>
              <span>${escapeHtml(formatEventWhen(e.held_at))} · ${e.photo_count} photos</span>
            </a>
          </li>`,
          )
          .join("")}
      </ul>`;

  const body = `
    <section class="narrow">
      <h1>Gallery</h1>
      <p class="lede">Moments from past OFW Tambayan gatherings.</p>
      ${cards}
    </section>`;

  return html(
    layout({
      env,
      request,
      title: "Gallery · OFW Tambayan SG",
      active: "gallery",
      body,
      og: {
        title: "OFW Tambayan Gallery",
        description: "Photos from OFW Tambayan SG gatherings.",
        url: `${siteBase(env, request)}/gallery`,
      },
    }),
  );
}

export async function renderGalleryEvent(
  request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  const event = await env.DB.prepare("SELECT * FROM events WHERE slug = ?")
    .bind(slug)
    .first<EventRow>();
  if (!event) return html(layout({ env, request, title: "Not found", body: "<h1>Gallery not found</h1>" }), 404);

  const images = await env.DB.prepare(
    `SELECT * FROM gallery_images WHERE event_id = ? ORDER BY sort_order ASC, created_at ASC`,
  )
    .bind(event.id)
    .all<GalleryImageRow>();

  const base = siteBase(env, request);
  const grid =
    images.results.length === 0
      ? `<p class="notice">Photos for this event are coming soon.</p>`
      : `<div class="photo-grid">
        ${images.results
          .map(
            (img) => `<figure>
            <a href="/api/media/${encodeURIComponent(img.r2_key)}" target="_blank" rel="noopener">
              <img src="/api/media/${encodeURIComponent(img.r2_key)}" alt="${escapeHtml(img.caption || event.title)}" loading="lazy" />
            </a>
            ${img.caption ? `<figcaption>${escapeHtml(img.caption)}</figcaption>` : ""}
          </figure>`,
          )
          .join("")}
      </div>`;

  const shareUrl = `${base}/gallery/${event.slug}`;
  const cover = event.cover_image_key
    ? `${base}/api/media/${encodeURIComponent(event.cover_image_key)}`
    : images.results[0]
      ? `${base}/api/media/${encodeURIComponent(images.results[0].r2_key)}`
      : `${base}/og-default.svg`;

  const body = `
    <section>
      <p class="eyebrow"><a href="/gallery">← All galleries</a></p>
      <h1>${escapeHtml(event.title)}</h1>
      <p class="lede">${escapeHtml(formatEventWhen(event.held_at))}</p>
      ${shareButtons(shareUrl, `Photos from ${event.title}`)}
      ${grid}
    </section>`;

  return html(
    layout({
      env,
      request,
      title: `${event.title} · Gallery`,
      active: "gallery",
      body,
      og: {
        title: event.title,
        description: `Photos from ${event.title} — OFW Tambayan SG`,
        url: shareUrl,
        image: cover,
      },
    }),
  );
}

export async function renderShorts(request: Request, env: Env): Promise<Response> {
  const videos = await env.DB.prepare(
    `SELECT * FROM videos ORDER BY sort_order ASC, published_at DESC`,
  ).all<VideoRow>();
  const base = siteBase(env, request);
  const first = videos.results[0];
  const firstEmbed = first ? youtubeEmbedUrl(first.youtube_url) : null;

  const player = firstEmbed
    ? `<div class="player-shell">
        <iframe id="shorts-player" title="${escapeHtml(first.title)}" src="${escapeHtml(firstEmbed)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
      </div>
      <h2 id="shorts-title" class="player-title">${escapeHtml(first.title)}</h2>`
    : `<p class="notice">Short videos will appear here soon.</p>`;

  const list =
    videos.results.length === 0
      ? ""
      : `<ul class="video-list" id="video-list">
        ${videos.results
          .map((v, i) => {
            const embed = youtubeEmbedUrl(v.youtube_url);
            const thumb = youtubeThumb(v.youtube_url);
            return `<li>
              <button type="button" class="video-item ${i === 0 ? "is-active" : ""}" data-embed="${escapeHtml(embed || "")}" data-title="${escapeHtml(v.title)}">
                ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" />` : ""}
                <span>${escapeHtml(v.title)}</span>
              </button>
            </li>`;
          })
          .join("")}
      </ul>
      <script src="/shorts.js" defer></script>`;

  const body = `
    <section class="shorts">
      <h1>Shorts</h1>
      <p class="lede">Moments from OFW Tambayan — watch and share.</p>
      ${shareButtons(`${base}/shorts`, "Watch OFW Tambayan Shorts")}
      ${player}
      ${list}
    </section>`;

  const ogImage = first ? youtubeThumb(first.youtube_url) || `${base}/og-default.svg` : `${base}/og-default.svg`;

  return html(
    layout({
      env,
      request,
      title: "Shorts · OFW Tambayan SG",
      active: "shorts",
      body,
      og: {
        title: "OFW Tambayan Shorts",
        description: "Short videos from OFW Tambayan SG fellowship.",
        url: `${base}/shorts`,
        image: ogImage,
      },
    }),
  );
}

export async function serveMedia(env: Env, key: string): Promise<Response> {
  const object = await env.GALLERY.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400");
  return new Response(object.body, { headers });
}
