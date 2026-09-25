-- First sign-in must replace the seeded password before the rest of admin opens.

ALTER TABLE admin_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1;
