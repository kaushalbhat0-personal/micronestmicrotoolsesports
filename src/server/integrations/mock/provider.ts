import type { CanonicalCategory } from "@/features/sponsor-sentinel/types/category";
import type { CanonicalLiveStream, CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { ConnectedChannelRef, LiveStateProvider, VideoEvidenceProvider } from "@/features/sponsor-sentinel/types/provider";
import type { CanonicalTag } from "@/features/sponsor-sentinel/types/tag";
import { getFixtures } from "./fixtures";

export interface MockProviderConfig {
  shouldFail?: boolean;
  failMessage?: string;
  budgetExhausted?: boolean;
  customLive?: CanonicalLiveStream | null;
  customVideos?: CanonicalVideo[] | null;
  malformed?: boolean;
}

export class MockProvider implements LiveStateProvider, VideoEvidenceProvider {
  readonly platform: Platform;
  private cfg: MockProviderConfig;

  constructor(platform: Platform, cfg: MockProviderConfig = {}) {
    this.platform = platform;
    this.cfg = cfg;
  }

  setConfig(cfg: MockProviderConfig): void {
    this.cfg = cfg;
  }

  async getLiveState(channel: ConnectedChannelRef): Promise<CanonicalLiveStream | null> {
    if (this.cfg.budgetExhausted) {
      const err = new Error("budget exceeded");
      (err as unknown as Record<string, unknown>).code = "BUDGET_EXCEEDED";
      throw err;
    }
    if (this.cfg.shouldFail) throw new Error(this.cfg.failMessage ?? "provider error");
    if (this.cfg.malformed) return { malformed: true } as unknown as CanonicalLiveStream;
    if (this.cfg.customLive !== undefined) return this.cfg.customLive;
    const { live } = getFixtures(this.platform);
    if (!live) return null;
    // adapt to channel
    return { ...live, externalChannelId: channel.externalChannelId, channelHandle: channel.externalHandle };
  }

  async listVideos(
    channel: ConnectedChannelRef,
    _window: { readonly from: string; readonly to: string },
  ): Promise<readonly CanonicalVideo[]> {
    if (this.cfg.budgetExhausted) {
      const err = new Error("budget exceeded");
      (err as unknown as Record<string, unknown>).code = "BUDGET_EXCEEDED";
      throw err;
    }
    if (this.cfg.shouldFail) throw new Error(this.cfg.failMessage ?? "provider error");
    if (this.cfg.malformed) throw new Error("malformed video data");
    if (this.cfg.customVideos !== undefined) return this.cfg.customVideos ?? [];
    const { video } = getFixtures(this.platform);
    if (!video) return [];
    return [{ ...video, externalChannelId: channel.externalChannelId, channelHandle: channel.externalHandle }];
  }

  // helpers for Category/Tag providers (not used by orchestrator directly but available)
  async resolveCategory(categoryId: string): Promise<CanonicalCategory | null> {
    return { id: categoryId, name: `Category ${categoryId}`, platform: this.platform };
  }

  async listTags(_channel: ConnectedChannelRef): Promise<readonly CanonicalTag[]> {
    const { live } = getFixtures(this.platform);
    return live?.tags ?? [];
  }
}

export const mockTwitch = new MockProvider("twitch");
export const mockYoutube = new MockProvider("youtube");
export const mockKick = new MockProvider("kick");

export function getMockProvider(platform: Platform): MockProvider {
  if (platform === "twitch") return mockTwitch;
  if (platform === "youtube") return mockYoutube;
  return mockKick;
}

export function resetMocks(): void {
  mockTwitch.setConfig({});
  mockYoutube.setConfig({});
  mockKick.setConfig({});
}
