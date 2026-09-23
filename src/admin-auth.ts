/**
 * Admin auth — PBKDF2 password hashes + HMAC-signed cookie sessions (8h TTL).
 * Pattern adapted from Gospel Weekend (pinoy-rag-agent) without RAG/Messenger.
 */

const SESSION_COOKIE = "tambayan_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 100_000;

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(sig);
}

export async function hashPassword(password: string, salt?: Uint8Array): Promise<string> {
  const saltBytes = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(saltBytes)}$${b64url(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = fromB64url(parts[2]);
  const expected = parts[3];
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  const actual = b64url(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

type SessionPayload = { email: string; exp: number };

function cookieFlags(secure: boolean): string {
  return `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export async function createSessionCookie(
  email: string,
  secret: string,
  secure = true,
): Promise<string> {
  const payload: SessionPayload = {
    email: email.toLowerCase(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await sign(secret, body);
  const value = `${body}.${sig}`;
  return `${SESSION_COOKIE}=${value}; ${cookieFlags(secure)}; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearSessionCookie(secure = true): string {
  return `${SESSION_COOKIE}=; ${cookieFlags(secure)}; Max-Age=0`;
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

export async function readSession(
  request: Request,
  secret: string,
): Promise<{ email: string } | null> {
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = await sign(secret, body);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const json = new TextDecoder().decode(fromB64url(body));
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload.email || !payload.exp || Date.now() > payload.exp) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export async function requireAdmin(
  request: Request,
  env: Env,
): Promise<{ email: string } | Response> {
  if (!env.SESSION_SECRET) {
    return new Response("SESSION_SECRET is not configured", { status: 500 });
  }
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) {
    return Response.redirect(new URL("/admin/login", request.url).toString(), 302);
  }
  const user = await env.DB.prepare("SELECT email FROM admin_users WHERE email = ?")
    .bind(session.email)
    .first<{ email: string }>();
  if (!user) {
    const secure = new URL(request.url).protocol === "https:";
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Set-Cookie": clearSessionCookie(secure) },
    });
  }
  return { email: user.email };
}
