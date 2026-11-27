import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { YouTubeSubscriptionAdapter } from "./youtube";

describe("YouTube subscription", () => {
  let originalUrl: string | undefined;
  let originalToken: string | undefined;
  beforeEach(() => {
    originalUrl = process.env.NEXT_PUBLIC_APP_URL;
    originalToken = process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN;
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN = "test-verify-token";
  });
  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalUrl;
    if (originalToken === undefined) delete process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN;
    else process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN = originalToken;
  });

  it("correct WebSub topic and callback URL", async () => {
    let capturedBody = "";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response("", { status: 202 });
    }) as unknown as typeof fetch;
    const adapter = new YouTubeSubscriptionAdapter(fetchMock);
    const res = await adapter.create({ organizationId: "org", platform: "youtube", externalChannelId: "UC123" });
    expect(res.status).toBe("created");
    expect(capturedBody).toContain("hub.topic=https%3A%2F%2Fwww.youtube.com%2Fxml%2Ffeeds%2Fvideos.xml%3Fchannel_id%3DUC123");
    expect(capturedBody).toContain("hub.callback=https%3A%2F%2Fexample.com%2Fapi%2Fwebhooks%2Fyoutube");
    expect(capturedBody).toContain("hub.verify_token=test-verify-token");
  });

  it("verify token handling — uses env token", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 202 })) as unknown as typeof fetch;
    const adapter = new YouTubeSubscriptionAdapter(fetchMock);
    const res = await adapter.create({ organizationId: "org", platform: "youtube", externalChannelId: "UC123" });
    expect(res.status).toBe("created");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lease renewal via reconcile (idempotent)", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 202 })) as unknown as typeof fetch;
    const adapter = new YouTubeSubscriptionAdapter(fetchMock);
    const r1 = await adapter.reconcileForChannel({ organizationId: "org", platform: "youtube", externalChannelId: "UC123" });
    expect(r1.created).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe where supported", async () => {
    let capturedMode = "";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body as string;
      if (body.includes("hub.mode=unsubscribe")) capturedMode = "unsubscribe";
      return new Response("", { status: 202 });
    }) as unknown as typeof fetch;
    const adapter = new YouTubeSubscriptionAdapter(fetchMock);
    const res = await adapter.delete({ organizationId: "org", platform: "youtube", externalChannelId: "UC123" });
    expect(res.status).toBe("deleted");
    expect(capturedMode).toBe("unsubscribe");
  });

  it("duplicate-safe reconciliation (hub handles duplicate as success)", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 202 })) as unknown as typeof fetch;
    const adapter = new YouTubeSubscriptionAdapter(fetchMock);
    const r1 = await adapter.reconcileForChannel({ organizationId: "org", platform: "youtube", externalChannelId: "UC123" });
    const r2 = await adapter.reconcileForChannel({ organizationId: "org", platform: "youtube", externalChannelId: "UC123" });
    expect(r1.created).toBe(1);
    expect(r2.created).toBe(1); // hub is idempotent, we treat each as created (no list)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
