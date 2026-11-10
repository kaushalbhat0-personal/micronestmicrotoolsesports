import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { CanonicalLiveStream, CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { Scan } from "@/types/database";

export type ScanStage = "DISCOVER" | "FETCH" | "NORMALIZE" | "EVALUATE" | "PERSIST_EVIDENCE" | "PERSIST_RESULT";

export interface ScanInput {
  readonly organizationId: string;
  readonly campaignId: string;
  readonly platformFilter?: Platform;
  readonly scannerVersion?: string;
  /**
   * Authenticated caller for free-tier quota accounting. Browser-invoked
   * scans pass the caller's user id; background paths (cron/webhook) omit it
   * and are gated by the caller via resolveOrgCheckPrincipal instead.
   */
  readonly userId?: string;
}

export interface DiscoveredItem {
  readonly platform: Platform;
  readonly channelId: string;
  readonly externalChannelId: string;
  readonly deliverableIds: readonly string[];
  readonly requiredObservation: "live" | "video" | "either";
}

export interface FetchedObservations {
  readonly live: CanonicalLiveStream | null;
  readonly videos: readonly CanonicalVideo[];
  readonly error?: string;
}

export interface NormalizedObservation {
  readonly platform: Platform;
  readonly externalChannelId: string;
  readonly live: CanonicalLiveStream | null;
  readonly video: CanonicalVideo | null;
}

export interface ScanResult {
  readonly scan: Scan;
  readonly evidenceCount: number;
  readonly evaluationCount: number;
  readonly stageErrors: readonly { stage: ScanStage; platform?: Platform; message: string }[];
}
