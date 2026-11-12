import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TwitchSubscriptionAdapter } from "./twitch";
import { TwitchClient } from "@/server/integrations/twitch/client";

describe("Twitch subscription", () => {
  let originalSecret: string | undefined;
  let originalAppUrl: string | undefined;
  beforeEach(() => {
    originalSecret = process.env.TWITCH_EVENTSUB_SECRET;
    originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.TWITCH_EVENTSUB_SECRET = "test-secret-1234567890";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  });
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.TWITCH_EVENTSUB_SECRET;
    else process.env.TWITCH_EVENTSUB_SECRET = originalSecret;
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("correct subscription request with condition and callback transport", async () => {
    let captured: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/eventsub/subscriptions") && init?.method === "POST") {
        captured = JSON.parse(init.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify({ data: [{ id: "sub-1", status: "webhook_callback_verification_pending" }] }), { status: 200, headers: { "Ratelimit-Limit": "800" } });
      }
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    process.env.TWITCH_CLIENT_ID = "cid";
    process.env.TWITCH_CLIENT_SECRET = "csec";
    const client = new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    const adapter = new TwitchSubscriptionAdapter(client);
    const res = await adapter.create({ organizationId: "org", platform: "twitch", externalChannelId: "123", eventType: "stream.online" });
    expect(res.status).toBe("created");
    expect(captured).toBeTruthy();
    expect((captured as unknown as Record<string, unknown>).type).toBe("stream.online");
    expect(((captured as unknown as Record<string, unknown>).condition as Record<string, string>).broadcaster_user_id).toBe("123");
    const transport = (captured as unknown as Record<string, unknown>).transport as Record<string, string>;
    expect(transport.method).toBe("webhook");
    expect(transport.callback).toBe("https://example.com/api/webhooks/twitch");
    expect(transport.secret).toBe("test-secret-1234567890");
  });

  it("existing subscription reconciliation is duplicate-safe", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      if (url.includes("/eventsub/subscriptions") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            data: [
              { id: "existing-1", status: "enabled", type: "stream.online", version: "1", condition: { broadcaster_user_id: "123" }, transport: { method: "webhook", callback: "https://example.com/api/webhooks/twitch" } },
              { id: "existing-2", status: "enabled", type: "stream.offline", version: "1", condition: { broadcaster_user_id: "123" }, transport: { method: "webhook", callback: "https://example.com/api/webhooks/twitch" } },
              { id: "existing-3", status: "enabled", type: "channel.update", version: "1", condition: { broadcaster_user_id: "123" }, transport: { method: "webhook", callback: "https://example.com/api/webhooks/twitch" } },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error("unexpected fetch " + url);
    }) as unknown as typeof fetch;

    const client = new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    const adapter = new TwitchSubscriptionAdapter(client);
    const res = await adapter.reconcileForChannel({ organizationId: "org", platform: "twitch", externalChannelId: "123" });
    expect(res.alreadyExists).toBe(3);
    expect(res.created).toBe(0);
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("eventsub/subscriptions"), expect.objectContaining({ method: "POST" }));
  });

  it("provider error handling maps kinds", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      if (url.includes("/eventsub/subscriptions")) return new Response("server error", { status: 500 });
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    const adapter = new TwitchSubscriptionAdapter(client);
    const res = await adapter.create({ organizationId: "org", platform: "twitch", externalChannelId: "123", eventType: "stream.online" });
    expect(res.status).toBe("failed");
    expect(res.errorKind).toBe("server");
    expect(JSON.stringify(res)).not.toContain("cid");
  });

  it("expiration handling — twitch has no expiration (supportsExpiration false)", async () => {
    const adapter = new TwitchSubscriptionAdapter({} as TwitchClient);
    expect(adapter.getCapabilities().supportsExpiration).toBe(false);
  });
});
