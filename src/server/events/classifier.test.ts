import { describe, expect, it } from "vitest";
import { classifyWebhookEvent } from "./classifier";
import type { CanonicalWebhookEvent } from "@/features/sponsor-sentinel/types/events";

function makeEvent(provider: string, eventType: string, payload: unknown = {}): CanonicalWebhookEvent {
  return {
    provider: provider as never,
    externalEventId: "evt-1",
    eventType,
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    externalChannelId: "123",
    externalContentId: null,
    payload,
  };
}

describe("event classification", () => {
  it("twitch stream.online → STREAM_STARTED", () => expect(classifyWebhookEvent(makeEvent("twitch", "stream.online"))).toBe("STREAM_STARTED"));
  it("twitch stream.offline → STREAM_ENDED", () => expect(classifyWebhookEvent(makeEvent("twitch", "stream.offline"))).toBe("STREAM_ENDED"));
  it("twitch channel.update → STREAM_METADATA_CHANGED", () => expect(classifyWebhookEvent(makeEvent("twitch", "channel.update"))).toBe("STREAM_METADATA_CHANGED"));
  it("kick metadata → STREAM_METADATA_CHANGED", () => expect(classifyWebhookEvent(makeEvent("kick", "livestream.metadata.updated"))).toBe("STREAM_METADATA_CHANGED"));
  it("kick status with is_live true → STREAM_STARTED", () => expect(classifyWebhookEvent(makeEvent("kick", "livestream.status.updated", { is_live: true }))).toBe("STREAM_STARTED"));
  it("kick status with is_live false → STREAM_ENDED", () => expect(classifyWebhookEvent(makeEvent("kick", "livestream.status.updated", { is_live: false }))).toBe("STREAM_ENDED"));
  it("youtube video_published → CONTENT_PUBLISHED", () => expect(classifyWebhookEvent(makeEvent("youtube", "video_published"))).toBe("CONTENT_PUBLISHED"));
  it("unsupported event → UNSUPPORTED", () => expect(classifyWebhookEvent(makeEvent("twitch", "channel.follow"))).toBe("UNSUPPORTED"));
});
