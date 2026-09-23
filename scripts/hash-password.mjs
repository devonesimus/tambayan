#!/usr/bin/env node
/**
 * Generate a PBKDF2 password hash for admin seed SQL.
 * Usage: node scripts/hash-password.mjs 'YourPassword'
 *
 * Uses the same parameters as src/admin-auth.ts (100k iterations, SHA-256).
 */
import { webcrypto } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs '<password>'");
  process.exit(1);
}

const ITERATIONS = 100_000;

function b64url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const salt = webcrypto.getRandomValues(new Uint8Array(16));
const keyMaterial = await webcrypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"],
);
const bits = await webcrypto.subtle.deriveBits(
  { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
  keyMaterial,
  256,
);

const hash = `pbkdf2$${ITERATIONS}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
console.log(hash);
