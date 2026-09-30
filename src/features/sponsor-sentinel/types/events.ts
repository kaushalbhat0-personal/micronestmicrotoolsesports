import type { CanonicalLiveStream, CanonicalVideo } from "./observations";
import type { Platform } from "./platform";

export interface ParsedEvent {
  readonly provider: Platform;
  readonly type: string;
  readonly externalChannelId: string | null;
  readonly externalContentId: string | null;
  readonly timestamp: string;
  readonly raw: unknown;
}

/**
 * Provider-neutral canonical webhook event (08B).
 * Distinguishes externalEventId (delivery idempotency key) from
 * externalChannelId / externalContentId (content identity).
 */
export interface CanonicalWebhookEvent {
  readonly provider: Platform;
  readonly externalEventId: string;
  readonly eventType: string;
  readonly eventVersion?: string | undefined;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly externalChannelId: string | null;
  readonly externalContentId: string | null;
  readonly payload: unknown;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface EventVerifier {
  verify(request: Request, provider: Platform): Promise<{ readonly valid: boolean; readonly reason?: string }>;
}

export interface EventParser {
  parse(rawBody: string, headers: Headers, provider: Platform): ParsedEvent;
}

export interface EventNormalizer {
  normalize(parsed: ParsedEvent): Promise<CanonicalLiveStream | CanonicalVideo | null>;
}

export interface EventIngestor {
  ingest(canonical: CanonicalLiveStream | CanonicalVideo, source: "event"): Promise<void>;
}

export interface SubscriptionRow {
  readonly id: string;
  readonly platform: Platform;
  readonly externalChannelId: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface SubscriptionManager {
  subscribe(channel: { readonly platform: Platform; readonly externalChannelId: string }): Promise<void>;
  unsubscribe(channel: { readonly platform: Platform; readonly externalChannelId: string }): Promise<void>;
  listSubscriptions(organizationId: string): Promise<readonly SubscriptionRow[]>;
  renewIfNeeded(nowIso: string): Promise<void>;
}
