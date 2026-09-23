-- Example seed data for local development.
-- Keep this file outside migrations/ so wrangler does not apply it on deploy.
-- Copy to seed.local.sql (gitignored) and fill in a real password hash.
--
-- Generate a PBKDF2 hash locally:
--   node scripts/hash-password.mjs 'YourPassword'
--   or POST /api/admin/hash-password on localhost while wrangler dev is running
--
-- Apply with:
--   npm run db:seed:local

-- Demo open event (use a future held_at so public registration stays open)
INSERT OR IGNORE INTO events (
  id, slug, title, held_at, status, address, announcement_title, announcement_body
) VALUES (
  'evt-demo-001',
  '2026-09-27',
  'OFW Tambayan — September 2026',
  '2026-09-27T14:00:00+08:00',
  'open',
  'Level 1 Main Auditorium, 798 Thomson Road, Singapore 298186',
  'Join us this Sunday at OFW Tambayan',
  'Every last Sunday, 2–4 PM. Come for fellowship, worship, and community with fellow OFWs in Singapore.'
);

-- Replace PASSWORD_HASH_HERE with output from scripts/hash-password.mjs
-- Default local password for demo: ChangeMeNow!
-- INSERT OR REPLACE INTO admin_users (email, password_hash)
-- VALUES ('admin@fsdac.app', 'PASSWORD_HASH_HERE');

INSERT OR IGNORE INTO videos (id, title, youtube_url, sort_order)
VALUES (
  'vid-demo-001',
  'Welcome to OFW Tambayan',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  0
);
