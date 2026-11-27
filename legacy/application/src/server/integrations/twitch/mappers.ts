import type { CanonicalCategory } from "@/features/sponsor-sentinel/types/category";
import type { CanonicalLiveStream, CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { CanonicalTag } from "@/features/sponsor-sentinel/types/tag";
import { parseTwitchDurationToSeconds } from "@/features/sponsor-sentinel/services/normalization";
import type { TwitchChannelInfo, TwitchStream, TwitchVideo } from "./types";

export function mapTwitchTags(tagIds: readonly string[]): readonly CanonicalTag[] {
  return tagIds.map((id) => ({
    value: id,
    source: "twitch_curated" as const,
    platform: "twitch" as const,
    label: id,
  }));
}

export function mapTwitchCategory(gameId: string, gameName: string): CanonicalCategory | null {
  if (!gameId && !gameName) return null;
  return {
    id: gameId || gameName,
    name: gameName || gameId,
    platform: "twitch",
  };
}

export function mapTwitchStreamToCanonical(
  stream: TwitchStream,
  observedAt: string,
): CanonicalLiveStream {
  return {
    platform: "twitch",
    externalStreamId: stream.id,
    externalChannelId: stream.user_id,
    channelHandle: stream.user_login,
    title: stream.title,
    category: mapTwitchCategory(stream.game_id, stream.game_name),
    tags: mapTwitchTags(stream.tags),
    startedAt: stream.started_at,
    observedAt,
    canonicalUrl: `https://twitch.tv/${stream.user_login}`,
    isLive: stream.type === "live",
    description: null,
  };
}

export function mapTwitchChannelInfoToCanonical(
  info: TwitchChannelInfo,
  observedAt: string,
): CanonicalLiveStream {
  return {
    platform: "twitch",
    externalStreamId: info.broadcaster_id,
    externalChannelId: info.broadcaster_id,
    channelHandle: info.broadcaster_login,
    title: info.title,
    category: mapTwitchCategory(info.game_id, info.game_name),
    tags: mapTwitchTags(info.tags),
    startedAt: null,
    observedAt,
    canonicalUrl: `https://twitch.tv/${info.broadcaster_login}`,
    isLive: false,
    description: null,
  };
}

export function mapTwitchVideoToCanonical(
  video: TwitchVideo,
  handle: string,
  observedAt: string,
): CanonicalVideo {
  const durationSeconds = parseTwitchDurationToSeconds(video.duration);
  return {
    platform: "twitch",
    externalVideoId: video.id,
    externalChannelId: video.user_id,
    channelHandle: handle,
    title: video.title,
    description: video.description || null,
    category: null,
    tags: [],
    startedAt: video.created_at || null,
    publishedAt: video.published_at || null,
    endedAt: null,
    durationSeconds,
    canonicalUrl: video.url,
    observedAt,
    viewable: video.viewable === "public",
  };
}
