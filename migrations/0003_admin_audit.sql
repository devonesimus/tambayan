-- Necessary admin audit: sign-in and changes only. No page views or searches.

CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit(created_at);
