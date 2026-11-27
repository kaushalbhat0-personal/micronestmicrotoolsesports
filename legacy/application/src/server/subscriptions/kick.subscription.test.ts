import { describe, expect, it, vi } from "vitest";
import { KickSubscriptionAdapter } from "./kick";
import { KickClient } from "@/server/integrations/kick/client";

describe("Kick subscription", () => {
  it("correct event subscription request with broadcaster identity", async () => {
    let captured: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("id.kick.com/oauth/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/events/subscriptions") && init?.method === "POST") {
        captured = JSON.parse(init.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify({ data: [{ subscription_id: "k-sub-1", name: "livestream.metadata.updated", version: 1 }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    const adapter = new KickSubscriptionAdapter(client);
    const res = await adapter.create({ organizationId: "org", platform: "kick", externalChannelId: "777", eventType: "livestream.metadata.updated" });
    expect(res.status).toBe("created");
    expect(captured).toBeTruthy();
    expect((captured as unknown as Record<string, unknown>).broadcaster_user_id).toBe(777);
    expect(((captured as unknown as Record<string, unknown>).events as unknown as Array<{ name: string }>)[0]?.name).toBe("livestream.metadata.updated");
    expect((captured as unknown as Record<string, unknown>).method).toBe("webhook");
  });

  it("duplicate-safe behavior via list", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/events/subscriptions") && (!init?.method || init.method === "GET")) {
        return new Response(JSON.stringify({ data: [{ id: "existing-kick-1", event: "livestream.metadata.updated", broadcaster_user_id: 777 }, { id: "existing-kick-2", event: "livestream.status.updated", broadcaster_user_id: 777 }] }), { status: 200 });
      }
      throw new Error("unexpected " + url);
    }) as unknown as typeof fetch;
    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    const adapter = new KickSubscriptionAdapter(client);
    const res = await adapter.reconcileForChannel({ organizationId: "org", platform: "kick", externalChannelId: "777" });
    expect(res.alreadyExists).toBe(2);
    expect(res.created).toBe(0);
  });

  it("unsupported event rejected", async () => {
    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, vi.fn() as unknown as typeof fetch);
    const adapter = new KickSubscriptionAdapter(client);
    const res = await adapter.create({ organizationId: "org", platform: "kick", externalChannelId: "777", eventType: "chat.message.sent" });
    expect(res.status).toBe("unsupported");
  });

  it("provider error handling", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      return new Response("server err", { status: 500 });
    }) as unknown as typeof fetch;
    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    const adapter = new KickSubscriptionAdapter(client);
    const res = await adapter.create({ organizationId: "org", platform: "kick", externalChannelId: "777", eventType: "livestream.metadata.updated" });
    expect(res.status).toBe("failed");
    expect(res.errorKind).toBe("server");
  });
});
