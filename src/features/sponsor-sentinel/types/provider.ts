import type { CanonicalCategory } from "./category";
import type { CanonicalLiveStream, CanonicalVideo } from "./observations";
import type { Platform } from "./platform";
import type { CanonicalTag } from "./tag";

export interface ConnectedChannelRef {
  readonly platform: Platform;
  readonly externalChannelId: string;
  readonly externalHandle: string;
  readonly displayName: string | null;
  readonly canonicalUrl: string;
}

export interface ChannelResolver {
  readonly platform: Platform;
  resolveChannel(handle: string): Promise<ConnectedChannelRef | null>;
}

export interface LiveStateProvider {
  readonly platform: Platform;
  getLiveState(channel: ConnectedChannelRef): Promise<CanonicalLiveStream | null>;
}

export interface VideoEvidenceProvider {
  readonly platform: Platform;
  listVideos(
    channel: ConnectedChannelRef,
    window: { readonly from: string; readonly to: string },
  ): Promise<readonly CanonicalVideo[]>;
}

export interface CategoryProvider {
  readonly platform: Platform;
  resolveCategory(categoryId: string): Promise<CanonicalCategory | null>;
}

export interface TagProvider {
  readonly platform: Platform;
  listTags(channel: ConnectedChannelRef): Promise<readonly CanonicalTag[]>;
}
