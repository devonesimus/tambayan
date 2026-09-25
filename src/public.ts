import {
  escapeHtml,
  eventAnnouncementBody,
  eventAnnouncementTitle,
  eventVenue,
  formatEventHeadline,
  formatEventWhen,
  getHomeEvent,
  getOpenEvent,
  html,
  isValidOptionalEmail,
  json,
  normalizeMobile,
  preferRegistrationField,
  publicRegistrationState,
  registrationCompleteness,
  sameRegistration,
  siteBase,
  youtubeEmbedUrl,
  youtubeThumb,
  type EventRow,
  type GalleryImageRow,
  type RegistrationRow,
  type VideoRow,
} from "./helpers";
import { layout, shareButtons } from "./layout";

export async function renderHome(request: Request, env: Env): Promise<Response> {
  const event = await getHomeEvent(env.DB);
  const openEvent = await getOpenEvent(env.DB);
  const regState = publicRegistrationState(openEvent);
  const base = siteBase(env, request);

  const title = event ? eventAnnouncementTitle(event) : "OFW Tambayan SG";
  const bodyText = event
    ? eventAnnouncementBody(event) ||
      "Every last Sunday — fellowship, worship & community with fellow OFWs in Singapore."
    : "Every last Sunday — fellowship, worship & community with fellow OFWs in Singapore.";
  const when = event ? formatEventWhen(event.held_at) : "Every last Sunday, 2–4 PM";
  const headline = event ? formatEventHeadline(event.held_at) : "EVERY LAST SUNDAY · 2–4 PM";
  const where = event ? eventVenue(event, env) : env.DEFAULT_LOCATION;
  // Organisers' announcement for this event, shown in the hero when they wrote one.
  const announcementTitle = (event?.announcement_title || "").trim();
  const announcementBody = event ? eventAnnouncementBody(event) : "";

  let ctaLabel = "Coming soon";
  let ctaHref: string | null = null;
  if (regState === "open") {
    ctaLabel = "Register";
    ctaHref = "/register";
  } else if (regState === "closed" || (event && event.status !== "draft")) {
    ctaLabel = "Registration closed";
    ctaHref = "/register";
  } else if (!event || event.status === "draft") {
    ctaLabel = "Coming soon";
    ctaHref = null;
  }

  const cta = ctaHref
    ? `<a class="btn btn-hero" href="${ctaHref}">${escapeHtml(ctaLabel)}</a>`
    : `<span class="btn btn-hero is-disabled" aria-disabled="true">${escapeHtml(ctaLabel)}</span>`;

  const photos = await renderPhotoRow(env);
  const hashtags = renderHashtagStrip();

  const bodyHtml = `
    <section class="home-hero" aria-labelledby="hero-date">
      <img
        class="hero-plane"
        src="/brand/airplane-red.svg"
        alt=""
        width="56"
        height="40"
        decoding="async"
        aria-hidden="true"
      />
      <div class="home-hero-inner">
        <div class="home-hero-brand">
          <img
            class="hero-logo"
            src="/brand/ofwt-logo-white.png"
            alt="OFW Tambayan Singapore — Your Home Away From Home"
            width="420"
            height="242"
            decoding="async"
          />
        </div>
        <div class="home-hero-panel">
          <div class="hero-head">
            ${announcementTitle ? `<p class="hero-kicker">${escapeHtml(announcementTitle)}</p>` : ""}
            <h1 id="hero-date" class="hero-date">${escapeHtml(headline)}</h1>
          </div>
          ${
            announcementBody
              ? `<p class="hero-line hero-announcement">${escapeHtml(announcementBody)}</p>`
              : `<p class="hero-line">Every last Sunday — fellowship, worship &amp; community</p>`
          }
          <p class="hero-venue">${regIcon("pin")}<span>${escapeHtml(where)}</span></p>
          <div class="hero-cta">${cta}<span class="hero-free"><svg class="hero-free-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z"/><path d="M14 6.5v11" stroke-dasharray="1.6 2"/></svg><span>Free to join</span></span></div>
          <div class="hero-secondary">
            <a href="${escapeHtml(env.FACEBOOK_URL)}" target="_blank" rel="noopener noreferrer">Facebook</a>
            <span class="share-sep" aria-hidden="true">·</span>
            <a class="share-link" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(base)}" target="_blank" rel="noopener noreferrer">Share</a>
            <span class="share-sep" aria-hidden="true">·</span>
            <a class="share-link" href="https://wa.me/?text=${encodeURIComponent(`Join us at OFW Tambayan SG — ${when} ${base}`)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
    ${hashtags}
    ${photos}`;

  return html(
    layout({
      env,
      request,
      title: `${title} · OFW Tambayan SG`,
      description: bodyText.slice(0, 160),
      active: "home",
      og: {
        title,
        description: bodyText.slice(0, 200),
        url: base,
        image: event?.cover_image_key
          ? `${base}/api/media/${encodeURIComponent(event.cover_image_key)}`
          : `${base}/og-default.svg`,
      },
      body: bodyHtml,
    }),
  );
}

