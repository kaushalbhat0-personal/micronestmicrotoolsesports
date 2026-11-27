import { randomBytes, createHash } from "node:crypto";

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Generate a PKCE code_verifier.
 * RFC 7636: 43-128 chars, charset [A-Za-z0-9-._~], we use base64url random 32 bytes => 43 chars.
 */
export function generateVerifier(): string {
  // 32 bytes => 43 base64url chars (ceil(32*4/3) without padding)
  return base64urlEncode(randomBytes(32));
}

/**
 * S256 code_challenge = base64url(SHA256(verifier))
 */
export function generateChallenge(verifier: string): string {
  if (!verifier || verifier.length < 43 || verifier.length > 128) {
    throw new Error("Invalid verifier length");
  }
  const hash = createHash("sha256").update(verifier).digest();
  return base64urlEncode(hash);
}

export function validateVerifierFormat(verifier: string): boolean {
  return typeof verifier === "string" && verifier.length >= 43 && verifier.length <= 128 && /^[A-Za-z0-9\-._~]+$/.test(verifier);
}
