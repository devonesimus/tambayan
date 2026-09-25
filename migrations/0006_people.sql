-- A person stays the same across monthly Tambayans. Registrations point at them.

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  birth_date TEXT,
  joined_on TEXT,
  carer_id TEXT,
  carer_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);

ALTER TABLE registrations ADD COLUMN person_id TEXT;

CREATE INDEX IF NOT EXISTS idx_registrations_person_id ON registrations(person_id);

-- One row per existing name. Later signups with the same folded name share this person.
INSERT INTO people (id, name, mobile, email, created_at)
SELECT
  lower(hex(randomblob(16))),
  MIN(name),
  NULLIF(MAX(mobile), ''),
  MAX(email),
  MIN(created_at)
FROM registrations
GROUP BY lower(trim(name));

UPDATE registrations
SET person_id = (
  SELECT p.id FROM people p
  WHERE lower(trim(p.name)) = lower(trim(registrations.name))
  LIMIT 1
)
WHERE person_id IS NULL;

-- Admin marked these two people as different. Pairs are stored in id order.
CREATE TABLE IF NOT EXISTS person_links (
  person_a TEXT NOT NULL,
  person_b TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'distinct',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (person_a, person_b),
  CHECK (person_a < person_b)
);
