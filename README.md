# OFW Tambayan SG

Fellowship site for **OFW Tambayan Singapore** — announcement, registration, gallery, and YouTube shorts — on a Cloudflare Worker at [tambayan.fsdac.app](https://tambayan.fsdac.app).

Every last Sunday, **2–4 PM**, **Level 1 Main Auditorium, 798 Thomson Road, Singapore 298186**.  
Facebook: [OFW Tambayan SG](https://www.facebook.com/p/OFW-Tambayan-SG-61571932246535/)

## Stack

| Piece | Role |
| --- | --- |
| Cloudflare Worker + `public/` assets | HTML routes, APIs, static CSS/JS (`wrangler` `assets.directory`) |
| D1 (`tambayan-db`) | Events (status/venue/announcement), registrations, admins, gallery metadata, videos |
| R2 (`tambayan-gallery`) | Gallery images |
| YouTube embeds | Shorts player (no Cloudflare Stream in v1) |

Patterns adapted from Gospel Weekend in [pinoy-rag-agent](https://github.com/devonesimus/pinoy-rag-agent) (auth, registrations UI, privacy, wrangler/CI). RAG / Messenger / Vectorize / Workers AI are intentionally **not** included.

## Local development

Requirements: Node 22+, npm.

```bash
npm install
cp .dev.vars.example .dev.vars   # set SESSION_SECRET
npm run db:migrate:local
```

Seed local demo data + an admin (gitignored seed file):

```bash
# 1) Generate a password hash
node scripts/hash-password.mjs 'ChangeMeNow!'

# 2) Copy the example and paste the hash into an INSERT for admin_users
cp seeds/seed.example.sql seeds/seed.local.sql
# edit seeds/seed.local.sql

npm run db:seed:local
```

Start the Worker on an uncommon port:

```bash
npm run dev
# → http://127.0.0.1:43123
```

Useful paths:

- `/` — open-event hero + static Latest row (no carousel)
- `/register` — open only when an event is `open` and not past `held_at`; otherwise closed state
- `/privacy`
- `/gallery`, `/gallery/:eventSlug` — non-draft events
- `/shorts`
- `/admin/login` — seeded admins only
- `/admin/events` — create/edit, force close/reopen (one public `open` at a time)
- `/admin/registrations` — list/export + add guest for any event (incl. closed)

### Registration close rule

**Both:** public registration soft-closes after `held_at`, and admins can force close or reopen via event status (`draft` | `open` | `closed`).

## Deploy (production)

Cloudflare resources are provisioned for this account:

- D1 `tambayan-db` (id in `wrangler.jsonc`)
- R2 `tambayan-gallery`
- Worker custom domain / route for `tambayan.fsdac.app` — **DNS still needs Adrian** if the API token lacks Zone DNS write (hostname may not resolve until a proxied record exists, same as Gospel Weekend setup)

Then:

1. `wrangler secret put SESSION_SECRET` (from `.dev.vars` locally)
2. `npm run db:migrate:remote`
3. Seed admins: `wrangler d1 execute tambayan-db --remote --file=./seeds/seed.local.sql`
4. `npm run deploy`  
   Or push to `main` — GitHub Action `.github/workflows/deploy.yml` uses:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

## Admin model

A few seeded email/password admins (PBKDF2 hashes in D1). Cookie session is HMAC-signed with `SESSION_SECRET`, **8 hour** TTL. No invites, roles, or SSO in v1. Gallery uploads work as soon as an event exists (any status).

## Design

Interim clean visual system in `public/styles.css`. Canva exports go in `design/` ([Canva link](https://canva.link/6zfxz0pq79cb6hs)) when ready — do not block shipping on them.

## Monthly cost (ballpark)

Without Cloudflare Stream (YouTube embeds for shorts): **~$0–5/mo** incremental on a typical Workers + D1 + light R2 footprint (often within free/included tiers depending on account and traffic).

If Stream is added later with modest viewership: roughly **~$5–60/mo**.

## License

Private / organizational use for FSDAC ministry sites unless otherwise noted.
