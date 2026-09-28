/* Generated env types for OFW Tambayan Worker */

interface Env {
  DB: D1Database;
  GALLERY: R2Bucket;
  ASSETS: Fetcher;
  SESSION_SECRET: string;
  SITE_NAME: string;
  SITE_URL: string;
  FACEBOOK_URL: string;
  DEFAULT_LOCATION: string;
  // Service Binding to the Gospel Weekend Worker (pinoy-rag-agent). Shares Cloudflare's internal
  // network, not the public internet — see src/gospel-weekend-sync.ts.
  GOSPEL_WEEKEND: Fetcher;
  // Shared with that Worker's TAMBAYAN_SYNC_TOKEN; must be the same value in both.
  TAMBAYAN_SYNC_TOKEN: string;
}
