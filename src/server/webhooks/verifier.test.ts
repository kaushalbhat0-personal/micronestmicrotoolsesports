import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookRequest } from "./verifier";

describe("generic webhook verifier boundary", () => {
  const originalTwitchSecret = process.env.TWITCH_EVENTSUB_SECRET;

  beforeEach(() => {
    process.env.TWITCH_EVENTSUB_SECRET = "test-secret-1234567890";
  });
  afterEach(() => {
    if (originalTwitchSecret === undefined) delete process.env.TWITCH_EVENTSUB_SECRET;
    else process.env.TWITCH_EVENTSUB_SECRET = originalTwitchSecret;
  });

  it("unsupported provider", async () => {
    const req = new Request("https://example.com/webhooks/unknown", { method: "POST" });
    const res = await verifyWebhookRequest(req, "{}");
    expect(res.status).toBe("UNSUPPORTED");
  });

  it("malformed request - empty body with Twitch headers missing", async () => {
    const req = new Request("https://example.com/api/webhooks/twitch", { method: "POST" });
    const res = await verifyWebhookRequest(req, "");
    expect(res.status).toBe("MALFORMED");
  });

  it("invalid encoding not crash", async () => {
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": "id",
        "Kick-Event-Message-Timestamp": new Date().toISOString(),
        "Kick-Event-Signature": "!!!notbase64",
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyWebhookRequest(req, "{}");
    expect(["MALFORMED", "REJECTED"].includes(res.status)).toBe(true);
  });

  it("provider isolation - Twitch signature not valid for Kick", async () => {
    const body = "{}";
    const id = "id1";
    const ts = new Date().toISOString();
    const sig = "sha256=" + createHmac("sha256", "test-secret-1234567890").update(id + ts + body).digest("hex");
    const req = new Request("https://example.com/webhooks/kick", {
      method: "POST",
      headers: {
        "Kick-Event-Message-Id": id,
        "Kick-Event-Message-Timestamp": ts,
        "Kick-Event-Signature": sig,
        "Kick-Event-Type": "chat.message.sent",
      },
    });
    const res = await verifyWebhookRequest(req, body);
    expect(res.status).not.toBe("VERIFIED");
  });

  it("verification failure does not invoke ingestion", async () => {
    // This test ensures verifier alone does not write DB; we just check status is not VERIFIED for bad sig
    const req = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": "id",
        "Twitch-Eventsub-Message-Timestamp": new Date().toISOString(),
        "Twitch-Eventsub-Message-Signature": "sha256=" + "0".repeat(64),
        "Twitch-Eventsub-Message-Type": "notification",
      },
    });
    const res = await verifyWebhookRequest(req, "{}");
    expect(res.status).toBe("REJECTED");
    // No DB side effect to check here - just ensure not VERIFIED
  });

  it("changing one byte of raw body invalidates Twitch signature", async () => {
    const body = JSON.stringify({ a: "1" });
    const id = "id1";
    const ts = new Date().toISOString();
    const secret = "test-secret-1234567890";
    const sig = "sha256=" + createHmac("sha256", secret).update(id + ts + body).digest("hex");
    const reqGood = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": id,
        "Twitch-Eventsub-Message-Timestamp": ts,
        "Twitch-Eventsub-Message-Signature": sig,
        "Twitch-Eventsub-Message-Type": "notification",
      },
    });
    const good = await verifyWebhookRequest(reqGood, body);
    expect(good.status).toBe("VERIFIED");

    const badBody = body + " ";
    const reqBad = new Request("https://example.com/webhooks/twitch", {
      method: "POST",
      headers: {
        "Twitch-Eventsub-Message-Id": id,
        "Twitch-Eventsub-Message-Timestamp": ts,
        "Twitch-Eventsub-Message-Signature": sig,
        "Twitch-Eventsub-Message-Type": "notification",
      },
    });
    const bad = await verifyWebhookRequest(reqBad, badBody);
    expect(bad.status).toBe("REJECTED");
  });

  it("no secret returned in error messages", async () => {
    const req = new Request("https://example.com/webhooks/twitch", { method: "POST" });
    const res = await verifyWebhookRequest(req, "");
    expect(JSON.stringify(res)).not.toContain("test-secret-1234567890");
  });
});
