import type { CanonicalWebhookEvent, ParsedEvent } from "@/features/sponsor-sentinel/types/events";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { VerificationResult } from "@/server/webhooks/types";

/**
 * Kick parser — only after RSA verification (08A).
 * Uses Kick-Event-Message-Id as stable externalEventId (ULID).
 * Relevant Sentinel types: livestream.metadata.updated, livestream.status.updated
 * Other types are parsed but marked as non-relevant (still persisted if tenant mapped? persisted but ingestor may ignore).
 */

const SENTINEL_KICK_TYPES = new Set(["livestream.metadata.updated", "livestream.status.updated"]);

export interface KickParsed extends ParsedEvent {
  readonly subscriptionId: string | null;
  readonly eventVersion: string | null;
}

export function parseKickEvent(
  rawBody: string,
  verified: VerificationResult,
  headers: Headers,
): { parsed: KickParsed; canonical: CanonicalWebhookEvent } {
  if (verified.status !== "VERIFIED" || verified.provider !== "kick") {
    throw new Error("kick parser called without verified kick result");
  }
  const messageId = headers.get("Kick-Event-Message-Id") ?? headers.get("kick-event-message-id") ?? verified.eventId ?? "";
  const subscriptionId = headers.get("Kick-Event-Subscription-Id") ?? headers.get("kick-event-subscription-id") ?? null;
  const eventType = headers.get("Kick-Event-Type") ?? headers.get("kick-event-type") ?? verified.eventType ?? "";
  const eventVersion = headers.get("Kick-Event-Version") ?? headers.get("kick-event-version") ?? null;
  const timestamp = headers.get("Kick-Event-Message-Timestamp") ?? headers.get("kick-event-message-timestamp") ?? verified.timestamp ?? new Date().toISOString();

  if (!messageId) throw new Error("missing kick message id");
  if (!eventType) throw new Error("missing kick event type");

  let json: unknown = null;
  if (rawBody && rawBody.trim().length > 0) {
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new Error("malformed kick payload: invalid JSON");
    }
  }

  // Extract broadcaster identity for tenant resolution
  let externalChannelId: string | null = null;
  const externalContentId: string | null = null;
  if (json && typeof json === "object" && json !== null) {
    const obj = json as Record<string, unknown>;
    const broadcaster = obj.broadcaster as Record<string, unknown> | undefined;
    if (broadcaster) {
      if (typeof broadcaster.user_id === "number") externalChannelId = String(broadcaster.user_id);
      else if (typeof broadcaster.user_id === "string") externalChannelId = broadcaster.user_id;
      else if (typeof broadcaster.broadcaster_user_id === "string") externalChannelId = broadcaster.broadcaster_user_id as string;
    }
    // For metadata events, no stream id in payload — use messageId as content fallback
    // but keep externalChannelId as tenant key
  }

  const externalEventId = messageId;
  const receivedAt = new Date().toISOString();

  const parsed: KickParsed = {
    provider: "kick" as Platform,
    type: eventType,
    externalChannelId,
    externalContentId,
    timestamp,
    raw: json,
    subscriptionId,
    eventVersion,
  };

  const canonical: CanonicalWebhookEvent = {
    provider: "kick",
    externalEventId,
    eventType,
    eventVersion: eventVersion ?? undefined,
    occurredAt: timestamp,
    receivedAt,
    externalChannelId,
    externalContentId,
    payload: json,
    metadata: {
      subscriptionId,
      messageId,
      eventVersion: eventVersion ?? undefined,
    },
  };

  return { parsed, canonical };
}

export function isSentinelRelevantKickType(type: string): boolean {
  return SENTINEL_KICK_TYPES.has(type);
}