function renderHashtagStrip(): string {
  const items = [
    { tag: "#KKB", script: "Kamusta ka ba?" },
    { tag: "#SKL", script: "Share Ko Lang" },
    { tag: "#SML", script: "Share Mo Lang" },
  ];
  return `
    <section class="hashtag-strip" aria-label="What to expect">
      <div class="hashtag-strip-inner">
        ${items
          .map(
            (item) => `<div class="hashtag-card">
          <p class="hashtag-tag">${escapeHtml(item.tag)}</p>
          <p class="hashtag-script">${escapeHtml(item.script)}</p>
        </div>`,
          )
          .join("")}
      </div>
    </section>`;
}

async function renderPhotoRow(env: Env): Promise<string> {
  const latestGallery = await env.DB.prepare(
    `SELECT e.*
     FROM events e
     WHERE e.status != 'draft'
       AND EXISTS (SELECT 1 FROM gallery_images g WHERE g.event_id = e.id)
     ORDER BY e.held_at DESC
     LIMIT 1`,
  ).first<EventRow>();

  if (!latestGallery) return "";

  const images = await env.DB.prepare(
    `SELECT * FROM gallery_images
     WHERE event_id = ?
     ORDER BY sort_order ASC, created_at ASC
     LIMIT 6`,
  )
    .bind(latestGallery.id)
    .all<GalleryImageRow>();

  if (images.results.length === 0) return "";

  const latestVideo = await env.DB.prepare(
    `SELECT * FROM videos ORDER BY sort_order ASC, published_at DESC LIMIT 1`,
  ).first<VideoRow>();

  const figures = images.results
    .map(
      (img) => `<a class="photo-row-item" href="/gallery/${escapeHtml(latestGallery.slug)}">
        <img
          src="/api/media/${encodeURIComponent(img.r2_key)}"
          alt="${escapeHtml(img.caption || latestGallery.title)}"
          loading="lazy"
          decoding="async"
        />
      </a>`,
    )
    .join("");

  const shortLink = latestVideo
    ? `<p class="photo-row-short"><a href="/shorts">Latest Short · ${escapeHtml(latestVideo.title)}</a></p>`
    : "";

  return `
    <section class="photo-row" aria-labelledby="photo-row-heading">
      <div class="photo-row-inner">
        <h2 id="photo-row-heading" class="photo-row-heading">From the gallery</h2>
        <div class="photo-row-grid">
          ${figures}
        </div>
        ${shortLink}
      </div>
    </section>`;
}

const regIcons: Record<string, string> = {
  calendar: `<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`,
  pin: `<path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>`,
};

function regIcon(name: string): string {
  return `<svg class="reg-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${regIcons[name] || ""}</svg>`;
}

