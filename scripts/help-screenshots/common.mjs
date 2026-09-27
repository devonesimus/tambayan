// Shared paths and helpers for the Help page screenshot tooling.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Everything generated for the demo lives here. `.wrangler/` is gitignored. */
export const STATE_DIR = path.join(ROOT, ".wrangler/help-demo");
export const PERSIST = path.join(STATE_DIR, "state");
export const PHOTOS = path.join(STATE_DIR, "photos");
export const META = path.join(STATE_DIR, "meta.json");
export const SEED_ADMIN = path.join(ROOT, "seeds/help-demo-admin.local.sql");
export const OUT = path.join(ROOT, "public/help");
export const PORT = 43124;
export const BASE = `http://localhost:${PORT}`;

/** Run a wrangler D1 command against the demo database, never the real one. */
function d1(args) {
  return execFileSync("npx", ["wrangler", "d1", ...args, "--local", "--persist-to", PERSIST], { cwd: ROOT, stdio: "pipe" }).toString();
}
export const d1Migrate = () => d1(["migrations", "apply", "tambayan-db"]);
export const d1File = (file) => d1(["execute", "tambayan-db", `--file=${file}`]);
export const d1Sql = (sql) => d1(["execute", "tambayan-db", "--command", sql]);

/** The two test logins, read from the gitignored seed file that setup.mjs writes. */
export function creds(which = 1) {
  if (!fs.existsSync(SEED_ADMIN)) throw new Error("Run `npm run help:demo:setup` first.");
  const text = fs.readFileSync(SEED_ADMIN, "utf8");
  const email = which === 1 ? "admin@example.com" : "new.volunteer@example.com";
  const match = text.match(new RegExp(`${email.replace(".", "\\.")} password: (\\S+)`));
  if (!match) throw new Error(`No password for ${email} in ${SEED_ADMIN}`);
  return { email, password: match[1] };
}

export const readMeta = () => {
  if (!fs.existsSync(META)) throw new Error("Run `npm run help:demo:setup` first.");
  return JSON.parse(fs.readFileSync(META, "utf8"));
};
