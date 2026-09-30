import type { CanonicalCategory } from "@/features/sponsor-sentinel/types/category";
import type { CanonicalLiveStream, CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { CanonicalTag } from "@/features/sponsor-sentinel/types/tag";
import type {
  CategoryProvider,
  ChannelResolver,
  ConnectedChannelRef,
  LiveStateProvider,
  TagProvider,
  VideoEvidenceProvider,
} from "@/features/sponsor-sentinel/types/provider";
import type { ProviderBudget } from "@/features/sponsor-sentinel/types/budget";
import { YouTubeClient, YouTubeApiError } from "./client";
import { mapYouTubeTags, mapYouTubeVideoToCanonical, mapYouTubeVideoToLive } from "./mappers";

export class YouTubeProvider
  implements ChannelResolver, LiveStateProvider, VideoEvidenceProvider, CategoryProvider, TagProvider
{
  readonly platform: Platform = "youtube";
  private readonly client: YouTubeClient;
  private readonly budget: ProviderBudget | undefined;
  private readonly searchBudget: ProviderBudget | undefined;
  private readonly categoryCache = new Map<string, CanonicalCategory>();

  constructor(client: YouTubeClient, budget?: ProviderBudget, searchBudget?: ProviderBudget) {
    this.client = client;
    this.budget = budget;
    this.searchBudget = searchBudget;
  }

  private checkBudget(b: ProviderBudget | undefined, cost: number, operation: string): void {
    if (!b) return;
    const chk = b.canConsume(cost);
    if (!chk.allowed) {
      const err = new YouTubeApiError({ kind: "quota_exceeded", status: 429, message: `YouTube budget exceeded for ${operation}: ${chk.reason ?? "insufficient quota"}`, quotaOperation: operation });
      throw err;
    }
  }

  private consumeBudget(b: ProviderBudget | undefined, cost: number): void {
    if (b) b.consume(cost);
  }

  // ChannelResolver: handle may be UC... id or @handle/customUrl
  async resolveChannel(handle: string): Promise<ConnectedChannelRef | null> {
    const trimmed = handle.trim();
    if (!trimmed) return null;

    // If looks like channel ID (UC...), query by id
    if (trimmed.startsWith("UC") && trimmed.length >= 10) {
      this.checkBudget(this.budget, 1, "channels.list");
      const res = await this.client.channelsList({ id: trimmed });
      this.consumeBudget(this.budget, 1);
      const ch = res.items?.[0];
      if (!ch) return null;
      return {
        platform: "youtube",
        externalChannelId: ch.id,
        externalHandle: ch.snippet.customUrl ?? trimmed,
        displayName: ch.snippet.title ?? null,
        canonicalUrl: `https://youtube.com/channel/${ch.id}`,
      };
    }

    // Otherwise try forHandle (strip leading @)
    const handleForApi = trimmed.startsWith("@") ? trimmed : trimmed;
    this.checkBudget(this.budget, 1, "channels.list");
    try {
      const res = await this.client.channelsList({ forHandle: handleForApi });
      this.consumeBudget(this.budget, 1);
      const ch = res.items?.[0];
      if (ch) {
        return {
          platform: "youtube",
          externalChannelId: ch.id,
          externalHandle: ch.snippet.customUrl ?? handleForApi,
          displayName: ch.snippet.title ?? null,
          canonicalUrl: `https://youtube.com/channel/${ch.id}`,
        };
      }
    } catch (e) {
      if (e instanceof YouTubeApiError && (e.kind === "not_found" || e.kind === "invalid_request")) return null;
      throw e;
    }
    return null;
  }

  // LiveStateProvider: use search.list to discover active live for channel, then videos.list for details
  async getLiveState(channel: ConnectedChannelRef): Promise<CanonicalLiveStream | null> {
    // search.list cost distinct (100/day bucket) — check searchBudget
    this.checkBudget(this.searchBudget ?? this.budget, 1, "search.list");
    let searchRes;
    try {
      searchRes = await this.client.searchList({ channelId: channel.externalChannelId, eventType: "live", maxResults: "1" });
      this.consumeBudget(this.searchBudget ?? this.budget, 1);
    } catch (e) {
      if (e instanceof YouTubeApiError && e.kind === "quota_exceeded") throw e;
      // search failure → treat as no live
      return null;
    }
    const videoId = searchRes.items?.[0]?.id.videoId;
    if (!videoId) return null;

    // Fetch video details
    this.checkBudget(this.budget, 1, "videos.list");
    const vids = await this.client.videosList({ id: videoId });
    this.consumeBudget(this.budget, 1);
    const video = vids.items?.[0];
    if (!video) return null;
    // Map via existing mapper
    return mapYouTubeVideoToLive(
      {
        id: video.id,
        snippet: {
          title: video.snippet.title,
          description: video.snippet.description,
          tags: video.snippet.tags,
          categoryId: video.snippet.categoryId,
          publishedAt: video.snippet.publishedAt,
          channelId: video.snippet.channelId,
          liveBroadcastContent: video.snippet.liveBroadcastContent,
        },
        contentDetails: { duration: video.contentDetails.duration },
        liveStreamingDetails: video.liveStreamingDetails,
      },
      channel.externalHandle,
      new Date().toISOString(),
    );
  }

  async listVideos(
    channel: ConnectedChannelRef,
    window: { readonly from: string; readonly to: string },
  ): Promise<readonly CanonicalVideo[]> {
    // Use search.list to discover videos in window (completed)
    this.checkBudget(this.searchBudget ?? this.budget, 1, "search.list");
    let searchRes;
    try {
      searchRes = await this.client.searchList({ channelId: channel.externalChannelId, eventType: "completed", maxResults: "10" });
      this.consumeBudget(this.searchBudget ?? this.budget, 1);
    } catch (e) {
      if (e instanceof YouTubeApiError) throw e;
      return [];
    }
    const ids = (searchRes.items ?? []).map((i) => i.id.videoId).filter((v): v is string => Boolean(v));
    if (ids.length === 0) return [];

    // Bound pagination: only one search page for MVP (max 10). If more needed, nextPageToken loop capped.
    // Fetch details via videos.list
    this.checkBudget(this.budget, 1, "videos.list");
    const vidsRes = await this.client.videosList({ id: ids.join(",") });
    this.consumeBudget(this.budget, 1);

    const from = Date.parse(window.from);
    const to = Date.parse(window.to);
    const filtered = (vidsRes.items ?? []).filter((v) => {
      const pub = Date.parse(v.snippet.publishedAt);
      if (Number.isNaN(pub)) return true;
      return pub >= from && pub <= to;
    });

    return filtered.map((v) =>
      mapYouTubeVideoToCanonical(
        {
          id: v.id,
          snippet: {
            title: v.snippet.title,
            description: v.snippet.description,
            tags: v.snippet.tags,
            categoryId: v.snippet.categoryId,
            publishedAt: v.snippet.publishedAt,
            channelId: v.snippet.channelId,
            liveBroadcastContent: v.snippet.liveBroadcastContent,
          },
          contentDetails: { duration: v.contentDetails.duration },
          liveStreamingDetails: v.liveStreamingDetails,
        },
        channel.externalHandle,
        new Date().toISOString(),
      ),
    );
  }

  async resolveCategory(categoryId: string): Promise<CanonicalCategory | null> {
    if (this.categoryCache.has(categoryId)) return this.categoryCache.get(categoryId) ?? null;
    this.checkBudget(this.budget, 1, "videoCategories.list");
    try {
      const res = await this.client.videoCategoriesList({ id: categoryId });
      this.consumeBudget(this.budget, 1);
      const item = res.items?.[0];
      if (!item) return null;
      const cat: CanonicalCategory = { id: item.id, name: item.snippet.title, platform: "youtube" };
      this.categoryCache.set(categoryId, cat);
      return cat;
    } catch (e) {
      if (e instanceof YouTubeApiError && e.kind === "not_found") return null;
      throw e;
    }
  }

  async listTags(channel: ConnectedChannelRef): Promise<readonly CanonicalTag[]> {
    // Tags are per-video, not per-channel. For channel-level tags we return empty; video tags are fetched via getLiveState/listVideos.
    // As fallback, try latest video tags via search+videos.
    try {
      this.checkBudget(this.searchBudget ?? this.budget, 1, "search.list");
      const searchRes = await this.client.searchList({ channelId: channel.externalChannelId, maxResults: "1" });
      this.consumeBudget(this.searchBudget ?? this.budget, 1);
      const vid = searchRes.items?.[0]?.id.videoId;
      if (!vid) return [];
      this.checkBudget(this.budget, 1, "videos.list");
      const vids = await this.client.videosList({ id: vid });
      this.consumeBudget(this.budget, 1);
      const tags = vids.items?.[0]?.snippet.tags ?? [];
      return mapYouTubeTags(tags);
    } catch {
      return [];
    }
  }

  clearCache(): void {
    this.categoryCache.clear();
  }
}
