-- Binary attendance flag: 0 = not attended, 1 = attended
ALTER TABLE registrations ADD COLUMN attended INTEGER NOT NULL DEFAULT 0;
