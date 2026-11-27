import type { TwitchClient } from "@/server/integrations/twitch/client";
import { getWebhookCallbackUrl } from "@/lib/env/callback";
import type { SubscriptionCapability, SubscriptionInput, SubscriptionResult, UnsubscriptionResult } from "./types";

const SUPPORTED = ["stream.online", "stream.offline", "channel.update"] as const;

export function getTwitchCapabilities(): SubscriptionCapability {
  return {
    supportsWebhooks: true,
    supportsCreate: true,
    supportsDelete: true,
    supportsList: true,
    supportsExpiration: false,
    supportedEventTypes: SUPPORTED as unknown as readonly string[],
  };
}

export class TwitchSubscriptionAdapter {
  constructor(private readonly client: TwitchClient) {}

  getCapabilities(): SubscriptionCapability {
    return getTwitchCapabilities();
  }

  async create(input: SubscriptionInput & { eventType: string }): Promise<SubscriptionResult> {
    const caps = this.getCapabilities();
    if (!caps.supportedEventTypes.includes(input.eventType)) {
      return { status: "unsupported", provider: "twitch", externalChannelId: input.externalChannelId, eventType: input.eventType, errorKind: "unsupported_event" };
    }
    const secret = process.env.TWITCH_EVENTSUB_SECRET;
    if (!secret) return { status: "failed", provider: "twitch", externalChannelId: input.externalChannelId, eventType: input.eventType, errorKind: "not_configured", message: "TWITCH_EVENTSUB_SECRET missing" };

    const callback = getWebhookCallbackUrl("twitch");
    try {
      const res = await this.client.createEventSubSubscription({
        type: input.eventType,
        version: "1",
        condition: { broadcaster_user_id: input.externalChannelId },
        transport: { method: "webhook", callback, secret },
      });
      const id = res.data[0]?.id ?? null;
      return { status: "created", provider: "twitch", externalChannelId: input.externalChannelId, eventType: input.eventType, externalSubscriptionId: id };
    } catch (e) {
      const err = e as { kind?: string; message?: string };
      const kind = err.kind ?? "server";
      // 409 duplicate is treated as already_exists if provider returns it; Twitch returns 400 if duplicate? Map to already_exists for idempotency
      if (kind === "invalid_request" && String(err.message).includes("already")) {
        return { status: "already_exists", provider: "twitch", externalChannelId: input.externalChannelId, eventType: input.eventType };
      }
      return { status: "failed", provider: "twitch", externalChannelId: input.externalChannelId, eventType: input.eventType, errorKind: kind, message: String(err.message).slice(0, 200) };
    }
  }

  async list(): Promise<Array<{ id: string; type: string; condition: Record<string, string>; transport: { callback: string } }>> {
    const res = await this.client.listEventSubSubscriptions();
    return res.data.map((d) => ({ id: d.id, type: d.type, condition: d.condition, transport: { callback: d.transport.callback } }));
  }

  async delete(input: SubscriptionInput & { eventType: string; externalSubscriptionId: string }): Promise<UnsubscriptionResult> {
    try {
      await this.client.deleteEventSubSubscription(input.externalSubscriptionId);
      return { status: "deleted", provider: "twitch", externalChannelId: input.externalChannelId, eventType: input.eventType };
    } catch (e) {
      const err = e as { kind?: string };
      if (err.kind === "not_found") return { status: "not_found", provider: "twitch", externalChannelId: input.externalChannelId, eventType: input.eventType };
      return { status: "failed", provider: "twitch", externalChannelId: input.externalChannelId, eventType: input.eventType, errorKind: err.kind ?? "server" };
    }
  }

  /**
   * Reconcile single channel: list existing, create missing per supported types.
   */
  async reconcileForChannel(input: SubscriptionInput): Promise<{ created: number; alreadyExists: number; failed: number; results: SubscriptionResult[] }> {
    const caps = this.getCapabilities();
    let existing: Awaited<ReturnType<typeof this.list>> = [];
    try {
      existing = await this.list();
    } catch {
      // If list fails, proceed to try create anyway (best effort)
      existing = [];
    }
    const results: SubscriptionResult[] = [];
    let created = 0;
    let alreadyExists = 0;
    let failed = 0;
    for (const eventType of caps.supportedEventTypes) {
      const match = existing.find((s) => s.type === eventType && s.condition.broadcaster_user_id === input.externalChannelId);
      if (match) {
        results.push({ status: "already_exists", provider: "twitch", externalChannelId: input.externalChannelId, eventType, externalSubscriptionId: match.id });
        alreadyExists++;
        continue;
      }
      const res = await this.create({ ...input, eventType });
      results.push(res);
      if (res.status === "created") created++;
      else if (res.status === "already_exists") alreadyExists++;
      else failed++;
    }
    return { created, alreadyExists, failed, results };
  }
}
