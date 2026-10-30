# Cloudflare account migration plan (fsdac.app → new account)

**Status: completed 2026-10-30.** The domain, Worker and database now live in the devpinoysdasg@gmail.com account (id `8cd3fc30bb68349614e9e794a488147f`, D1 `f823a2e6-3315-4c9a-9f8d-42ea2271f4b8`). Deploys run through Cloudflare Workers Builds connected to this repo, not a GitHub Action. The text below is the original plan, kept for reference.

Scope: move everything Tambayan runs on, plus the one hard dependency it has (the Gospel Weekend Worker, `pinoy-rag-agent`), to the new Cloudflare account that will own the `fsdac.app` zone.

Nothing in this repo hardcodes an account ID. The only account-bound values are `database_id` in `wrangler.jsonc` and the two GitHub secrets. That keeps the code change small; the work is moving data and sequencing the domain.

## 0. Decisions so far (supersede anything below that conflicts)

- **Old account:** "Onesimus Account" (`52fa237ad5324dbf43a65a62bbc38dc5`), where Tambayan runs today and where `fsdac.app` is registered with Cloudflare Registrar. **New account:** devpinoysdasg@gmail.com.
- Because the domain is registered at Cloudflare Registrar, it moves with the Registrar **inter-account move** (https://developers.cloudflare.com/registrar/account-options/inter-account-transfer/), not a manual nameserver change. Both accounts must confirm. Preconditions: the domain is added to the new account as a website with a plan selected, DNSSEC is off, the registrant email is verified, no pending registrant change, registered more than 10 days ago. After the move, **all zone configuration in the old account is lost** (so export DNS first) and the registration is transfer-locked for 30 days. The new account becomes responsible for renewals.
- So the cutover order is: stage the new zone and all data in the new account first, then do the Registrar move, then attach the custom domains.
- Short maintenance window is acceptable.
- **Gospel Weekend hostname may go dark (decided 2026-10-30): skip the proxy Worker.** Messenger webhook and QR link will stop working until pinoy-rag-agent moves.
- **`pinoy-rag-agent` stays in the old account for now**, reachable on its `workers.dev` URL. It moves later, once its secrets are recovered. Consequences:
  - The `GOSPEL_WEEKEND` service binding cannot cross accounts. **Remove the `services` block from `wrangler.jsonc`** and make `src/gospel-weekend-sync.ts` a no-op when the binding is absent. The sync is already off (`gospel_weekend_date` is NULL), so nothing is lost. Restore the binding when pinoy-rag-agent joins the new account.
  - `gospelweekend.fsdac.app` is served by a custom domain on that Worker, which only works while the zone is in its account. After the zone moves, remove that custom domain in the old account and put a **small proxy Worker** on `gospelweekend.fsdac.app` in the new account that forwards requests (including the Messenger webhook and the printed QR code link) to the `workers.dev` URL. Alternative: let that hostname go dark if Gospel Weekend 2026 (Oct 8–11) traffic is truly finished; confirm the webhook and QR are no longer needed.
  - Its secrets, D1, R2, KV, Queue, cron and Vectorize stay where they are. Nothing in §1.1 about it needs doing yet.
- Workers Paid plan: recommended for the new account (see the note in the open questions).

- **Zone contents (exported 2026-10-30):** the DNS export has only the NS/SOA records and one TXT (`google-site-verification`, re-create it in the new zone). No MX, so no email. Worker custom domains don't appear in a DNS export.
- **Other Workers use `fsdac.app` hostnames and will go dark when the zone moves** unless they move too: `sis-banquet` (`sis-banquet.fsdac.app`, `sic-banquet.fsdac.app`, project `fsdac/sis-banquet-slides`), `presenter` (`presenter.fsdac.app`), `picklers` (`picklers.fsdac.app`), plus `pinoy-rag-agent` (`gospelweekend.fsdac.app`, allowed to go dark). Each has its own D1/R2/Durable Objects. **Decision (2026-10-30): all of these, and Gospel Weekend, are allowed to go dark. Only Tambayan migrates now.** Before the move, remove their custom domains (or accept that they vanish) and keep their Workers on `workers.dev` in the old account.
- **No code change needed for the missing binding:** `src/gospel-weekend-sync.ts` already returns an error (audited, never shown to guests) when `GOSPEL_WEEKEND` is absent, and only runs when an event has `gospel_weekend_date` set. Just delete the `services` block from `wrangler.jsonc` at staging time.

## 1. Inventory

### Tambayan (this repo)

| Item | Where defined | Migration method |
|---|---|---|
| Worker `ofw-tambayan` | `wrangler.jsonc` | Redeploy from repo in new account |
| D1 `tambayan-db` (id `b10b3870-…`) | `wrangler.jsonc`, `migrations/0001–0009` | Export, create new DB, import; update `database_id` |
| R2 `tambayan-gallery` | `GALLERY` binding | Object copy (rclone or Super Slurper); keys must stay identical |
| Custom domain `tambayan.fsdac.app` | `routes` | Only attachable once the zone is in the new account |
| Service binding `GOSPEL_WEEKEND` → `pinoy-rag-agent` | `services` | Target Worker must exist in the same account (see §2) |
| Secret `SESSION_SECRET` | `wrangler secret` | Cannot be read back. Generate a new one (admins re-login once, 8h TTL anyway) |
| Secret `TAMBAYAN_SYNC_TOKEN` | `wrangler secret` | Must equal the value on `pinoy-rag-agent`. Generate once, set on both |
| Plain vars (`SITE_URL`, etc.) | `wrangler.jsonc` `vars` | Travel with the repo. `SITE_URL` stays the same |
| GitHub secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | repo settings | New token and account ID |
| Admin accounts | D1 (PBKDF2 hashes) | Carried by the D1 export |

### Things not obvious from the repo

1. **`pinoy-rag-agent` has to move too.** `wrangler deploy` fails if a service-binding target does not exist in the account, even though the Oct 11 sync is currently switched off (`gospel_weekend_date` is NULL). It brings its own resources:
   - Worker + custom domain `gospelweekend.fsdac.app`
   - D1 `pinoy-rag-gospel-weekend`
   - R2 `pinoy-rag-docs` and `gospel-weekend-gallery`
   - KV `CONVERSATIONS` (id `cbea5358…`)
   - Queue `pinoy-rag-ingest` (producer and consumer), plus a daily cron
   - Vectorize index `pinoy-rag-index`. **Vectors cannot be exported.** Recreate the index (same dimensions and metric, bge-base-en-v1.5) and re-ingest from `pinoy-rag-docs` through the queue.
   - Workers AI binding (nothing to move; check the new account's plan)
   - Secrets (names from its `.dev.vars.example`): `ANTHROPIC_API_KEY`, `FB_PAGE_ACCESS_TOKEN`, `FB_VERIFY_TOKEN`, `FB_APP_SECRET`, `ADMIN_TOKEN`, `GOSPEL_WEEKEND_SCRIPT_URL`, `GOSPEL_WEEKEND_API_SECRET`, `GOSPEL_WEEKEND_ID_SECRET`, `TAMBAYAN_SYNC_TOKEN`. Values are unreadable, so recover them from their original sources (Meta dashboard, Anthropic console, Apps Script). **`GOSPEL_WEEKEND_ID_SECRET` must not change**: it derives stable IDs, so a new value would orphan existing records. Find the original, don't regenerate.
   - Its own repo's CI secrets
2. **Everything else on the `fsdac.app` zone.** The zone carries more than these two hostnames. Before moving it, list: all DNS records (the main church site, MX/SPF/DKIM/DMARC, verification TXT records), Email Routing rules, WAF/rate-limit/Page/Redirect rules, Cache and SSL/TLS settings, Turnstile widgets, Access apps, and any other Workers or Pages projects on subdomains. Export the DNS zone file as a backup.
3. **Where the domain is registered.** If it's at Cloudflare Registrar, the registration may need to move accounts too. If it's elsewhere, only the nameservers change. This decides the cutover mechanics, so please confirm.
4. **Facebook Messenger webhook.** It points at `gospelweekend.fsdac.app`. The hostname stays the same, so no change if DNS is back quickly, but verify the webhook after cutover (Meta re-verifies using `FB_VERIFY_TOKEN`).
5. **Billing and plan.** Check that the new account has a plan covering D1, R2, Queues, Vectorize and Workers AI usage, and a payment method. R2 needs it enabled.
6. **What does not migrate:** Workers observability logs and history, D1 Time Travel history, `workers.dev` subdomain (the new account has its own), and old API tokens. Anything else that uses an old-account API token (scripts, tooling) needs a new one.
7. **Local dev files:** `.wrangler/` local state is account-independent. `wrangler login` must be re-run for the new account.

## 2. Sequencing (the constraint that drives everything)

A Worker custom domain can only be attached when the zone is in the **same account** as the Worker. So Workers can be built and tested in the new account ahead of time (on `workers.dev`), but the real hostnames can only switch after the zone moves.

### Phase 0: prepare (no user impact)
- [ ] Confirm registrar and the full contents of the `fsdac.app` zone (§1.2, §1.3). Export the zone file.
- [ ] New account: enable R2, confirm plan, create an API token for CI (Workers Scripts:Edit, D1:Edit, Workers R2 Storage:Edit, Workers Routes:Edit on the zone, Account Settings:Read). The Workers Routes permission also fixes the always-red deploy run noted in the deploy-pipeline memory.
- [ ] Create R2 S3 API tokens in **both** accounts for the copy.
- [ ] Collect every secret value for both Workers from their original sources.

### Phase 1: stage in the new account (still on old domain)
- [ ] `wrangler login` to the new account. Create D1 `tambayan-db`, R2 `tambayan-gallery`, and the pinoy-rag-agent resources.
- [ ] Copy data (rehearsal; repeat in Phase 3 for the final delta):
  ```bash
  npx wrangler d1 export tambayan-db --remote --output=tambayan.sql     # old account
  npx wrangler d1 execute tambayan-db --remote --file=tambayan.sql      # new account
  rclone sync old:tambayan-gallery new:tambayan-gallery                 # R2 via S3 API
  ```
  Repeat for the pinoy-rag D1, both its R2 buckets, and the KV namespace. Re-create Vectorize and run ingest.
- [ ] Update `wrangler.jsonc` `database_id` for the new D1 (do not push to `main` yet, since pushing deploys to the old account's secrets). For staging, deploy with the `routes` block temporarily removed so it lands on `workers.dev`.
- [ ] Set secrets. Set the same `TAMBAYAN_SYNC_TOKEN` on both Workers.
- [ ] Verify via the real UI on the `workers.dev` URL: home page, registration, admin login, gallery photos render, upload a test photo, an edit saves. Verify D1 row counts match the old DB and R2 object counts and total bytes match.
- [ ] Test the service binding with a throwaway event that has `gospel_weekend_date` set.

### Phase 2: cutover (announce a short maintenance window; this is the only downtime)
- [ ] Pause writes: tell admins to stop, and note any registrations arriving in the window.
- [ ] Turn off DNSSEC at the registrar/old zone if enabled (a stale DS record breaks resolution after NS change).
- [ ] Remove the custom domains from both old Workers.
- [ ] Remove the zone from the old account, add it to the new account, import DNS records, compare against the exported zone file, and update nameservers at the registrar to the new account's pair (or transfer the registration). Wait for the zone to show Active.
- [ ] Final delta copy of D1 and R2 (they were live during the rehearsal).
- [ ] Restore the `routes` block, update CI secrets in both GitHub repos, and deploy both Workers in the new account. Custom domains attach and certificates issue.
- [ ] Re-enable DNSSEC if it was on (new DS record at the registrar).

### Phase 3: verify
- [ ] `tambayan.fsdac.app` and `gospelweekend.fsdac.app` serve from the new account (check a response header or a new deploy marker, not just that it loads).
- [ ] Full UI round trip on both, including admin login, registration, gallery, People, Activity. Test Messenger webhook and the cron/queue on Gospel Weekend.
- [ ] A push to `main` deploys from CI against the new account.
- [ ] The other `fsdac.app` hostnames and email (MX) still work.

### Phase 4: cleanup (after 1–2 weeks)
- [ ] Keep the old D1, R2, KV and Workers untouched as the rollback until then, then delete.
- [ ] Revoke old API tokens and GitHub secrets.
- [ ] Update `README.md` (it says resources are provisioned "for this account") and the memory notes.

## 3. Rollback
Before the NS change, nothing is irreversible: abort and the old account keeps serving. After it, rollback means moving the zone back (same steps in reverse), which is why the old resources stay intact for two weeks. Registrations taken in the new account after cutover would need copying back, so keep the window short.

## 4. Code changes needed (small)
- `wrangler.jsonc`: new `database_id`. Bucket and service names can stay the same if the new resources use the same names.
- Nothing else in `src/`: URLs are hostnames, not account-bound.

## 5. Open questions
1. ~~Registrar~~ Onesimus account. Answered.
2. What else lives on the zone (main site, email, other subdomains)? Still open; needs a look at the DNS tab.
3. Paid plan: Workers Paid ($5/mo) recommended. Admin login uses PBKDF2, and the Free plan's 10 ms CPU limit can kill it (error 1102). Check whether the old account is on paid. The zone itself can stay on the Free plan.
4. ~~Maintenance window~~ Acceptable. Answered.
5. ~~pinoy-rag-agent secrets~~ Deferred until that Worker moves.
6. Is the Gospel Weekend QR/Messenger webhook still needed after Oct 11? Decides proxy Worker vs. letting the hostname go dark.
