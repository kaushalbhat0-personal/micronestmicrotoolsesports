import { getWebhookCallbackUrl } from "@/lib/env/callback";
import { websubRequest, youtubeTopicForChannel, WebSubApiError } from "@/server/integrations/youtube/websub";
import type { SubscriptionCapability, SubscriptionInput, SubscriptionResult, UnsubscriptionResult } from "./types";

const SUPPORTED = ["video_published"] as const;

export function getYouTubeCapabilities(): SubscriptionCapability {
  return {
    supportsWebhooks: true,
    supportsCreate: true,
    supportsDelete: true,
    supportsList: false,
    supportsExpiration: true,
    supportedEventTypes: SUPPORTED as unknown as readonly string[],
  };
}

export class YouTubeSubscriptionAdapter {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  getCapabilities(): SubscriptionCapability {
    return getYouTubeCapabilities();
  }

  async create(input: SubscriptionInput & { eventType?: string }): Promise<SubscriptionResult> {
    const caps = this.getCapabilities();
    const eventType = input.eventType ?? "video_published";
    if (!caps.supportedEventTypes.includes(eventType)) {
      return { status: "unsupported", provider: "youtube", externalChannelId: input.externalChannelId, eventType, errorKind: "unsupported_event" };
    }
    const verifyToken = process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN;
    if (!verifyToken) return { status: "failed", provider: "youtube", externalChannelId: input.externalChannelId, eventType, errorKind: "not_configured", message: "YOUTUBE_WEBSUB_VERIFY_TOKEN missing" };
    const topic = youtubeTopicForChannel(input.externalChannelId);
    const callback = getWebhookCallbackUrl("youtube");
    try {
      await websubRequest({ mode: "subscribe", topic, callback, verifyToken, leaseSeconds: 432000 }, this.fetchFn); // 5 days
      return { status: "created", provider: "youtube", externalChannelId: input.externalChannelId, eventType, externalSubscriptionId: topic };
    } catch (e) {
      const err = e as WebSubApiError;
      return { status: "failed", provider: "youtube", externalChannelId: input.externalChannelId, eventType, errorKind: err.kind ?? "server", message: err.message.slice(0, 200) };
    }
  }

  async delete(input: SubscriptionInput): Promise<UnsubscriptionResult> {
    const verifyToken = process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN;
    if (!verifyToken) return { status: "failed", provider: "youtube", externalChannelId: input.externalChannelId, errorKind: "not_configured" };
    const topic = youtubeTopicForChannel(input.externalChannelId);
    const callback = getWebhookCallbackUrl("youtube");
    try {
      await websubRequest({ mode: "unsubscribe", topic, callback, verifyToken }, this.fetchFn);
      return { status: "deleted", provider: "youtube", externalChannelId: input.externalChannelId };
    } catch (e) {
      const err = e as WebSubApiError;
      if (err.kind === "invalid_request") return { status: "not_found", provider: "youtube", externalChannelId: input.externalChannelId };
      return { status: "failed", provider: "youtube", externalChannelId: input.externalChannelId, errorKind: err.kind ?? "server" };
    }
  }

  async reconcileForChannel(input: SubscriptionInput): Promise<{ created: number; alreadyExists: number; failed: number; results: SubscriptionResult[] }> {
    // YouTube has no list API; we treat reconcile as subscribe (idempotent at hub, handles duplicate)
    // We call create; hub will handle duplicate as success
    const res = await this.create({ ...input, eventType: "video_published" });
    // Map created to already_exists if hub says already subscribed? Our adapter maps  invalid_request duplicate to already_exists if needed.
    // For now, treat created as idempotent
    if (res.status === "created") return { created: 1, alreadyExists: 0, failed: 0, results: [res] };
    if (res.status === "already_exists") return { created: 0, alreadyExists: 1, failed: 0, results: [res] };
    return { created: 0, alreadyExists: 0, failed: 1, results: [res] };
  }
}
