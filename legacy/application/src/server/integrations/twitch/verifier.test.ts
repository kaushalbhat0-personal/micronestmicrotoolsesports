import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyTwitchRequest } from "./verifier";

const SECRET = "test-secret-1234567890";
const HMAC_PREFIX = "sha256=";

function makeSignature(secret: string, messageId: string, timestamp: string, body: string): string {
  const msg = messageId + timestamp + body;
  return HMAC_PREFIX + createHmac("sha256", secret).update(msg).digest("hex");
}

describe("Twitch verifier", () => {
  const originalEnv = process.env.TWITCH_EVENTSUB_SECRET;

  beforeEach(() => {
    process.env.TWITCH_EVENTSUB_SECRET = SECRET;
  });
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TWITCH_EVENTSUB_SECRET;
    else process.env.TWITCH_EVENTSUB_SECRET = originalEnv;
  });

  it("valid signature", async () => {
    const body = JSON.stringify({ challenge: "test-challenge", subscription: { type: "channel.follow" } });
    const id = "test-id-123";
    const ts = new Date().toISOString();
    const sig = makeSignature(SECRET, id, ts, body);
    const req = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": id,
        "Twitch-Eventsub-Message-Timestamp": ts,
        "Twitch-Eventsub-Message-Signature": sig,
        "Twitch-Eventsub-Message-Type": "webhook_callback_verification",
      },
    });
    const res = await verifyTwitchRequest(req, body);
    expect(res.status).toBe("VERIFIED");
    if (res.status === "VERIFIED") expect(res.challenge).toBe("test-challenge");
  });

  it("invalid signature", async () => {
    const body = JSON.stringify({ event: {} });
    const id = "id1";
    const ts = new Date().toISOString();
    const req = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": id,
        "Twitch-Eventsub-Message-Timestamp": ts,
        "Twitch-Eventsub-Message-Signature": HMAC_PREFIX + "0".repeat(64),
        "Twitch-Eventsub-Message-Type": "notification",
      },
    });
    const res = await verifyTwitchRequest(req, body);
    expect(res.status).toBe("REJECTED");
  });

  it("missing signature header", async () => {
    const req = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": "id",
        "Twitch-Eventsub-Message-Timestamp": new Date().toISOString(),
      },
    });
    const res = await verifyTwitchRequest(req, "{}");
    expect(res.status).toBe("MALFORMED");
  });

  it("malformed signature", async () => {
    const req = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": "id",
        "Twitch-Eventsub-Message-Timestamp": new Date().toISOString(),
        "Twitch-Eventsub-Message-Signature": "not-hex",
        "Twitch-Eventsub-Message-Type": "notification",
      },
    });
    const res = await verifyTwitchRequest(req, "{}");
    expect(res.status).toBe("MALFORMED");
  });

  it("stale timestamp", async () => {
    const body = "{}";
    const id = "id1";
    const ts = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 min ago
    const sig = makeSignature(SECRET, id, ts, body);
    const req = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": id,
        "Twitch-Eventsub-Message-Timestamp": ts,
        "Twitch-Eventsub-Message-Signature": sig,
        "Twitch-Eventsub-Message-Type": "notification",
      },
    });
    const res = await verifyTwitchRequest(req, body);
    expect(res.status).toBe("STALE");
  });

  it("body modification causes failure", async () => {
    const body = JSON.stringify({ event: { user_id: "123" } });
    const id = "id1";
    const ts = new Date().toISOString();
    const sig = makeSignature(SECRET, id, ts, body);
    const modifiedBody = body + " ";
    const req = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": id,
        "Twitch-Eventsub-Message-Timestamp": ts,
        "Twitch-Eventsub-Message-Signature": sig,
        "Twitch-Eventsub-Message-Type": "notification",
      },
    });
    const res = await verifyTwitchRequest(req, modifiedBody);
    expect(res.status).toBe("REJECTED");
  });

  it("verification challenge behavior", async () => {
    const challenge = "pogchamp-kappa";
    const body = JSON.stringify({ challenge, subscription: { type: "channel.follow" } });
    const id = "id-challenge";
    const ts = new Date().toISOString();
    const sig = makeSignature(SECRET, id, ts, body);
    const req = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": id,
        "Twitch-Eventsub-Message-Timestamp": ts,
        "Twitch-Eventsub-Message-Signature": sig,
        "Twitch-Eventsub-Message-Type": "webhook_callback_verification",
      },
    });
    const res = await verifyTwitchRequest(req, body);
    expect(res.status).toBe("VERIFIED");
    if (res.status === "VERIFIED") {
      expect(res.challenge).toBe(challenge);
      expect(res.messageType).toBe("webhook_callback_verification");
    }
  });

  it("notification behavior", async () => {
    const body = JSON.stringify({ subscription: { type: "channel.follow", id: "sub1" }, event: { user_id: "1" } });
    const id = "id-notif";
    const ts = new Date().toISOString();
    const sig = makeSignature(SECRET, id, ts, body);
    const req = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": id,
        "Twitch-Eventsub-Message-Timestamp": ts,
        "Twitch-Eventsub-Message-Signature": sig,
        "Twitch-Eventsub-Message-Type": "notification",
      },
    });
    const res = await verifyTwitchRequest(req, body);
    expect(res.status).toBe("VERIFIED");
    if (res.status === "VERIFIED") expect(res.eventType).toBe("channel.follow");
  });

  it("revocation behavior", async () => {
    const body = JSON.stringify({ subscription: { type: "channel.follow", status: "authorization_revoked" } });
    const id = "id-rev";
    const ts = new Date().toISOString();
    const sig = makeSignature(SECRET, id, ts, body);
    const req = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": id,
        "Twitch-Eventsub-Message-Timestamp": ts,
        "Twitch-Eventsub-Message-Signature": sig,
        "Twitch-Eventsub-Message-Type": "revocation",
      },
    });
    const res = await verifyTwitchRequest(req, body);
    expect(res.status).toBe("VERIFIED");
    if (res.status === "VERIFIED") expect(res.messageType).toBe("revocation");
  });

  it("secret never appears in logs/errors", async () => {
    const req = new Request("https://example.com/webhooks/twitch", { method: "POST", headers: {} });
    const res = await verifyTwitchRequest(req, "");
    const str = JSON.stringify(res);
    expect(str).not.toContain(SECRET);
  });
});
