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

-- Example next event (last Sunday of a month)
INSERT OR IGNORE INTO events (id, slug, title, held_at)
VALUES (
  'evt-demo-001',
  '2026-03-29',
  'OFW Tambayan — March 2026',
  '2026-03-29T14:00:00+08:00'
);

UPDATE site_settings
SET
  next_event_id = 'evt-demo-001',
  announcement_title = 'Join us this month at OFW Tambayan',
  announcement_body = 'Every last Sunday, 2–4 PM at Level 1 Auditorium, 798 Thomson Road. Come for fellowship, worship, and community with fellow OFWs in Singapore.',
  location_override = 'Level 1 Auditorium, 798 Thomson Road',
  updated_at = datetime('now')
WHERE id = 1;

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
