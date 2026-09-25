import { escapeHtml, siteBase } from "./helpers";

export type OgMeta = {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: string;
};

export function layout(opts: {
  env: Env;
  request: Request;
  title: string;
  body: string;
  description?: string;
  og?: OgMeta;
  active?: "home" | "register" | "gallery" | "shorts" | "privacy" | "admin";
  extraHead?: string;
  headerEnd?: string;
}): string {
  const base = siteBase(opts.env, opts.request);
  const desc =
    opts.description ||
    "OFW Tambayan SG — fellowship every last Sunday, 2–4 PM at Level 1 Main Auditorium, 798 Thomson Road, Singapore 298186.";
  const og = opts.og || {
    title: opts.title,
    description: desc,
    url: base,
    image: `${base}/og-default.svg`,
    type: "website",
  };
  const isHome = opts.active === "home";
  const isAdmin = opts.active === "admin";
  const pageClass = opts.active ? `page-${opts.active}` : "";
  const bodyClass = [isHome ? "page-home" : "page-light", pageClass].filter(Boolean).join(" ");
  const logoSrc = isHome ? "/brand/ofwt-logo-white.png" : "/brand/ofwt-logo-blue.png";
  const adminThemeScript = isAdmin
    ? `<script>
try {
  if (localStorage.getItem("tambayan-admin-theme") === "dark") {
    document.documentElement.setAttribute("data-admin-theme", "dark");
  }
} catch (e) {}
</script>`
    : "";
  const nav = (id: typeof opts.active, href: string, label: string) =>
    `<a href="${href}" class="${opts.active === id ? "is-active" : ""}">${label}</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(opts.title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  <link rel="canonical" href="${escapeHtml(og.url)}" />
  <meta property="og:site_name" content="${escapeHtml(opts.env.SITE_NAME)}" />
  <meta property="og:type" content="${escapeHtml(og.type || "website")}" />
  <meta property="og:title" content="${escapeHtml(og.title)}" />
  <meta property="og:description" content="${escapeHtml(og.description)}" />
  <meta property="og:url" content="${escapeHtml(og.url)}" />
  <meta property="og:image" content="${escapeHtml(og.image || `${base}/og-default.svg`)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(og.title)}" />
  <meta name="twitter:description" content="${escapeHtml(og.description)}" />
  <meta name="twitter:image" content="${escapeHtml(og.image || `${base}/og-default.svg`)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Caveat+Brush&family=Kalam:wght@700&family=League+Gothic&family=Montserrat:wght@400;500;600;700&family=Open+Sans:ital@1&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
  ${adminThemeScript}
  ${opts.extraHead || ""}
</head>
<body class="${bodyClass}">
  <div class="page-bg" aria-hidden="true"></div>
  <header class="site-header${isHome ? " site-header--home" : ""}">
    <div class="site-header__inner">
      <a class="brand" href="/" aria-label="OFW Tambayan Singapore — home">
        ${
          isAdmin
            ? `<img class="brand-logo brand-logo--on-light" src="/brand/ofwt-logo-blue.png" alt="OFW Tambayan Singapore — Your Home Away From Home" width="160" height="92" decoding="async" />
        <img class="brand-logo brand-logo--on-dark" src="/brand/ofwt-logo-white.png" alt="" width="160" height="92" decoding="async" />`
            : `<img class="brand-logo" src="${logoSrc}" alt="OFW Tambayan Singapore — Your Home Away From Home" width="160" height="92" decoding="async" />`
        }
      </a>
      <nav class="nav" aria-label="Primary">
        ${nav("home", "/", "Home")}
        ${nav("register", "/register", "Register")}
        <div class="nav-group">
          <button type="button" class="nav-parent" aria-expanded="false" aria-controls="nav-stories">Stories</button>
          <div class="nav-sub" id="nav-stories">
            <span class="nav-soon" title="Coming soon" aria-label="Gallery, coming soon">Gallery <em>Soon</em></span>
            <span class="nav-soon" title="Coming soon" aria-label="Shorts, coming soon">Shorts <em>Soon</em></span>
          </div>
        </div>
      </nav>
      ${opts.headerEnd || ""}
    </div>
  </header>
  <main class="site-main">
    ${opts.body}
  </main>
  <footer class="site-footer">
    <div class="site-footer__inner">
      <p class="footer-tagline">Your Home Away From Home</p>
      <p class="footer-links">
        <a href="${escapeHtml(opts.env.FACEBOOK_URL)}" rel="noopener noreferrer" target="_blank">Facebook</a>
        <span aria-hidden="true">·</span>
        <a href="/privacy">Privacy</a>
        <span class="footer-copy"><span aria-hidden="true">·</span> © ${new Date().getFullYear()} OFW Tambayan SG</span>
      </p>
    </div>
  </footer>
<script>
  (() => {
    const group = document.querySelector(".nav-group");
    const parent = group && group.querySelector(".nav-parent");
    if (!group || !parent) return;
    parent.addEventListener("click", () => {
      const open = group.classList.toggle("is-open");
      parent.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Node) || group.contains(event.target)) return;
      group.classList.remove("is-open");
      parent.setAttribute("aria-expanded", "false");
    });
  })();
</script>
</body>
</html>`;
}

export function shareButtons(shareUrl: string, shareText: string, quiet = false): string {
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const cls = quiet ? "share-row share-row-quiet" : "share-row";
  return `<div class="${cls}" role="group" aria-label="Share">
    <a class="share-link" href="${fb}" target="_blank" rel="noopener noreferrer">Share on Facebook</a>
    <span class="share-sep" aria-hidden="true">·</span>
    <a class="share-link" href="${wa}" target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
  </div>`;
}
