import type { CanonicalWebhookEvent, ParsedEvent } from "@/features/sponsor-sentinel/types/events";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { VerificationResult } from "@/server/webhooks/types";

/**
 * Twitch EventSub parser — only after 08A verification.
 * Implements Sentinel-relevant types: stream.online, stream.offline, channel.update.
 * Uses verified messageId as externalEventId (broadcaster_id is NOT idempotency key).
 * Handles webhook_callback_verification (challenge) and revocation as non-persisted control messages.
 */
const SENTINEL_TWITCH_TYPES = new Set(["stream.online", "stream.offline", "channel.update"]);

export interface TwitchParsed extends ParsedEvent {
  readonly subscriptionId?: string | undefined;
  readonly messageType: string;
}

export function parseTwitchEvent(
  rawBody: string,
  verified: VerificationResult,
  headers: Headers,
): { kind: "challenge"; challenge: string } | { kind: "revocation"; reason: string } | { kind: "notification"; parsed: TwitchParsed; canonical: CanonicalWebhookEvent } {
  if (verified.status !== "VERIFIED" || verified.provider !== "twitch") {
    throw new Error("twitch parser called without verified twitch result");
  }
  // Challenge path — do not persist
  if (verified.challenge) {
    return { kind: "challenge", challenge: verified.challenge };
  }
  if (verified.messageType === "revocation") {
    return { kind: "revocation", reason: verified.eventType ?? "revocation" };
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new Error("malformed twitch payload: invalid JSON");
  }
  const subscription = json.subscription as Record<string, unknown> | undefined;
  const event = json.event as Record<string, unknown> | undefined;

  if (!subscription || typeof subscription.type !== "string") {
    throw new Error("malformed twitch payload: missing subscription.type");
  }
  const eventType = subscription.type as string;
  const subscriptionId = typeof subscription.id === "string" ? subscription.id : undefined;
  const version = typeof subscription.version === "string" ? subscription.version : "1";

  // Extract broadcaster identity — Sentinel tenant key
  let externalChannelId: string | null = null;
  let externalContentId: string | null = null;
  if (event) {
    if (typeof event.broadcaster_user_id === "string") externalChannelId = event.broadcaster_user_id;
    else if (typeof (event as Record<string, unknown>).broadcaster_user_id === "string") externalChannelId = event.broadcaster_user_id as string;
    // For stream events, event.id is stream id; for channel.update no id
    if (typeof event.id === "string") externalContentId = event.id;
  }
  // Fallback: condition broadcaster_user_id from subscription
  if (!externalChannelId) {
    const cond = subscription.condition as Record<string, unknown> | undefined;
    if (cond && typeof cond.broadcaster_user_id === "string") externalChannelId = cond.broadcaster_user_id;
  }

  const externalEventId = headers.get("Twitch-Eventsub-Message-Id") ?? headers.get("twitch-eventsub-message-id") ?? verified.eventId ?? "";
  if (!externalEventId) throw new Error("missing twitch message id");

  const occurredAt = verified.timestamp ?? new Date().toISOString();
  const receivedAt = new Date().toISOString();

  const parsed: TwitchParsed = {
    provider: "twitch" as Platform,
    type: eventType,
    externalChannelId,
    externalContentId,
    timestamp: occurredAt,
    raw: json,
    subscriptionId,
    messageType: verified.messageType ?? "notification",
  };

  const canonical: CanonicalWebhookEvent = {
    provider: "twitch",
    externalEventId,
    eventType,
    eventVersion: version,
    occurredAt,
    receivedAt,
    externalChannelId,
    externalContentId,
    payload: sanitizeTwitchPayload(json),
    metadata: {
      subscriptionId,
      messageId: externalEventId,
      messageType: verified.messageType ?? "notification",
    },
  };

  return { kind: "notification", parsed, canonical };
}

function sanitizeTwitchPayload(json: Record<string, unknown>): unknown {
  // Store raw provider payload without secrets — strip transport.secret if present
  const copy = { ...json };
  const sub = copy.subscription as Record<string, unknown> | undefined;
  if (sub) {
    const subCopy = { ...sub };
    if (subCopy.transport) {
      const t = subCopy.transport as Record<string, unknown>;
      const { secret: _secret, ...rest } = t;
      void _secret;
      subCopy.transport = rest;
    }
    copy.subscription = subCopy;
  }
  return copy;
}

export function isSentinelRelevantTwitchType(type: string): boolean {
  return SENTINEL_TWITCH_TYPES.has(type);
}
