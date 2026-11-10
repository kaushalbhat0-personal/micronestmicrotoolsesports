import type { Platform } from "@/features/sponsor-sentinel/types/platform";

export type SubscriptionCapability = {
  readonly supportsWebhooks: boolean;
  readonly supportsCreate: boolean;
  readonly supportsDelete: boolean;
  readonly supportsList: boolean;
  readonly supportsExpiration: boolean;
  readonly supportedEventTypes: readonly string[];
};

export type SubscriptionInput = {
  readonly organizationId: string;
  readonly platform: Platform;
  readonly externalChannelId: string;
  readonly externalHandle?: string;
  readonly eventTypes?: readonly string[];
};

export type SubscriptionResultStatus = "created" | "already_exists" | "failed" | "unsupported";

export type SubscriptionResult = {
  readonly status: SubscriptionResultStatus;
  readonly provider: Platform;
  readonly externalChannelId: string;
  readonly eventType?: string;
  readonly externalSubscriptionId?: string | null;
  readonly errorKind?: string;
  readonly message?: string;
};

export type UnsubscriptionResult = {
  readonly status: "deleted" | "not_found" | "failed" | "unsupported";
  readonly provider: Platform;
  readonly externalChannelId: string;
  readonly eventType?: string;
  readonly errorKind?: string;
};

export type ReconcileResult = {
  readonly provider: Platform;
  readonly attempted: number;
  readonly created: number;
  readonly alreadyExists: number;
  readonly failed: number;
  readonly results: readonly SubscriptionResult[];
};

export interface WebhookSubscriptionManager {
  getCapabilities(): SubscriptionCapability;
  createSubscription(input: SubscriptionInput & { eventType: string }): Promise<SubscriptionResult>;
  deleteSubscription(input: SubscriptionInput & { eventType: string }): Promise<UnsubscriptionResult>;
  reconcileForChannel(input: SubscriptionInput): Promise<ReconcileResult>;
}
