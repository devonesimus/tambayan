-- Event-gated registration: status, venue, announcement on event; admin registration source

ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE events ADD COLUMN address TEXT NOT NULL DEFAULT 'Level 1 Main Auditorium, 798 Thomson Road, Singapore 298186';
ALTER TABLE events ADD COLUMN announcement_title TEXT;
ALTER TABLE events ADD COLUMN announcement_body TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_events_status_held_at ON events(status, held_at);

-- Rebuild registrations so privacy_policy_agreed_at can be null for admin-added guests
CREATE TABLE registrations_new (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  mobile TEXT NOT NULL,
  privacy_policy_agreed_at TEXT,
  source TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

INSERT INTO registrations_new (id, event_id, name, email, mobile, privacy_policy_agreed_at, source, created_at)
SELECT id, event_id, name, email, mobile, privacy_policy_agreed_at, 'public', created_at
FROM registrations;

DROP TABLE registrations;
ALTER TABLE registrations_new RENAME TO registrations;

CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at);
CREATE INDEX IF NOT EXISTS idx_registrations_name ON registrations(name);
