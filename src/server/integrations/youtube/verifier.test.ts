import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { verifyYouTubeRequest } from "./verifier";

describe("YouTube verifier", () => {
  const originalToken = process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN;

  beforeEach(() => {
    delete process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN;
  });
  afterEach(() => {
    if (originalToken === undefined) delete process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN;
    else process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN = originalToken;
  });

  it("challenge verification - valid", async () => {
    const challenge = "test-challenge-123";
    const req = new Request(`https://example.com/webhooks/youtube?hub.mode=subscribe&hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123&hub.challenge=${challenge}`, {
      method: "GET",
    });
    const res = await verifyYouTubeRequest(req, "");
    expect(res.status).toBe("VERIFIED");
    if (res.status === "VERIFIED") expect(res.challenge).toBe(challenge);
  });

  it("challenge with invalid verify_token rejected", async () => {
    process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN = "expected-token";
    const req = new Request("https://example.com/webhooks/youtube?hub.mode=subscribe&hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123&hub.challenge=ch&hub.verify_token=wrong", {
      method: "GET",
    });
    const res = await verifyYouTubeRequest(req, "");
    expect(res.status).toBe("REJECTED");
  });

  it("POST Atom notification verified", async () => {
    const body = `<?xml version="1.0"?><feed><entry><yt:videoId>vid123</yt:videoId></entry></feed>`;
    const req = new Request("https://example.com/webhooks/youtube", {
      method: "POST",
      headers: { "content-type": "application/atom+xml" },
    });
    const res = await verifyYouTubeRequest(req, body);
    expect(res.status).toBe("VERIFIED");
  });

  it("POST empty body malformed", async () => {
    const req = new Request("https://example.com/webhooks/youtube", { method: "POST", headers: {} });
    const res = await verifyYouTubeRequest(req, "");
    expect(res.status).toBe("MALFORMED");
  });

  it("POST non-XML malformed", async () => {
    const req = new Request("https://example.com/webhooks/youtube", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const res = await verifyYouTubeRequest(req, JSON.stringify({ not: "xml" }));
    expect(res.status).toBe("MALFORMED");
  });

  it("GET without challenge malformed", async () => {
    const req = new Request("https://example.com/webhooks/youtube", { method: "GET" });
    const res = await verifyYouTubeRequest(req, "");
    expect(res.status).toBe("MALFORMED");
  });

  it("does not pretend HMAC - no signature header required", async () => {
    const body = `<?xml version="1.0"?><feed></feed>`;
    const req = new Request("https://example.com/webhooks/youtube", { method: "POST" });
    const res = await verifyYouTubeRequest(req, body);
    // Should be VERIFIED without needing HMAC, proving we don't invent HMAC
    expect(res.status).toBe("VERIFIED");
  });
});
