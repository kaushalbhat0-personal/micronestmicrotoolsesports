import type { Platform } from "./platform";

export type EvidenceSource =
  | "get_streams"
  | "get_channel_info"
  | "get_videos"
  | "get_stream_tags"
  | "get_games"
  | "youtube_channels_list"
  | "youtube_videos_list"
  | "youtube_search_list"
  | "youtube_video_categories"
  | "kick_livestreams"
  | "kick_channels"
  | "event";

export type EvidenceType = "live_stream" | "video";

export interface Evidence {
  readonly id: string;
  readonly organizationId: string;
  readonly deliverableId: string;
  readonly campaignId: string;
  readonly platform: Platform;
  readonly externalChannelId: string;
  readonly externalContentId: string | null;
  readonly evidenceType: EvidenceType;
  readonly source: EvidenceSource;
  readonly sourceId: string;
  readonly observedAt: string;
  readonly observedValue: string;
  readonly normalizedValue: string;
  readonly rawRef: { readonly externalId: string; readonly url?: string; readonly platform: Platform };
  readonly sourceUrl: string | null;
  readonly scannerVersion: string;
  readonly ruleType: string;
}
