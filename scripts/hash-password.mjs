#!/usr/bin/env node
/**
 * Generate a PBKDF2 hash suitable for the STARSHIP_PASSWORD_HASH env var.
 *
 * Usage:
 *   node scripts/hash-password.mjs '<your-password>'
 *   node scripts/hash-password.mjs           # prompts interactively
 *
 * The output has the format `pbkdf2$<iters>$<b64salt>$<b64hash>` and is
 * verified at login time by src/lib/auth/password.ts.
 */
import { webcrypto } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const subtle = webcrypto.subtle;
const ITERATIONS = 100_000;

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function deriveBits(password, salt) {
  const enc = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function main() {
  let password = process.argv[2];
  if (!password) {
    const rl = createInterface({ input, output });
    password = await rl.question("Password: ");
    rl.close();
  }
  if (!password) {
    console.error("No password provided.");
    process.exit(1);
  }
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt);
  const encoded = `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
  console.log("");
  console.log("Add this to your .env.local (and production env):");
  console.log("");
  console.log(`STARSHIP_PASSWORD_HASH=${encoded}`);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
