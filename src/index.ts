import { handleAdmin } from "./admin";
import { html, json } from "./helpers";
import {
  handleRegisterApi,
  renderGalleryEvent,
  renderGalleryIndex,
  renderHome,
  renderPrivacy,
  renderRegister,
  renderShorts,
  serveMedia,
} from "./public";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      // Media from R2
      if (path.startsWith("/api/media/")) {
        const key = decodeURIComponent(path.slice("/api/media/".length));
        return serveMedia(env, key);
      }

      if (path === "/api/register") return handleRegisterApi(request, env);

      // Admin page JS/CSS live under /public/admin/*. Do not send those to the
      // auth router — otherwise /admin/registrations.js is redirected/404'd and
      // the registrations table never loads.
      if (
        path.startsWith("/admin/") &&
        /\.(js|css|map|svg|png|jpe?g|webp|ico|woff2?)$/i.test(path)
      ) {
        if (env.ASSETS) {
          const asset = await env.ASSETS.fetch(request);
          if (asset.status !== 404) return asset;
        }
        return json({ error: "Not found" }, 404);
      }

      if (path.startsWith("/api/admin") || path.startsWith("/admin")) {
        return handleAdmin(request, env, path);
      }

      if (path === "/") return renderHome(request, env);
      if (path === "/register") return renderRegister(request, env);
      if (path === "/privacy") return renderPrivacy(request, env);
      if (path === "/shorts" || path === "/videos") return renderShorts(request, env);
      if (path === "/gallery") return renderGalleryIndex(request, env);

      const galleryMatch = path.match(/^\/gallery\/([^/]+)$/);
      if (galleryMatch) return renderGalleryEvent(request, env, galleryMatch[1]);

      // Health
      if (path === "/api/health") {
        return json({ ok: true, service: "ofw-tambayan" });
      }

      // Fall through to static assets (CSS/JS/SVG)
      if (env.ASSETS) {
        const asset = await env.ASSETS.fetch(request);
        if (asset.status !== 404) return asset;
      }

      return html("<!DOCTYPE html><h1>Not found</h1><p><a href='/'>Home</a></p>", 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Internal error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
