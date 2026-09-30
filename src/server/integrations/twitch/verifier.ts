/**
 * Twitch EventSub webhook verification — per https://dev.twitch.tv/docs/eventsub/handling-webhook-events/
 * Signed message = Message-Id + Message-Timestamp + rawBody, HMAC SHA256 with secret, hex + "sha256=" prefix.
 * Raw body must be original bytes, not re-stringified JSON.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { VerificationResult } from "@/server/webhooks/types";

const TOLERANCE_MS = 10 * 60 * 1000; // 10 minutes replay protection
const HMAC_PREFIX = "sha256=";

function getSecret(): string | undefined {
  return process.env.TWITCH_EVENTSUB_SECRET;
}

function getHeader(request: Request, name: string): string | null {
  // Headers are case-insensitive; try both
  return request.headers.get(name) ?? request.headers.get(name.toLowerCase()) ?? null;
}

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function verifyTwitchRequest(request: Request, rawBody: string): Promise<VerificationResult> {
  const secret = getSecret();
  if (!secret) {
    return {
      status: "CONFIGURATION_ERROR",
      provider: "twitch",
      errorKind: "missing_secret",
      message: "Twitch EventSub secret not configured",
    };
  }

  if (rawBody.length > 1_000_000) {
    return { status: "MALFORMED", provider: "twitch", errorKind: "body_too_large", message: "Body too large" };
  }

  const messageId = getHeader(request, "Twitch-Eventsub-Message-Id");
  const messageTimestamp = getHeader(request, "Twitch-Eventsub-Message-Timestamp");
  const messageSignature = getHeader(request, "Twitch-Eventsub-Message-Signature");
  const messageType = getHeader(request, "Twitch-Eventsub-Message-Type");

  if (!messageId || !messageTimestamp || !messageSignature) {
    return { status: "MALFORMED", provider: "twitch", errorKind: "missing_headers", message: "Missing required Twitch EventSub headers" };
  }

  // Validate signature format
  if (!messageSignature.startsWith(HMAC_PREFIX) || messageSignature.length < HMAC_PREFIX.length + 10) {
    return { status: "MALFORMED", provider: "twitch", errorKind: "malformed_signature", message: "Malformed Twitch signature" };
  }

  // Replay protection: timestamp within 10 minutes
  const timestampMs = Date.parse(messageTimestamp);
  if (Number.isNaN(timestampMs)) {
    return { status: "MALFORMED", provider: "twitch", errorKind: "malformed_timestamp", message: "Malformed Twitch timestamp" };
  }
  const age = Date.now() - timestampMs;
  if (Math.abs(age) > TOLERANCE_MS) {
    return { status: "STALE", provider: "twitch", errorKind: "stale_timestamp", message: "Twitch message timestamp outside tolerance" };
  }

  // Construct signed message: id + timestamp + rawBody (exact bytes)
  const hmacMessage = messageId + messageTimestamp + rawBody;
  const expected = HMAC_PREFIX + createHmac("sha256", secret).update(hmacMessage).digest("hex");

  if (!safeCompare(expected, messageSignature)) {
    return { status: "REJECTED", provider: "twitch", errorKind: "invalid_signature", message: "Invalid Twitch signature" };
  }

  // Handle challenge, notification, revocation at verification boundary
  // All are VERIFIED if signature passes; challenge value is returned for route to echo
  let challenge: string | undefined;
  let eventType: string | undefined;
  let eventId: string | undefined;

  // Try to parse body for metadata, but do not trust it before verification (already verified)
  // Never log secret; rawBody already verified
  try {
    if (rawBody) {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      if (typeof parsed.challenge === "string") challenge = parsed.challenge;
      const sub = parsed.subscription as Record<string, unknown> | undefined;
      if (sub && typeof sub.type === "string") eventType = sub.type;
      // Always use messageId as delivery idempotency key, not subscription id
      eventId = messageId;
    }
  } catch {
    // Body may be empty for some verification flows; treat as VERIFIED but without challenge
    // Do not throw - verification already succeeded
  }

  // Distinguish message types for caller, but all are VERIFIED
  const msgType = messageType ?? "notification";

  return {
    status: "VERIFIED",
    provider: "twitch",
    eventId: eventId ?? messageId,
    eventType: eventType ?? msgType,
    timestamp: messageTimestamp,
    rawBody,
    challenge,
    messageType: msgType,
  };
}
