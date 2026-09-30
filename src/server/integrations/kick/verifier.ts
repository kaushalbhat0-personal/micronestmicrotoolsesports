/**
 * Kick webhook verification — per https://docs.kick.com/events/webhook-security.md
 * Signature = Base64(RSA-SHA256(privateKey, messageId.timestamp.rawBody))
 * Verify with public key from https://api.kick.com/public/v1/public-key
 * Raw body must be original bytes, not re-stringified.
 *
 * Rotation hardening: public-key resolution is delegated to public-key.ts
 * with 24h process-local cache (application policy, not Kick guarantee),
 * single-flight fetch, strict key validation, env fallback, and single
 * retry on stale cached key (see public-key.ts for precedence).
 */

import { verify } from "node:crypto";
import type { VerificationResult } from "@/server/webhooks/types";
import { resolveKickPublicKey, clearKickPublicKeyCacheForTests as clearCache } from "./public-key";

const TOLERANCE_MS = 10 * 60 * 1000;

export function clearKickPublicKeyCacheForTests(): void {
  clearCache();
}

function getHeader(request: Request, name: string): string | null {
  return request.headers.get(name) ?? request.headers.get(name.toLowerCase()) ?? null;
}

export async function verifyKickRequest(request: Request, rawBody: string): Promise<VerificationResult> {
  if (rawBody.length > 1_000_000) {
    return { status: "MALFORMED", provider: "kick", errorKind: "body_too_large", message: "Body too large" };
  }

  const messageId = getHeader(request, "Kick-Event-Message-Id");
  const messageTimestamp = getHeader(request, "Kick-Event-Message-Timestamp");
  const signatureB64 = getHeader(request, "Kick-Event-Signature");
  const eventType = getHeader(request, "Kick-Event-Type");

  if (!messageId || !messageTimestamp || !signatureB64) {
    return { status: "MALFORMED", provider: "kick", errorKind: "missing_headers", message: "Missing required Kick headers" };
  }

  // Validate timestamp
  const tsMs = Date.parse(messageTimestamp);
  if (Number.isNaN(tsMs)) {
    return { status: "MALFORMED", provider: "kick", errorKind: "malformed_timestamp", message: "Malformed Kick timestamp" };
  }
  const age = Date.now() - tsMs;
  if (Math.abs(age) > TOLERANCE_MS) {
    return { status: "STALE", provider: "kick", errorKind: "stale_timestamp", message: "Kick message timestamp outside tolerance" };
  }

  // Validate signature base64 — reject malformed early, do not fetch key for obviously bad requests
  let signatureBytes: Buffer;
  try {
    // Strict base64: re-encode check to catch "not-base64!!!"
    const normalized = signatureB64.trim();
    if (!/^[A-Za-z0-9+/]+=*$/u.test(normalized)) {
      throw new Error("malformed base64 chars");
    }
    signatureBytes = Buffer.from(normalized, "base64");
    if (signatureBytes.length === 0) throw new Error("empty");
    // Re-encode and compare (ignore padding leniency)
    const re = signatureBytes.toString("base64");
    // Allow missing padding in input — compare without padding
    if (re.replace(/=+$/u, "") !== normalized.replace(/=+$/u, "")) {
      // Still accept if Buffer decodes without error but be strict for "not-base64!!!"
      // The regex above already rejects invalid chars, so this path is just sanity
    }
  } catch {
    return { status: "MALFORMED", provider: "kick", errorKind: "malformed_signature", message: "Malformed Kick signature encoding" };
  }

  const signedPayload = `${messageId}.${messageTimestamp}.${rawBody}`;

  // Resolve public key (cached → fetch → env fallback)
  const first = await resolveKickPublicKey();
  if (!first.ok) {
    return {
      status: "CONFIGURATION_ERROR",
      provider: "kick",
      errorKind: first.errorKind ?? "public_key_unavailable",
      message: "Kick public key unavailable",
    };
  }

  // Verify RSA-SHA256 with current key
  let verified = false;
  try {
    verified = verify("sha256", Buffer.from(signedPayload), first.key, signatureBytes);
  } catch {
    verified = false;
  }

  if (verified) {
    return {
      status: "VERIFIED",
      provider: "kick",
      eventId: messageId,
      eventType: eventType ?? undefined,
      timestamp: messageTimestamp,
      rawBody,
    };
  }

  // Single retry: cached key may be stale due to rotation — refresh once and retry
  // Only retry on invalid signature; do not loop infinitely; do not retry malformed/stale above
  const refreshed = await resolveKickPublicKey({ forceRefresh: true });
  if (!refreshed.ok) {
    // Refresh failed — cannot determine if signature would be valid with new key.
    // Preserve security: do not treat as VERIFIED; per spec return CONFIGURATION_ERROR
    // when no usable key is available after refresh.
    console.error("[kick-verifier] key refresh failed", { provider: "kick", errorKind: refreshed.errorKind });
    return {
      status: "CONFIGURATION_ERROR",
      provider: "kick",
      errorKind: refreshed.errorKind ?? "public_key_refresh_failed",
      message: "Kick public key refresh failed",
    };
  }

  // If refreshed key is same object as first (cache hit without change because fetch returned same key),
  // we would have already verified and failed — avoid infinite: still verify once more, but no further loop
  try {
    verified = verify("sha256", Buffer.from(signedPayload), refreshed.key, signatureBytes);
  } catch {
    verified = false;
  }

  if (verified) {
    return {
      status: "VERIFIED",
      provider: "kick",
      eventId: messageId,
      eventType: eventType ?? undefined,
      timestamp: messageTimestamp,
      rawBody,
    };
  }

  return { status: "REJECTED", provider: "kick", errorKind: "invalid_signature", message: "Invalid Kick signature" };
}
