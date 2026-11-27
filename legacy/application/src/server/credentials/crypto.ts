import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    // Deterministic dev fallback — not for production
    // Use 32 zero bytes hashed from a static string so tests work without env
    if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
      return Buffer.alloc(32, 0);
    }
    throw new Error("CREDENTIALS_ENCRYPTION_KEY not configured");
  }
  // Accept base64(32) or hex(64) or raw 32+ chars (hashed)
  let buf: Buffer;
  if (/^[A-Za-z0-9+/=]{44}$/.test(raw)) {
    buf = Buffer.from(raw, "base64");
  } else if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    buf = Buffer.from(raw, "hex");
  } else {
    // Derive 32 bytes via SHA256 of raw
    buf = createHash("sha256").update(raw).digest();
  }
  if (buf.length !== 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY must be 32 bytes");
  return buf;
}

/**
 * Authenticated encryption for organization credentials.
 * Returns iv:authTag:ciphertext base64 — never plaintext in DB.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as base64(iv|tag|ciphertext)
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString("base64");
}

export function decryptSecret(ciphertextB64: string): string {
  if (!ciphertextB64) return "";
  const key = getKey();
  const combined = Buffer.from(ciphertextB64, "base64");
  if (combined.length < IV_LEN + TAG_LEN) throw new Error("Invalid ciphertext");
  const iv = combined.subarray(0, IV_LEN);
  const tag = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = combined.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  try {
    const buf = Buffer.from(value, "base64");
    return buf.length > IV_LEN + TAG_LEN;
  } catch {
    return false;
  }
}
