import type { CanonicalCategory } from "@/features/sponsor-sentinel/types/category";
import type { CanonicalLiveStream, CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type {
  CategoryProvider,
  ChannelResolver,
  ConnectedChannelRef,
  LiveStateProvider,
  TagProvider,
  VideoEvidenceProvider,
} from "@/features/sponsor-sentinel/types/provider";
import { TwitchClient, TwitchApiError } from "./client";
import { mapTwitchCategory, mapTwitchStreamToCanonical, mapTwitchTags, mapTwitchVideoToCanonical } from "./mappers";
import type { ProviderBudget } from "@/features/sponsor-sentinel/types/budget";

export class TwitchProvider
  implements ChannelResolver, LiveStateProvider, VideoEvidenceProvider, CategoryProvider, TagProvider
{
  readonly platform: Platform = "twitch";
  private readonly client: TwitchClient;
  private readonly budget: ProviderBudget | undefined;
  private readonly gameCache = new Map<string, CanonicalCategory>();

  constructor(client: TwitchClient, budget?: ProviderBudget) {
    this.client = client;
    this.budget = budget;
  }

  private checkBudget(cost = 1): void {
    if (!this.budget) return;
    const chk = this.budget.canConsume(cost);
    if (!chk.allowed) {
      const err = new Error(chk.reason ?? "Twitch budget exceeded");
      (err as unknown as Record<string, unknown>).code = "BUDGET_EXCEEDED";
      (err as unknown as Record<string, unknown>).retryAfter = chk.retryAfter;
      throw err;
    }
  }

  private consumeBudget(cost = 1): void {
    if (this.budget) this.budget.consume(cost);
  }

  private ingestRateLimit(): void {
    const rl = this.client.lastRateLimit;
    if (!rl || !this.budget) return;
    // Budget is token-bucket 800/min; remaining from header can sync budget
    // If remaining is known, we could adjust, but keep simple consumption model.
    // No hard-coded limit logic in scanner.
  }

  async resolveChannel(handle: string): Promise<ConnectedChannelRef | null> {
    this.checkBudget(1);
    try {
      const res = await this.client.getUsersByLogin([handle]);
      this.consumeBudget(1);
      this.ingestRateLimit();
      const user = res.data[0];
      if (!user) return null;
      return {
        platform: "twitch",
        externalChannelId: user.id,
        externalHandle: user.login,
        displayName: user.display_name ?? null,
        canonicalUrl: `https://twitch.tv/${user.login}`,
      };
    } catch (e) {
      if (e instanceof TwitchApiError && e.kind === "not_found") return null;
      throw e;
    }
  }

  async getLiveState(channel: ConnectedChannelRef): Promise<CanonicalLiveStream | null> {
    this.checkBudget(1);
    const streams = await this.client.getStreams([channel.externalChannelId]);
    this.consumeBudget(1);
    this.ingestRateLimit();
    const stream = streams.data[0];
    if (stream) {
      return mapTwitchStreamToCanonical(stream, new Date().toISOString());
    }
    // Offline: no live stream. Optionally we could fetch channel info for title, but not required for live detection per spec.
    return null;
  }

  async listVideos(
    channel: ConnectedChannelRef,
    window: { readonly from: string; readonly to: string },
  ): Promise<readonly CanonicalVideo[]> {
    this.checkBudget(1);
    // Get Videos by user_id, first 20 (default), filter by window window in memory
    const res = await this.client.getVideos({ user_id: channel.externalChannelId, first: "20" });
    this.consumeBudget(1);
    this.ingestRateLimit();
    const from = Date.parse(window.from);
    const to = Date.parse(window.to);
    const filtered = res.data.filter((v) => {
      const pub = Date.parse(v.published_at || v.created_at);
      if (Number.isNaN(pub)) return true; // keep if unparsable
      return pub >= from && pub <= to;
    });
    return filtered.map((v) => mapTwitchVideoToCanonical(v, channel.externalHandle, new Date().toISOString()));
  }

  async resolveCategory(categoryId: string): Promise<CanonicalCategory | null> {
    if (this.gameCache.has(categoryId)) return this.gameCache.get(categoryId) ?? null;
    this.checkBudget(1);
    const res = await this.client.getGamesByIds([categoryId]);
    this.consumeBudget(1);
    this.ingestRateLimit();
    const game = res.data[0];
    if (!game) return null;
    const cat: CanonicalCategory = { id: game.id, name: game.name, platform: "twitch" };
    this.gameCache.set(categoryId, cat);
    // Also cache reverse
    this.gameCache.set(game.name, cat);
    return cat;
  }

  // Helper used only internally if needed: resolve by name
  async resolveCategoryByName(name: string): Promise<CanonicalCategory | null> {
    if (this.gameCache.has(name)) return this.gameCache.get(name) ?? null;
    this.checkBudget(1);
    const res = await this.client.getGamesByNames([name]);
    this.consumeBudget(1);
    this.ingestRateLimit();
    const game = res.data[0];
    if (!game) return null;
    const cat = mapTwitchCategory(game.id, game.name);
    if (!cat) return null;
    this.gameCache.set(game.id, cat);
    this.gameCache.set(game.name, cat);
    return cat;
  }

  async listTags(channel: ConnectedChannelRef): Promise<readonly import("@/features/sponsor-sentinel/types/tag").CanonicalTag[]> {
    this.checkBudget(1);
    const res = await this.client.getStreamTags(channel.externalChannelId);
    this.consumeBudget(1);
    this.ingestRateLimit();
    const ids = res.data.map((d) => d.tag_id);
    return mapTwitchTags(ids);
  }

  // For testing: clear cache
  clearCache(): void {
    this.gameCache.clear();
  }
}
