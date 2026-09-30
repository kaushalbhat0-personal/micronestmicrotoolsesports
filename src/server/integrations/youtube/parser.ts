import type { CanonicalWebhookEvent, ParsedEvent } from "@/features/sponsor-sentinel/types/events";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { VerificationResult } from "@/server/webhooks/types";

/**
 * YouTube PubSubHubbub Atom parser — only after 08A verification (verify_token + topic + Atom valid).
 * Extraction per https://developers.google.com/youtube/v3/guides/push_notifications
 * Atom <entry> contains <yt:videoId>, <yt:channelId>, <title>, <published>, <updated>, <author><uri>.
 *
 * Identity: yt:videoId is extracted as event identity, but documented limitation:
 *   yt:videoId is NOT a unique delivery ID — multiple notifications for same video share same ID,
 *   so idempotency on (provider, external_event_id) may collapse distinct deliveries.
 *   Per spec, we document this and use videoId as externalEventId where existing schema expects
 *   provider_event_id uniqueness. If schema cannot represent delivery identity, we report limitation
 *   via `metadata.deliveryCollapsed=true`.
 */

export interface YouTubeParsed extends ParsedEvent {
  readonly channelIdAtom: string | null;
  readonly videoId: string | null;
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i");
  const m = xml.match(re);
  return m?.[1]?.trim() ?? null;
}

export function parseYouTubeAtom(
  rawBody: string,
  verified: VerificationResult,
): { parsed: YouTubeParsed; canonical: CanonicalWebhookEvent } | { kind: "challenge"; challenge: string } {
  if (verified.status !== "VERIFIED" || verified.provider !== "youtube") {
    throw new Error("youtube parser called without verified youtube result");
  }
  if (verified.challenge) {
    return { kind: "challenge", challenge: verified.challenge };
  }
  if (!rawBody || rawBody.trim().length === 0) throw new Error("malformed youtube payload: empty body");

  // Basic XML checks already done in verifier; re-validate
  if (!rawBody.includes("<entry") && !rawBody.includes("<feed")) {
    throw new Error("malformed youtube payload: missing Atom entry");
  }

  const videoId = extractTag(rawBody, "yt:videoId");
  const channelId = extractTag(rawBody, "yt:channelId");
  // Also support plain <id> yt:video:VIDEOID? prefer yt:videoId
  const title = extractTag(rawBody, "title");
  const published = extractTag(rawBody, "published");
  const updated = extractTag(rawBody, "updated");

  if (!videoId) throw new Error("malformed youtube payload: missing yt:videoId");

  const occurredAt = published ?? updated ?? new Date().toISOString();
  const receivedAt = new Date().toISOString();
  // Use yt:channelId as tenant key — required for connected_channels lookup
  const externalChannelId = channelId ?? null;

  const eventType = verified.eventType ?? "video_published";
  const parsed: YouTubeParsed = {
    provider: "youtube" as Platform,
    type: eventType,
    externalChannelId,
    externalContentId: videoId,
    timestamp: occurredAt,
    raw: { videoId, channelId, title, published, updated },
    channelIdAtom: channelId,
    videoId,
  };

  const canonical: CanonicalWebhookEvent = {
    provider: "youtube",
    externalEventId: videoId,
    eventType,
    occurredAt,
    receivedAt,
    externalChannelId,
    externalContentId: videoId,
    payload: { videoId, channelId, title, published, updated, rawAtomSnippet: rawBody.slice(0, 2000) },
    metadata: {
      deliveryCollapsed: true, // yt:videoId is not unique per delivery
      warning: "yt:videoId is content ID, not delivery ID; duplicate notifications for same video will be idempotent",
      title: title ?? undefined,
    },
  };

  return { parsed, canonical };
}
