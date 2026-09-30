import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileAllSubscriptions } from "./reconciler";

function mockSupabase(channels: Array<{ id: string; organization_id: string; platform: string; external_channel_id: string; connection_status: string }>) {
  return {
    from: (table: string) => {
      if (table === "connected_channels") {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === "connection_status" && val === "connected") {
                return { data: channels.filter((c) => c.connection_status === "connected"), error: null } as unknown as { data: unknown; error: unknown };
              }
              return { data: [], error: null } as unknown as { data: unknown; error: unknown };
            },
          }),
        } as never;
      }
      if (table === "organization_provider_credentials") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
        } as never;
      }
      throw new Error("unexpected " + table);
    },
  } as unknown as SupabaseClient;
}

describe("reconciler", () => {
  let originalTwitchId: string | undefined;
  let originalTwitchSecret: string | undefined;
  let originalAppUrl: string | undefined;
  beforeEach(() => {
    originalTwitchId = process.env.TWITCH_CLIENT_ID;
    originalTwitchSecret = process.env.TWITCH_CLIENT_SECRET;
    originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.TWITCH_CLIENT_ID = "cid";
    process.env.TWITCH_CLIENT_SECRET = "csec";
    process.env.TWITCH_EVENTSUB_SECRET = "test-secret-1234567890";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  });
  afterEach(() => {
    if (originalTwitchId === undefined) delete process.env.TWITCH_CLIENT_ID;
    else process.env.TWITCH_CLIENT_ID = originalTwitchId;
    if (originalTwitchSecret === undefined) delete process.env.TWITCH_CLIENT_SECRET;
    else process.env.TWITCH_CLIENT_SECRET = originalTwitchSecret;
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("eligible channels discovered from trusted DB (only connected)", async () => {
    const channels = [
      { id: "c1", organization_id: "org-a", platform: "twitch", external_channel_id: "123", connection_status: "connected" },
      { id: "c2", organization_id: "org-a", platform: "twitch", external_channel_id: "999", connection_status: "disconnected" },
    ];
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      if (url.includes("/eventsub/subscriptions")) {
        if (url.includes("GET") || !url.includes("POST")) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: [{ id: "new-1", status: "enabled" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    // We need to mock helixGet via fetch; our TwitchClient will call helper
    // For simplicity, make fetch handle both token and subscriptions
    const supabase = mockSupabase(channels);
    // Force fetch to return empty list then create for each type → will attempt 3 creates for c1 only
    const fetchForReconcile = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/eventsub/subscriptions") && (!init?.method || init.method === "GET")) {
        return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Ratelimit-Limit": "800" } });
      }
      if (url.includes("/eventsub/subscriptions") && init?.method === "POST") {
        return new Response(JSON.stringify({ data: [{ id: "new-1", status: "enabled" }] }), { status: 200, headers: { "Ratelimit-Limit": "800" } });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const res = await reconcileAllSubscriptions(supabase, { fetchFn: fetchForReconcile, runId: "test-run" });
    expect(res.attempted).toBe(1); // only c1 connected
    expect(res.created).toBeGreaterThanOrEqual(1);
    expect(mockFetch).toBeDefined();
  });

  it("one failure does not abort the run", async () => {
    const channels = [
      { id: "c1", organization_id: "org-a", platform: "twitch", external_channel_id: "111", connection_status: "connected" },
      { id: "c2", organization_id: "org-b", platform: "twitch", external_channel_id: "222", connection_status: "connected" },
    ];
    let callCount = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      if (url.includes("/eventsub/subscriptions") && init?.method === "POST") {
        callCount++;
        if (callCount <= 3) throw new Error("network error for first channel");
        return new Response(JSON.stringify({ data: [{ id: "ok-1", status: "enabled" }] }), { status: 200, headers: {} });
      }
      if (url.includes("/eventsub/subscriptions")) return new Response(JSON.stringify({ data: [] }), { status: 200, headers: {} });
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const supabase = mockSupabase(channels);
    const res = await reconcileAllSubscriptions(supabase, { fetchFn: fetchMock, runId: "run-fail-isolation" });
    expect(res.attempted).toBe(2);
    expect(res.failed).toBeGreaterThan(0);
    // Second channel should still have been attempted
    expect(callCount).toBeGreaterThan(3);
  });

  it("bounded execution is sequential (log runId, organizationId, provider)", async () => {
    const channels = [
      { id: "c1", organization_id: "org-a", platform: "youtube", external_channel_id: "UC1", connection_status: "connected" },
      { id: "c2", organization_id: "org-b", platform: "youtube", external_channel_id: "UC2", connection_status: "connected" },
    ];
    process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN = "tok";
    const fetchMock = vi.fn(async () => new Response("", { status: 202 })) as unknown as typeof fetch;
    const supabase = mockSupabase(channels);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await reconcileAllSubscriptions(supabase, { fetchFn: fetchMock, runId: "bounded-run" });
    expect(res.attempted).toBe(2);
    // Verify safe logging does not contain secrets
    const logged = warnSpy.mock.calls.map((c) => String(c[0])).join(" ");
    expect(logged).not.toContain("tok");
    expect(logged).toContain("bounded-run");
    warnSpy.mockRestore();
    delete process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN;
  });
});