/** Brand-coloured confetti for the sign-up confirmation; each piece flies along its own angle. */
function confettiPieces(): string {
  const colors = ["#eaa12f", "#f9d21d", "#d33444", "#20419c", "#27346b"];
  return Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
    const dist = 90 + (i % 3) * 28;
    const x = Math.round(Math.cos(angle) * dist);
    const y = Math.round(Math.sin(angle) * dist * 0.75) - 20;
    const spin = (i % 2 ? 1 : -1) * (160 + i * 23);
    return `<span style="--x:${x}px;--y:${y}px;--r:${spin}deg;--c:${colors[i % colors.length]};--d:${(i % 4) * 40}ms"></span>`;
  }).join("");
}

export async function renderRegister(request: Request, env: Env): Promise<Response> {
  const openEvent = await getOpenEvent(env.DB);
  const state = publicRegistrationState(openEvent);

  let statusPanel = "";
  if (state !== "open") {
    const recent = await env.DB.prepare(
      `SELECT * FROM events
       WHERE status IN ('open', 'closed')
       ORDER BY held_at DESC
       LIMIT 1`,
    ).first<EventRow>();
    const when = recent ? formatEventWhen(recent.held_at) : null;
    const isComingSoon = state === "none";
    const heading = isComingSoon ? "Coming soon" : "Registration closed";
    const detail = isComingSoon
      ? "Public sign-up opens when organizers publish the next OFW Tambayan gathering."
      : `${when ? `The most recent gathering was ${escapeHtml(when)}. ` : ""}Sign-up opens again with the next published event.`;
    statusPanel = `
      <div class="status-panel ${isComingSoon ? "status-panel-soon" : "status-panel-closed"}" role="status">
        <p class="status-panel-kicker">${escapeHtml(heading)}</p>
        <p class="status-panel-body">${detail}</p>
        <p class="status-panel-follow">
          Follow us on
          <a href="${escapeHtml(env.FACEBOOK_URL)}" target="_blank" rel="noopener noreferrer">Facebook</a>
          for updates.
        </p>
      </div>`;
  }

  const when = openEvent ? formatEventWhen(openEvent.held_at) : "";
  const where = openEvent ? eventVenue(openEvent, env) : "";

  const formBlock =
    state === "open" && openEvent
      ? `<div class="register-card">
      <div class="register-event">
        <p class="register-event-title">${escapeHtml(openEvent.title)}</p>
        <p class="register-event-line">${regIcon("calendar")}<span>${escapeHtml(when)}</span></p>
        <p class="register-event-line">${regIcon("pin")}<span>${escapeHtml(where)}</span></p>
      </div>
      <div id="register-panel">
      <div id="register-confirm" class="register-confirm" role="status" aria-live="polite" hidden>
        <div class="reg-stage" aria-hidden="true">
          <span class="reg-trail"></span>
          <img class="reg-plane" src="/brand/airplane-red-flipped.svg" alt="" width="54" height="36" />
          <div class="reg-burst">${confettiPieces()}</div>
          <svg class="reg-check" viewBox="0 0 52 52">
            <circle class="reg-check-ring" cx="26" cy="26" r="23" />
            <path class="reg-check-tick" d="M15 27.5l7.2 7L37.5 19" />
          </svg>
        </div>
        <p class="register-confirm-kicker" id="register-confirm-kicker"></p>
        <p class="register-confirm-body" id="register-status"></p>
        <div class="reg-done-event" id="reg-done-event">
          <p class="reg-done-event-title">${escapeHtml(openEvent.title)}</p>
          <p class="register-event-line">${regIcon("calendar")}<span>${escapeHtml(when)}</span></p>
          <p class="register-event-line">${regIcon("pin")}<span>${escapeHtml(where)}</span></p>
        </div>
        <a class="btn btn-ghost reg-done-cal" id="register-confirm-cal" href="#" download="ofw-tambayan.ics">${regIcon("calendar")}Add to calendar</a>
      </div>
      <form id="register-form" class="form form-register" method="post" action="/api/register" novalidate>
        <label>
          <span class="field-label">Name <em>required</em> <span class="field-hint" data-for="name"></span></span>
          <input name="name" type="text" autocomplete="name" required maxlength="120" />
        </label>
        <label>
          <span class="field-label">Email <em>optional</em> <span class="field-hint" data-for="email"></span></span>
          <input name="email" type="email" autocomplete="email" maxlength="200" />
        </label>
        <label>
          <span class="field-label">Mobile <em>required</em> <span class="field-hint" data-for="mobile"></span></span>
          <input name="mobile" type="tel" inputmode="tel" autocomplete="tel" required placeholder="+65…" maxlength="20" />
        </label>
        <label class="check">
          <input name="privacy" type="checkbox" value="1" required />
          <span class="field-label">I agree to the <a href="/privacy" target="_blank">Privacy Policy</a> <span class="field-hint" data-for="privacy"></span></span>
        </label>
        <button class="btn btn-cta" type="submit">Register</button>
      </form>
      </div>
      </div>
      <script src="/register.js" defer></script>`
      : statusPanel;

  const body = `
    <section class="page-section register-page"${
      state === "open" && openEvent
        ? ` data-event-title="${escapeHtml(openEvent.title)}" data-event-start="${escapeHtml(openEvent.held_at)}" data-event-when="${escapeHtml(when)}" data-event-venue="${escapeHtml(where)}"`
        : ""
    }>
      <header class="page-intro">
        <h1>Register</h1>
        <p class="lede">${
          state === "open"
            ? "Sign up for the next tambayan session. It’s free."
            : "Registration opens with each published gathering. It’s free."
        }</p>
      </header>
      ${formBlock}
    </section>`;

  return html(
    layout({
      env,
      request,
      title: "Register · OFW Tambayan SG",
      active: "register",
      description:
        state === "open" && openEvent
          ? `Register for ${openEvent.title} — ${when}`
          : state === "none"
            ? "Registration opens soon for OFW Tambayan SG."
            : "Registration is currently closed for OFW Tambayan SG.",
      og: {
        title: "Register for OFW Tambayan SG",
        description:
          state === "open" && openEvent
            ? `Join us ${when} at ${where}.`
            : "Registration opens with the next OFW Tambayan gathering.",
        url: `${siteBase(env, request)}/register`,
      },
      body,
    }),
  );
}

