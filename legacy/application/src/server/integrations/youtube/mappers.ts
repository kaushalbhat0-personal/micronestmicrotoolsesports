import type { CanonicalCategory } from "@/features/sponsor-sentinel/types/category";
import type { CanonicalLiveStream, CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { CanonicalTag } from "@/features/sponsor-sentinel/types/tag";
import { parseYouTubeDurationToSeconds } from "@/features/sponsor-sentinel/services/normalization";
import type { YouTubeChannel, YouTubeVideo } from "./types";

export function mapYouTubeTags(tags: readonly string[] | undefined): readonly CanonicalTag[] {
  if (!tags) return [];
  return tags.map((t) => ({
    value: t,
    source: "youtube_freeform" as const,
    platform: "youtube" as const,
    label: t,
  }));
}

export function mapYouTubeCategory(categoryId: string): CanonicalCategory | null {
  if (!categoryId) return null;
  return { id: categoryId, name: categoryId, platform: "youtube" };
}

export function mapYouTubeVideoToLive(
  video: YouTubeVideo,
  handle: string,
  observedAt: string,
): CanonicalLiveStream {
  return {
    platform: "youtube",
    externalStreamId: video.id,
    externalChannelId: video.snippet.channelId,
    channelHandle: handle,
    title: video.snippet.title,
    category: mapYouTubeCategory(video.snippet.categoryId),
    tags: mapYouTubeTags(video.snippet.tags),
    startedAt: video.liveStreamingDetails?.actualStartTime ?? video.snippet.publishedAt ?? null,
    observedAt,
    canonicalUrl: `https://youtube.com/watch?v=${video.id}`,
    isLive: video.snippet.liveBroadcastContent === "live",
    description: video.snippet.description || null,
  };
}

export function mapYouTubeVideoToCanonical(
  video: YouTubeVideo,
  handle: string,
  observedAt: string,
): CanonicalVideo {
  const durationSeconds = parseYouTubeDurationToSeconds(video.contentDetails.duration);
  return {
    platform: "youtube",
    externalVideoId: video.id,
    externalChannelId: video.snippet.channelId,
    channelHandle: handle,
    title: video.snippet.title,
    description: video.snippet.description || null,
    category: mapYouTubeCategory(video.snippet.categoryId),
    tags: mapYouTubeTags(video.snippet.tags),
    startedAt: video.liveStreamingDetails?.actualStartTime ?? null,
    publishedAt: video.snippet.publishedAt || null,
    endedAt: video.liveStreamingDetails?.actualEndTime ?? null,
    durationSeconds,
    canonicalUrl: `https://youtube.com/watch?v=${video.id}`,
    observedAt,
    viewable: null,
  };
}

export function mapYouTubeChannelToHandle(channel: YouTubeChannel): string {
  return channel.snippet.customUrl ?? channel.id;
}
