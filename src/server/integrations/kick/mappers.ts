import type { CanonicalCategory } from "@/features/sponsor-sentinel/types/category";
import type { CanonicalLiveStream } from "@/features/sponsor-sentinel/types/observations";
import type { CanonicalTag } from "@/features/sponsor-sentinel/types/tag";
import type { KickCategory, KickChannel, KickLivestream } from "./types";

export function mapKickCategory(cat: KickCategory | null | undefined): CanonicalCategory | null {
  if (!cat) return null;
  return { id: String(cat.id), name: cat.name, platform: "kick" };
}

export function mapKickTags(tags: readonly string[] | undefined, customTags: readonly string[] | undefined): readonly CanonicalTag[] {
  const base: CanonicalTag[] = (tags ?? []).map((t) => ({
    value: t,
    source: "kick" as const,
    platform: "kick" as const,
    label: t,
  }));
  const custom: CanonicalTag[] = (customTags ?? []).map((t) => ({
    value: t,
    source: "kick_custom" as const,
    platform: "kick" as const,
    label: t,
  }));
  return [...base, ...custom];
}

export function mapKickLivestreamToCanonical(
  livestream: KickLivestream,
  observedAt: string,
): CanonicalLiveStream {
  return {
    platform: "kick",
    externalStreamId: livestream.id,
    externalChannelId: String(livestream.broadcaster_user.id),
    channelHandle: livestream.channel.slug,
    title: livestream.title,
    category: mapKickCategory(livestream.category),
    tags: mapKickTags(livestream.tags, livestream.custom_tags),
    startedAt: livestream.started_at || null,
    observedAt,
    canonicalUrl: `https://kick.com/${livestream.channel.slug}`,
    isLive: true,
    description: null,
  };
}

export function mapKickChannelToCanonical(
  channel: KickChannel,
  observedAt: string,
): CanonicalLiveStream {
  return {
    platform: "kick",
    externalStreamId: String(channel.id),
    externalChannelId: String(channel.broadcaster_user_id),
    channelHandle: channel.slug,
    title: channel.stream_title,
    category: mapKickCategory(channel.category),
    tags: mapKickTags(channel.tags, channel.custom_tags),
    startedAt: null,
    observedAt,
    canonicalUrl: `https://kick.com/${channel.slug}`,
    isLive: false,
    description: null,
  };
}
