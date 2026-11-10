import type { CanonicalWebhookEvent } from "@/features/sponsor-sentinel/types/events";

export type SentinelEventCategory =
  | "STREAM_STARTED"
  | "STREAM_ENDED"
  | "STREAM_METADATA_CHANGED"
  | "CONTENT_PUBLISHED"
  | "UNSUPPORTED"
  | "IGNORED";

/**
 * Small deterministic classification for 09.
 * Maps only currently supported provider event types.
 */
export function classifyWebhookEvent(event: CanonicalWebhookEvent): SentinelEventCategory {
  const { provider, eventType } = event;
  if (provider === "twitch") {
    if (eventType === "stream.online") return "STREAM_STARTED";
    if (eventType === "stream.offline") return "STREAM_ENDED";
    if (eventType === "channel.update") return "STREAM_METADATA_CHANGED";
    return "UNSUPPORTED";
  }
  if (provider === "kick") {
    if (eventType === "livestream.status.updated") {
      // Inspect payload for is_live true/false; 08B parser stores broadcaster+is_live in raw
      const raw = event.payload as Record<string, unknown> | null;
      if (raw && typeof raw.is_live === "boolean") {
        return raw.is_live ? "STREAM_STARTED" : "STREAM_ENDED";
      }
      // Fallback: treat status.updated as start/end signal → classify as STREAM_STARTED to be safe (triggers scan)
      return "STREAM_STARTED";
    }
    if (eventType === "livestream.metadata.updated") return "STREAM_METADATA_CHANGED";
    return "UNSUPPORTED";
  }
  if (provider === "youtube") {
    if (eventType === "video_published" || eventType === "youtube.video.published") return "CONTENT_PUBLISHED";
    return "UNSUPPORTED";
  }
  return "UNSUPPORTED";
}
