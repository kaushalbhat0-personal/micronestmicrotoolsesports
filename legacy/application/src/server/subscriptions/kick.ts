import type { KickClient } from "@/server/integrations/kick/client";
import type { SubscriptionCapability, SubscriptionInput, SubscriptionResult, UnsubscriptionResult } from "./types";

const SUPPORTED = ["livestream.metadata.updated", "livestream.status.updated"] as const;

export function getKickCapabilities(): SubscriptionCapability {
  return {
    supportsWebhooks: true,
    supportsCreate: true,
    supportsDelete: true,
    supportsList: true,
    supportsExpiration: false,
    supportedEventTypes: SUPPORTED as unknown as readonly string[],
  };
}

export class KickSubscriptionAdapter {
  constructor(private readonly client: KickClient) {}

  getCapabilities(): SubscriptionCapability {
    return getKickCapabilities();
  }

  async create(input: SubscriptionInput & { eventType: string }): Promise<SubscriptionResult> {
    const caps = this.getCapabilities();
    if (!caps.supportedEventTypes.includes(input.eventType)) {
      return { status: "unsupported", provider: "kick", externalChannelId: input.externalChannelId, eventType: input.eventType, errorKind: "unsupported_event" };
    }
    const broadcasterId = Number(input.externalChannelId);
    if (Number.isNaN(broadcasterId)) return { status: "failed", provider: "kick", externalChannelId: input.externalChannelId, eventType: input.eventType, errorKind: "invalid_request" };

    try {
      const res = await this.client.createEventSubscriptions({
        broadcaster_user_id: broadcasterId,
        events: [{ name: input.eventType, version: 1 }],
        method: "webhook",
      });
      const id = (res.data[0] as Record<string, unknown> | undefined)?.subscription_id as string | undefined ?? null;
      return { status: "created", provider: "kick", externalChannelId: input.externalChannelId, eventType: input.eventType, externalSubscriptionId: id };
    } catch (e) {
      const err = e as { kind?: string; message?: string };
      const kind = err.kind ?? "server";
      if (kind === "invalid_request" && String(err.message).includes("already")) {
        return { status: "already_exists", provider: "kick", externalChannelId: input.externalChannelId, eventType: input.eventType };
      }
      return { status: "failed", provider: "kick", externalChannelId: input.externalChannelId, eventType: input.eventType, errorKind: kind, message: String(err.message).slice(0, 200) };
    }
  }

  async list(broadcasterUserId?: number): Promise<Array<{ id: string; event: string; broadcaster_user_id: number }>> {
    const res = await this.client.getEventSubscriptions(broadcasterUserId);
    return res.data.map((d) => ({
      id: String((d as Record<string, unknown>).id ?? (d as Record<string, unknown>).subscription_id ?? ""),
      event: String((d as Record<string, unknown>).event ?? ""),
      broadcaster_user_id: Number((d as Record<string, unknown>).broadcaster_user_id ?? 0),
    }));
  }

  async delete(input: SubscriptionInput & { externalSubscriptionId: string }): Promise<UnsubscriptionResult> {
    try {
      await this.client.deleteEventSubscriptions([input.externalSubscriptionId]);
      return { status: "deleted", provider: "kick", externalChannelId: input.externalChannelId };
    } catch (e) {
      const err = e as { kind?: string };
      if (err.kind === "not_found") return { status: "not_found", provider: "kick", externalChannelId: input.externalChannelId };
      return { status: "failed", provider: "kick", externalChannelId: input.externalChannelId, errorKind: err.kind ?? "server" };
    }
  }

  async reconcileForChannel(input: SubscriptionInput): Promise<{ created: number; alreadyExists: number; failed: number; results: SubscriptionResult[] }> {
    const caps = this.getCapabilities();
    let existing: Awaited<ReturnType<typeof this.list>> = [];
    try {
      const bid = Number(input.externalChannelId);
      existing = await this.list(Number.isNaN(bid) ? undefined : bid);
    } catch {
      existing = [];
    }
    const results: SubscriptionResult[] = [];
    let created = 0;
    let alreadyExists = 0;
    let failed = 0;
    for (const eventType of caps.supportedEventTypes) {
      const match = existing.find((s) => s.event === eventType && String(s.broadcaster_user_id) === input.externalChannelId);
      if (match) {
        results.push({ status: "already_exists", provider: "kick", externalChannelId: input.externalChannelId, eventType, externalSubscriptionId: match.id });
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
