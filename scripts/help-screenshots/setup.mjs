// Prepare the demo database: migrations, fake data, test admin logins, stand-in photos.
// Safe to run again. It only ever touches .wrangler/help-demo, never your normal local data or production.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PERSIST, PHOTOS, ROOT, SEED_ADMIN, STATE_DIR, d1File, d1Migrate } from "./common.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(STATE_DIR, { recursive: true });

console.log("Applying migrations to the demo database…");
d1Migrate();

console.log("Generating demo data…");
execFileSync("node", [path.join(here, "demo-data.mjs")], { stdio: "inherit" });
d1File(path.join(STATE_DIR, "demo-data.sql"));

if (!fs.existsSync(SEED_ADMIN)) {
  console.log("Creating test admin logins (kept in a gitignored file)…");
  const hash = (pw) => execFileSync("node", [path.join(ROOT, "scripts/hash-password.mjs"), pw]).toString().trim();
  const p1 = crypto.randomBytes(9).toString("base64url");
  const p2 = crypto.randomBytes(9).toString("base64url");
  fs.writeFileSync(
    SEED_ADMIN,
    `-- Test logins for the Help screenshot demo database only. Never used on production.
-- admin@example.com password: ${p1}
-- new.volunteer@example.com password: ${p2}  (must change password on first sign-in)
INSERT OR REPLACE INTO admin_users (email, password_hash, must_change_password) VALUES ('admin@example.com', '${hash(p1)}', 0);
INSERT OR REPLACE INTO admin_users (email, password_hash, must_change_password) VALUES ('new.volunteer@example.com', '${hash(p2)}', 1);
`,
  );
}
d1File(SEED_ADMIN);

console.log("Making stand-in photos…");
execFileSync("python3", [path.join(here, "make-photos.py"), PHOTOS], { stdio: "inherit" });
console.log(`Done. Database: ${PERSIST}\nNext: npm run help:demo (leave it running), then npm run help:shots`);
