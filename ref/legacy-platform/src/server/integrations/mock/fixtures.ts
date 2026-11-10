import type { CanonicalLiveStream, CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";

const now = "2026-03-10T14:00:00Z";
const observedAt = "2026-03-10T14:05:00Z";

export const twitchLiveFixture: CanonicalLiveStream = {
  platform: "twitch",
  externalStreamId: "twitch-stream-1",
  externalChannelId: "twitch-123",
  channelHandle: "player1",
  title: "Road to SponsorCup #OurBrand",
  category: { id: "21779", name: "League of Legends", platform: "twitch" },
  tags: [{ value: "English", label: "English", source: "twitch_curated", platform: "twitch" }],
  startedAt: now,
  observedAt,
  canonicalUrl: "https://twitch.tv/player1",
  isLive: true,
  description: null,
};

export const twitchVideoFixture: CanonicalVideo = {
  platform: "twitch",
  externalVideoId: "twitch-vod-1",
  externalChannelId: "twitch-123",
  channelHandle: "player1",
  title: "VOD #OurBrand SponsorCup",
  description: "Thanks to OurBrand sponsor",
  category: { id: "21779", name: "League of Legends", platform: "twitch" },
  tags: [],
  startedAt: now,
  publishedAt: "2026-03-10T16:00:00Z",
  endedAt: null,
  durationSeconds: 7200,
  canonicalUrl: "https://twitch.tv/videos/twitch-vod-1",
  observedAt,
  viewable: true,
};

export const youtubeLiveFixture: CanonicalLiveStream = {
  platform: "youtube",
  externalStreamId: "youtube-live-1",
  externalChannelId: "UC123",
  channelHandle: "channelYT",
  title: "Live with #OurBrand",
  category: { id: "20", name: "Gaming", platform: "youtube" },
  tags: [{ value: "Sponsor", label: "Sponsor", source: "youtube_freeform", platform: "youtube" }],
  startedAt: now,
  observedAt,
  canonicalUrl: "https://youtube.com/watch?v=youtube-live-1",
  isLive: true,
  description: "OurBrand description",
};

export const youtubeVideoFixture: CanonicalVideo = {
  platform: "youtube",
  externalVideoId: "youtube-vod-1",
  externalChannelId: "UC123",
  channelHandle: "channelYT",
  title: "YouTube VOD OurBrand",
  description: "OurBrand sponsor video",
  category: { id: "20", name: "Gaming", platform: "youtube" },
  tags: [{ value: "Sponsor", label: "Sponsor", source: "youtube_freeform", platform: "youtube" }],
  startedAt: now,
  publishedAt: "2026-03-10T16:00:00Z",
  endedAt: "2026-03-10T17:00:00Z",
  durationSeconds: 3600,
  canonicalUrl: "https://youtube.com/watch?v=youtube-vod-1",
  observedAt,
  viewable: true,
};

export const kickLiveFixture: CanonicalLiveStream = {
  platform: "kick",
  externalStreamId: "kick-uuid-1",
  externalChannelId: "999",
  channelHandle: "kickplayer",
  title: "Kick live #OurBrand",
  category: { id: "1", name: "Just Chatting", platform: "kick" },
  tags: [
    { value: "English", label: "English", source: "kick", platform: "kick" },
    { value: "SponsorTag", label: "SponsorTag", source: "kick_custom", platform: "kick" },
  ],
  startedAt: now,
  observedAt,
  canonicalUrl: "https://kick.com/kickplayer",
  isLive: true,
  description: null,
};

export function getFixtures(platform: string): { live: CanonicalLiveStream | null; video: CanonicalVideo | null } {
  if (platform === "twitch") return { live: twitchLiveFixture, video: twitchVideoFixture };
  if (platform === "youtube") return { live: youtubeLiveFixture, video: youtubeVideoFixture };
  if (platform === "kick") return { live: kickLiveFixture, video: null };
  return { live: null, video: null };
}
