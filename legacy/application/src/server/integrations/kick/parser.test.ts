import { describe, expect, it } from "vitest";
import { parseKickEvent } from "./parser";
import type { VerificationResult } from "@/server/webhooks/types";

function verifiedKick(overrides: Partial<VerificationResult> = {}, headers: Headers): VerificationResult {
  return {
    status: "VERIFIED",
    provider: "kick",
    eventId: headers.get("Kick-Event-Message-Id") ?? "kick-msg-1",
    eventType: headers.get("Kick-Event-Type") ?? "livestream.metadata.updated",
    timestamp: headers.get("Kick-Event-Message-Timestamp") ?? new Date().toISOString(),
    rawBody: "{}",
    ...overrides,
  } as VerificationResult;
}

describe("Kick parser", () => {
  it("verified notification parses, message ID becomes externalEventId", () => {
    const headers = new Headers({
      "Kick-Event-Message-Id": "kick-ulid-1",
      "Kick-Event-Subscription-Id": "sub-1",
      "Kick-Event-Type": "livestream.metadata.updated",
      "Kick-Event-Version": "1",
      "Kick-Event-Message-Timestamp": new Date().toISOString(),
    });
    const body = JSON.stringify({
      broadcaster: { user_id: 123456, username: "broadcaster", channel_slug: "broadcaster" },
      metadata: { title: "New Title", category: { id: 123, name: "IRL", thumbnail: "" } },
    });
    const res = parseKickEvent(body, verifiedKick({}, headers), headers);
    expect(res.canonical.externalEventId).toBe("kick-ulid-1");
    expect(res.canonical.eventType).toBe("livestream.metadata.updated");
    expect(res.canonical.externalChannelId).toBe("123456");
    expect(res.parsed.provider).toBe("kick");
    expect(res.canonical.metadata?.subscriptionId).toBe("sub-1");
  });

  it("subscription ID and version preserved", () => {
    const headers = new Headers({
      "Kick-Event-Message-Id": "m1",
      "Kick-Event-Type": "livestream.status.updated",
      "Kick-Event-Version": "1",
      "Kick-Event-Subscription-Id": "sub-xyz",
      "Kick-Event-Message-Timestamp": new Date().toISOString(),
    });
    const body = JSON.stringify({ broadcaster: { user_id: 999, username: "b" }, is_live: true, title: "Live" });
    const res = parseKickEvent(body, verifiedKick({}, headers), headers);
    expect(res.canonical.eventVersion).toBe("1");
    expect(res.parsed.subscriptionId).toBe("sub-xyz");
  });

  it("malformed JSON throws", () => {
    const headers = new Headers({
      "Kick-Event-Message-Id": "m1",
      "Kick-Event-Type": "livestream.metadata.updated",
      "Kick-Event-Message-Timestamp": new Date().toISOString(),
    });
    expect(() => parseKickEvent("not json", verifiedKick({}, headers), headers)).toThrow();
  });

  it("missing message id throws", () => {
    const headers = new Headers({
      "Kick-Event-Type": "livestream.metadata.updated",
      "Kick-Event-Message-Timestamp": new Date().toISOString(),
    });
    const bad: VerificationResult = { status: "VERIFIED", provider: "kick", rawBody: "{}", eventType: undefined, eventId: undefined } as unknown as VerificationResult;
    expect(() => parseKickEvent("{}", bad, headers)).toThrow();
  });

  it("invalid verification never reaches parser (throws)", () => {
    const headers = new Headers({
      "Kick-Event-Message-Id": "m1",
      "Kick-Event-Type": "livestream.metadata.updated",
      "Kick-Event-Message-Timestamp": new Date().toISOString(),
    });
    const bad: VerificationResult = { status: "REJECTED", provider: "kick", errorKind: "invalid_signature", message: "bad" };
    expect(() => parseKickEvent("{}", bad, headers)).toThrow();
  });

  it("preserves timestamp as occurredAt", () => {
    const ts = new Date().toISOString();
    const headers = new Headers({
      "Kick-Event-Message-Id": "m2",
      "Kick-Event-Type": "livestream.metadata.updated",
      "Kick-Event-Message-Timestamp": ts,
    });
    const body = JSON.stringify({ broadcaster: { user_id: 1, username: "a" } });
    const res = parseKickEvent(body, verifiedKick({}, headers), headers);
    expect(res.canonical.occurredAt).toBe(ts);
  });
});