export async function handleRegisterApi(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const event = await getOpenEvent(env.DB);
  if (!event) {
    return json({ error: "Registration is closed. No open event is accepting sign-ups." }, 400);
  }

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

  const incoming = { name, email, mobile: mobileNorm };
  const existing = await env.DB.prepare(`SELECT * FROM registrations WHERE event_id = ?`)
    .bind(event.id)
    .all<RegistrationRow>();
  const matches = existing.results.filter((row) => sameRegistration(row, incoming));
  matches.sort((a, b) => {
    const byScore = registrationCompleteness(b) - registrationCompleteness(a);
    if (byScore !== 0) return byScore;
    return a.created_at < b.created_at ? -1 : 1;
  });
  const keeper = matches[0];

  if (keeper) {
    const merged = preferRegistrationField(keeper, incoming);
    const emailChanged = (merged.email || "") !== (keeper.email || "");
    const changed =
      merged.name !== keeper.name || emailChanged || merged.mobile !== keeper.mobile || !keeper.privacy_policy_agreed_at;
    if (changed) {
      await env.DB.prepare(
        `UPDATE registrations
         SET name = ?, email = ?, mobile = ?, privacy_policy_agreed_at = COALESCE(privacy_policy_agreed_at, ?)
         WHERE id = ?`,
      )
        .bind(merged.name, merged.email, merged.mobile, new Date().toISOString(), keeper.id)
        .run();
    }
    return json({
      ok: true,
      already: true,
      id: keeper.id,
      event: { id: event.id, title: event.title },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO registrations (id, event_id, name, email, mobile, privacy_policy_agreed_at, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'public', ?)`,
  )
    .bind(id, event.id, name, email || null, mobileNorm, now, now)
    .run();

  return json({ ok: true, already: false, id, event: { id: event.id, title: event.title } });
}

export async function renderPrivacy(request: Request, env: Env): Promise<Response> {
  const body = `
    <section class="page-section narrow prose">
      <header class="page-intro">
        <h1>Privacy Policy</h1>
      </header>
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
     WHERE e.status != 'draft'
     ORDER BY e.held_at DESC`,
  ).all<EventRow & { photo_count: number }>();

  const cards =
    events.results.length === 0
      ? `<div class="empty-state" role="status">
          <p class="empty-state-title">No galleries yet</p>
          <p class="empty-state-body">Photos will appear here after each gathering.</p>
        </div>`
      : `<ul class="gallery-list">
        ${events.results
          .map((e) => {
            const count = Number(e.photo_count) || 0;
            const countLabel = count === 1 ? "1 photo" : `${count} photos`;
            return `<li>
            <a class="gallery-list-link" href="/gallery/${escapeHtml(e.slug)}">
              <span class="gallery-list-title">${escapeHtml(e.title)}</span>
              <span class="gallery-list-meta">${escapeHtml(formatEventWhen(e.held_at))} · ${escapeHtml(countLabel)}</span>
            </a>
          </li>`;
          })
          .join("")}
      </ul>`;

  const body = `
    <section class="page-section gallery-page">
      <header class="page-intro">
        <h1>Gallery</h1>
        <p class="lede">Moments from past OFW Tambayan gatherings.</p>
      </header>
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
  if (!event || event.status === "draft") {
    return html(
      layout({
        env,
        request,
        title: "Not found",
        active: "gallery",
        body: `<section class="page-section"><header class="page-intro"><h1>Gallery not found</h1><p class="lede">That gathering isn’t in the public gallery.</p></header><p class="page-back"><a href="/gallery">All galleries</a></p></section>`,
      }),
      404,
    );
  }

  const images = await env.DB.prepare(
    `SELECT * FROM gallery_images WHERE event_id = ? ORDER BY sort_order ASC, created_at ASC`,
  )
    .bind(event.id)
    .all<GalleryImageRow>();

  const base = siteBase(env, request);
  const grid =
    images.results.length === 0
      ? `<div class="empty-state" role="status">
          <p class="empty-state-title">Photos coming soon</p>
          <p class="empty-state-body">This gathering’s gallery is not published yet.</p>
        </div>`
      : `<div class="photo-grid">
        ${images.results
          .map(
            (img) => `<figure class="photo-grid-item">
            <a href="/api/media/${encodeURIComponent(img.r2_key)}" target="_blank" rel="noopener">
              <img src="/api/media/${encodeURIComponent(img.r2_key)}" alt="${escapeHtml(img.caption || event.title)}" loading="lazy" decoding="async" />
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
    <section class="page-section gallery-detail">
      <p class="page-back"><a href="/gallery">All galleries</a></p>
      <header class="page-intro">
        <h1>${escapeHtml(event.title)}</h1>
        <p class="lede">${escapeHtml(formatEventWhen(event.held_at))}</p>
      </header>
      ${shareButtons(shareUrl, `Photos from ${event.title}`, true)}
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
    ? `<div class="shorts-stage">
        <div class="player-shell">
          <iframe id="shorts-player" title="${escapeHtml(first.title)}" src="${escapeHtml(firstEmbed)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        </div>
        <h2 id="shorts-title" class="player-title">${escapeHtml(first.title)}</h2>
      </div>`
    : `<div class="empty-state" role="status">
        <p class="empty-state-title">Shorts coming soon</p>
        <p class="empty-state-body">Short videos from fellowship will appear here.</p>
      </div>`;

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
                ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" width="72" height="72" loading="lazy" decoding="async" />` : `<span class="video-item-fallback" aria-hidden="true"></span>`}
                <span class="video-item-title">${escapeHtml(v.title)}</span>
              </button>
            </li>`;
          })
          .join("")}
      </ul>
      <script src="/shorts.js" defer></script>`;

  const body = `
    <section class="page-section shorts-page">
      <header class="page-intro">
        <h1>Shorts</h1>
        <p class="lede">Moments from OFW Tambayan — watch and share.</p>
      </header>
      ${shareButtons(`${base}/shorts`, "Watch OFW Tambayan Shorts", true)}
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
