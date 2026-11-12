import type { CanonicalLiveStream, CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { ParsedEvent } from "@/features/sponsor-sentinel/types/events";

/**
 * Normalizer for webhook events — maps provider ParsedEvent → canonical live/video
 * without duplicating scanner provider fetch logic (no external API calls).
 * Returns null for unsupported/irrelevant event types (still persisted but not ingested as evidence).
 */
export async function normalizeWebhookEvent(parsed: ParsedEvent): Promise<CanonicalLiveStream | CanonicalVideo | null> {
  const type = parsed.type;
  const provider = parsed.provider;

  // Twitch — relevant: stream.online, stream.offline, channel.update
  if (provider === "twitch") {
    if (type === "stream.online" || type === "stream.offline" || type === "channel.update") {
      const raw = parsed.raw as Record<string, unknown>;
      const event = (raw.event as Record<string, unknown> | undefined) ?? raw;
      const title = (event.title as string) ?? (raw.event as Record<string, unknown> | undefined)?.title as string | undefined ?? "Untitled";
      const channelId = parsed.externalChannelId ?? "unknown";
      const handle = (event.broadcaster_user_login as string) ?? (event.broadcaster_user_name as string) ?? channelId;
      return {
        platform: "twitch",
        externalStreamId: parsed.externalContentId ?? channelId,
        externalChannelId: channelId,
        channelHandle: handle,
        title,
        category: null,
        tags: [],
        startedAt: parsed.timestamp,
        observedAt: new Date().toISOString(),
        canonicalUrl: `https://twitch.tv/${handle}`,
        isLive: type === "stream.online",
        description: null,
      } as CanonicalLiveStream;
    }
    return null;
  }

  // Kick — relevant: livestream.metadata.updated, livestream.status.updated
  if (provider === "kick") {
    if (type === "livestream.metadata.updated" || type === "livestream.status.updated") {
      const raw = parsed.raw as Record<string, unknown> | null;
      const broadcaster = (raw?.broadcaster as Record<string, unknown> | undefined) ?? null;
      const metadata = (raw?.metadata as Record<string, unknown> | undefined) ?? null;
      const title = (metadata?.title as string) ?? "Untitled";
      const channelId = parsed.externalChannelId ?? (broadcaster?.user_id ? String(broadcaster.user_id) : "unknown");
      const slug = (broadcaster?.channel_slug as string) ?? channelId;
      const category = metadata?.category as Record<string, unknown> | undefined;
      return {
        platform: "kick",
        externalStreamId: channelId,
        externalChannelId: channelId,
        channelHandle: slug,
        title,
        category: category ? { id: String(category.id ?? ""), name: String(category.name ?? ""), platform: "kick" } : null,
        tags: [],
        startedAt: parsed.timestamp,
        observedAt: new Date().toISOString(),
        canonicalUrl: `https://kick.com/${slug}`,
        isLive: true,
        description: null,
      } as CanonicalLiveStream;
    }
    return null;
  }

  // YouTube — Atom video_published: map to CanonicalVideo (hint, not proof)
  if (provider === "youtube") {
    if (type === "video_published" || type === "youtube.video.published") {
      const raw = parsed.raw as Record<string, unknown> | null;
      const videoId = parsed.externalContentId ?? "unknown";
      const channelId = parsed.externalChannelId ?? "unknown";
      const title = (raw?.title as string) ?? videoId;
      return {
        platform: "youtube",
        externalVideoId: videoId,
        externalChannelId: channelId,
        channelHandle: channelId,
        title,
        description: null,
        category: null,
        tags: [],
        startedAt: parsed.timestamp,
        publishedAt: parsed.timestamp,
        endedAt: null,
        durationSeconds: null,
        canonicalUrl: `https://youtube.com/watch?v=${videoId}`,
        observedAt: new Date().toISOString(),
        viewable: null,
      } as CanonicalVideo;
    }
    return null;
  }

  return null;
}
