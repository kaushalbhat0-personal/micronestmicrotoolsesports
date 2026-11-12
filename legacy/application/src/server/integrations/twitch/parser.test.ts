import { describe, expect, it } from "vitest";
import { parseTwitchEvent } from "./parser";
import type { VerificationResult } from "@/server/webhooks/types";

function verifiedTwitch(overrides: Partial<VerificationResult> = {}): VerificationResult {
  return {
    status: "VERIFIED",
    provider: "twitch",
    eventId: "twitch-msg-1",
    eventType: "stream.online",
    timestamp: new Date().toISOString(),
    rawBody: "{}",
    messageType: "notification",
    ...overrides,
  } as VerificationResult;
}

describe("Twitch parser", () => {
  it("verified notification parses, message ID becomes externalEventId", () => {
    const body = JSON.stringify({
      subscription: { id: "sub-1", type: "stream.online", version: "1", condition: { broadcaster_user_id: "123" } },
      event: { broadcaster_user_id: "123", broadcaster_user_login: "testchan", broadcaster_user_name: "TestChan", id: "stream-1" },
    });
    const headers = new Headers();
    const res = parseTwitchEvent(body, verifiedTwitch({ eventId: "msg-abc", eventType: "stream.online", timestamp: new Date().toISOString(), messageType: "notification" }), headers);
    expect(res.kind).toBe("notification");
    if (res.kind === "notification") {
      expect(res.canonical.externalEventId).toBe("msg-abc");
      expect(res.canonical.eventType).toBe("stream.online");
      expect(res.canonical.externalChannelId).toBe("123");
      expect(res.parsed.provider).toBe("twitch");
    }
  });

  it("challenge does not enter persistence (returns challenge)", () => {
    const body = JSON.stringify({ challenge: "abc123", subscription: { type: "stream.online" } });
    const headers = new Headers();
    const verified = verifiedTwitch({ challenge: "abc123", messageType: "webhook_callback_verification", eventType: "stream.online" });
    const res = parseTwitchEvent(body, verified, headers);
    expect(res.kind).toBe("challenge");
    if (res.kind === "challenge") expect(res.challenge).toBe("abc123");
  });

  it("revocation parses correctly", () => {
    const body = JSON.stringify({ subscription: { type: "stream.online" } });
    const headers = new Headers();
    const verified = verifiedTwitch({ messageType: "revocation", eventType: "stream.online" });
    const res = parseTwitchEvent(body, verified, headers);
    expect(res.kind).toBe("revocation");
  });

  it("malformed JSON throws", () => {
    const body = "not json";
    const headers = new Headers();
    expect(() => parseTwitchEvent(body, verifiedTwitch(), headers)).toThrow();
  });

  it("missing subscription.type throws", () => {
    const body = JSON.stringify({ event: {} });
    const headers = new Headers();
    expect(() => parseTwitchEvent(body, verifiedTwitch(), headers)).toThrow();
  });

  it("preserves broadcaster identity for tenant resolution", () => {
    const body = JSON.stringify({
      subscription: { type: "channel.update", version: "1", condition: { broadcaster_user_id: "999" } },
      event: { broadcaster_user_id: "999", broadcaster_user_login: "cool", title: "New Title", category_id: "509658" },
    });
    const headers = new Headers();
    const res = parseTwitchEvent(body, verifiedTwitch({ eventType: "channel.update" }), headers);
    expect(res.kind).toBe("notification");
    if (res.kind === "notification") {
      expect(res.canonical.externalChannelId).toBe("999");
      expect(res.canonical.eventType).toBe("channel.update");
    }
  });

  it("does not parse when not verified (throws)", () => {
    const body = JSON.stringify({ subscription: { type: "stream.online" } });
    const headers = new Headers();
    const bad: VerificationResult = { status: "REJECTED", provider: "twitch", errorKind: "invalid_signature", message: "bad" };
    expect(() => parseTwitchEvent(body, bad, headers)).toThrow();
  });
});
