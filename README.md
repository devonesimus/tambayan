# OFW Tambayan SG

Fellowship site for **OFW Tambayan Singapore** — announcement, registration, gallery, and YouTube shorts — on a Cloudflare Worker at [tambayan.fsdac.app](https://tambayan.fsdac.app).

Every last Sunday, **2–4 PM**, Level 1 Auditorium, **798 Thomson Road**.  
Facebook: [OFW Tambayan SG](https://www.facebook.com/p/OFW-Tambayan-SG-61571932246535/)

## Stack

| Piece | Role |
| --- | --- |
| Cloudflare Worker + `public/` assets | HTML routes, APIs, static CSS/JS (`wrangler` `assets.directory`) |
| D1 | Events, announcement, registrations, admins, gallery metadata, videos |
| R2 | Gallery images |
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

- `/` — announcement + CTA
- `/register` — Name (required), Email (optional), Mobile, privacy checkbox
- `/privacy`
- `/gallery`, `/gallery/:eventSlug`
- `/shorts`
- `/admin/login` — seeded admins only

## Deploy (production)

1. Create Cloudflare resources (one-time):
   - D1 database named `tambayan-db` → put the real `database_id` in `wrangler.jsonc`
   - R2 bucket `tambayan-gallery`
   - Custom domain / route `tambayan.fsdac.app/*` on zone `fsdac.app` (DNS CNAME / Worker route)
2. Set Worker secret: `wrangler secret put SESSION_SECRET`
3. Apply migrations: `npm run db:migrate:remote`
4. Seed admins remotely with a private SQL file (never commit hashes you care about):  
   `wrangler d1 execute tambayan-db --remote --file=./seeds/seed.local.sql`
5. Deploy: `npm run deploy`  
   Or push to `main` — GitHub Action `.github/workflows/deploy.yml` runs `wrangler deploy` using secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

Until DNS and the real D1 id/token are provisioned, local `wrangler dev` is the runnable path.

## Admin model

A few seeded email/password admins (PBKDF2 hashes in D1). Cookie session is HMAC-signed with `SESSION_SECRET`, **8 hour** TTL. No invites, roles, or SSO in v1.

## Design

Interim clean visual system in `public/styles.css`. Canva exports go in `design/` ([Canva link](https://canva.link/6zfxz0pq79cb6hs)) when ready — do not block shipping on them.

## Monthly cost (ballpark)

Without Cloudflare Stream (YouTube embeds for shorts): **~$0–5/mo** incremental on a typical Workers + D1 + light R2 footprint (often within free/included tiers depending on account and traffic).

If Stream is added later with modest viewership: roughly **~$5–60/mo**.

## License

Private / organizational use for FSDAC ministry sites unless otherwise noted.
