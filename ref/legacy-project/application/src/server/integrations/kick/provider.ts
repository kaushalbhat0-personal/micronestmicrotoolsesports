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
import { KickClient, KickApiError } from "./client";
import { mapKickCategory, mapKickLivestreamToCanonical, mapKickTags } from "./mappers";
import type { KickCategory, KickLivestream } from "./types";

export class KickProvider
  implements ChannelResolver, LiveStateProvider, VideoEvidenceProvider, CategoryProvider, TagProvider
{
  readonly platform: Platform = "kick";
  private readonly client: KickClient;
  private readonly budget: ProviderBudget | undefined;
  private readonly categoryCache = new Map<string, CanonicalCategory>();

  constructor(client: KickClient, budget?: ProviderBudget) {
    this.client = client;
    this.budget = budget;
  }

  private checkBudget(cost = 1): void {
    if (!this.budget) return;
    const chk = this.budget.canConsume(cost);
    if (!chk.allowed) {
      const err = new KickApiError({ kind: "rate_limited", status: 429, message: chk.reason ?? "Kick budget exceeded", retryAfter: chk.retryAfter });
      throw err;
    }
  }

  private consumeBudget(cost = 1): void {
    if (this.budget) this.budget.consume(cost);
  }

  async resolveChannel(handle: string): Promise<ConnectedChannelRef | null> {
    const trimmed = handle.trim().replace(/^@/, "");
    if (!trimmed) return null;
    this.checkBudget(1);
    try {
      // Try slug first (Kick slug is handle without @)
      const res = await this.client.getChannelsBySlug([trimmed]);
      this.consumeBudget(1);
      const raw = res.data[0] as unknown as Record<string, unknown> | undefined;
      if (!raw) return null;
      const slug = (raw.slug as string) ?? trimmed;
      const broadcasterId = raw.broadcaster_user_id as number | string | undefined;
      // Map to ConnectedChannelRef; display_name from slug? Use slug as fallback
      return {
        platform: "kick",
        externalChannelId: broadcasterId !== undefined ? String(broadcasterId) : String((raw.id as number | string) ?? slug),
        externalHandle: slug,
        displayName: slug,
        canonicalUrl: `https://kick.com/${slug}`,
      };
    } catch (e) {
      if (e instanceof KickApiError && e.kind === "not_found") return null;
      throw e;
    }
  }

  async getLiveState(channel: ConnectedChannelRef): Promise<CanonicalLiveStream | null> {
    this.checkBudget(1);
    // Kick live check is per user_id via /public/v1/users/livestreams
    const userId = channel.externalChannelId;
    const res = await this.client.getLivestreamsForUsers([userId]);
    this.consumeBudget(1);
    const raw = res.data[0] as unknown as Record<string, unknown> | undefined;
    if (!raw) return null;

    // Normalize raw to KickLivestream shape for mapper
    // API returns LivestreamV2 shape: { id, broadcaster_user {id, username}, channel {slug}, category, title, tags, thumbnail, viewer_count, started_at, language_code }
    const livestream = normalizeKickLivestreamV2(raw, channel.externalHandle);
    return mapKickLivestreamToCanonical(livestream, new Date().toISOString());
  }

  // Kick has no VOD — correctly returns empty / NOT_SUPPORTED via capabilities
  async listVideos(
    _channel: ConnectedChannelRef,
    _window: { readonly from: string; readonly to: string },
  ): Promise<readonly CanonicalVideo[]> {
    // Explicitly unsupported — return empty. Evaluator will map to NOT_SUPPORTED via capabilities.
    return [];
  }

  async resolveCategory(categoryId: string): Promise<CanonicalCategory | null> {
    if (this.categoryCache.has(categoryId)) return this.categoryCache.get(categoryId) ?? null;
    this.checkBudget(1);
    try {
      const res = await this.client.getCategoryById(categoryId);
      this.consumeBudget(1);
      const raw = res.data as Record<string, unknown> | null;
      if (!raw) return null;
      const cat = mapKickCategory({ id: raw.id as number, name: raw.name as string } as KickCategory);
      if (cat) this.categoryCache.set(categoryId, cat);
      return cat;
    } catch (e) {
      if (e instanceof KickApiError && e.kind === "not_found") return null;
      throw e;
    }
  }

  async listTags(channel: ConnectedChannelRef): Promise<readonly CanonicalTag[]> {
    this.checkBudget(1);
    const res = await this.client.getChannelsBySlug([channel.externalHandle.replace(/^@/, "")]);
    this.consumeBudget(1);
    const raw = res.data[0] as Record<string, unknown> | undefined;
    if (!raw) return [];
    // stream.custom_tags or tags?
    const stream = raw.stream as Record<string, unknown> | undefined;
    const custom = (stream?.custom_tags as string[] | undefined) ?? [];
    // No generic tags array in this endpoint? Use stream custom_tags
    return mapKickTags([], custom);
  }

  clearCache(): void {
    this.categoryCache.clear();
  }
}

function normalizeKickLivestreamV2(raw: Record<string, unknown>, fallbackSlug: string): KickLivestream {
  const broadcaster = raw.broadcaster_user as Record<string, unknown> | undefined;
  const channel = raw.channel as Record<string, unknown> | undefined;
  const category = raw.category as Record<string, unknown> | undefined;
  const base: KickLivestream = {
    id: (raw.id as string) ?? "",
    title: (raw.title as string) ?? "",
    category: { id: (category?.id as number) ?? 0, name: (category?.name as string) ?? "" },
    tags: (raw.tags as string[] | undefined) ?? [],
    started_at: (raw.started_at as string) ?? (raw.start_time as string) ?? "",
    viewer_count: (raw.viewer_count as number) ?? 0,
    broadcaster_user: { id: (broadcaster?.id as number) ?? 0, username: (broadcaster?.username as string) ?? fallbackSlug },
    channel: { slug: (channel?.slug as string) ?? fallbackSlug },
  };
  const custom = (raw as unknown as Record<string, unknown>).custom_tags as string[] | undefined;
  if (custom !== undefined) (base as unknown as Record<string, unknown>).custom_tags = custom;
  if ((category?.thumbnail as string | undefined) !== undefined) {
    (base.category as unknown as Record<string, unknown>).thumbnail = category?.thumbnail as string;
  }
  return base;
}
