import type { CanonicalCategory } from "./category";
import type { Platform } from "./platform";
import type { CanonicalTag } from "./tag";

export interface CanonicalLiveStream {
  readonly platform: Platform;
  readonly externalStreamId: string;
  readonly externalChannelId: string;
  readonly channelHandle: string;
  readonly title: string;
  readonly category: CanonicalCategory | null;
  readonly tags: readonly CanonicalTag[];
  readonly startedAt: string | null;
  readonly observedAt: string;
  readonly canonicalUrl: string;
  readonly isLive: boolean;
  readonly description: string | null;
}

export interface CanonicalVideo {
  readonly platform: Platform;
  readonly externalVideoId: string;
  readonly externalChannelId: string;
  readonly channelHandle: string;
  readonly title: string;
  readonly description: string | null;
  readonly category: CanonicalCategory | null;
  readonly tags: readonly CanonicalTag[];
  readonly startedAt: string | null;
  readonly publishedAt: string | null;
  readonly endedAt: string | null;
  readonly durationSeconds: number | null;
  readonly canonicalUrl: string;
  readonly observedAt: string;
  readonly viewable: boolean | null;
}
