// Encrypts the synced assignments before they are committed. The repository
// is public and GitHub Pages will not serve a private one without a paid
// plan, so the file is published unreadable rather than not published.
//
// The browser half of this lives in src/lib/assignments.ts and must agree on
// every parameter below. AES-GCM in Web Crypto expects the auth tag appended
// to the ciphertext, so that is the layout written here.

import crypto from "node:crypto";

export const KDF_ITERATIONS = 210000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;

function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, KDF_ITERATIONS, KEY_BYTES, "sha256");
}

/** Wraps a JSON-serialisable value into the published envelope. */
export function encryptJson(value, passphrase) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);

  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iterations: KDF_ITERATIONS,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    // Tag appended so Web Crypto can decrypt this in one call.
    ciphertext: Buffer.concat([body, cipher.getAuthTag()]).toString("base64"),
  };
}

/** Reverses encryptJson. Throws if the passphrase is wrong or data tampered. */
export function decryptJson(envelope, passphrase) {
  const salt = Buffer.from(envelope.salt, "base64");
  const iv = Buffer.from(envelope.iv, "base64");
  const withTag = Buffer.from(envelope.ciphertext, "base64");
  const body = withTag.subarray(0, withTag.length - 16);
  const tag = withTag.subarray(withTag.length - 16);

  const key = crypto.pbkdf2Sync(
    passphrase,
    salt,
    envelope.iterations ?? KDF_ITERATIONS,
    KEY_BYTES,
    "sha256",
  );
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"),
  );
}

/** True for an envelope this module wrote, false for a plain array. */
export function isEncrypted(parsed) {
  return Boolean(parsed && !Array.isArray(parsed) && parsed.ciphertext && parsed.salt);
}

/**
 * Reads assignments whether the file is encrypted or a plain array, so a
 * missing passphrase degrades to "no assignments" rather than a crash.
 */
export function readAssignments(parsed, passphrase) {
  if (!isEncrypted(parsed)) return Array.isArray(parsed) ? parsed : [];
  if (!passphrase) {
    console.error("Assignments are encrypted but ASSIGNMENTS_PASSPHRASE is not set.");
    return [];
  }
  try {
    return decryptJson(parsed, passphrase);
  } catch {
    console.error("Could not decrypt assignments — is ASSIGNMENTS_PASSPHRASE correct?");
    return [];
  }
}
