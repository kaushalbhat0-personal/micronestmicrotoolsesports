import { describe, expect, it, vi, beforeEach } from "vitest";
import { TwitchClient, TwitchApiError, clearTwitchTokenCacheForTests } from "./client";
import { TwitchProvider } from "./provider";
import { clearTwitchTokenCache } from "./auth";
import { createInMemoryBudget } from "@/features/sponsor-sentinel/services/budget";

const env = { TWITCH_CLIENT_ID: "cid", TWITCH_CLIENT_SECRET: "csec" };

describe("Twitch auth", () => {
  beforeEach(() => {
    clearTwitchTokenCache();
    clearTwitchTokenCacheForTests();
    vi.restoreAllMocks();
  });

  it("acquires app token and reuses (single fetch)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "tok123", expires_in: 3600, token_type: "bearer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const { getAppAccessToken } = await import("./auth");
    const t1 = await getAppAccessToken(env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET, fetchMock);
    const t2 = await getAppAccessToken(env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET, fetchMock);
    expect(t1).toBe("tok123");
    expect(t2).toBe("tok123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes on 401 once", async () => {
    clearTwitchTokenCache();
    let tokenCalls = 0;
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("oauth2/token")) {
        tokenCalls++;
        return new Response(JSON.stringify({ access_token: `tok${tokenCalls}`, expires_in: 3600, token_type: "bearer" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/helix/users")) {
        // First call with tok1 -> 401, second with tok2 -> 200
        if (tokenCalls === 1) return new Response("unauthorized", { status: 401 });
        return new Response(JSON.stringify({ data: [{ id: "123", login: "player1", display_name: "Player1" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Ratelimit-Remaining": "799", "Ratelimit-Reset": String(Math.floor(Date.now() / 1000) + 60) },
        });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new TwitchClient({ clientId: env.TWITCH_CLIENT_ID, clientSecret: env.TWITCH_CLIENT_SECRET }, fetchMock);
    const res = await client.getUsersByLogin(["player1"]);
    expect(res.data[0]?.login).toBe("player1");
    expect(tokenCalls).toBe(2);
  });

  it("auth failure throws", async () => {
    clearTwitchTokenCache();
    const fetchMock = vi.fn(async () => new Response("bad", { status: 401 })) as unknown as typeof fetch;
    const client = new TwitchClient({ clientId: "cid", clientSecret: "bad" }, fetchMock);
    await expect(client.getUsersByLogin(["x"])).rejects.toThrow();
  });
});

describe("Twitch client", () => {
  beforeEach(() => {
    clearTwitchTokenCache();
    clearTwitchTokenCacheForTests();
  });

  it("sends correct headers and query params", async () => {
    let captured: { url: string; headers: Record<string, string> } | null = null;
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      }
      captured = { url: u, headers: (init?.headers as unknown as Record<string, string>) ?? {} };
      return new Response(JSON.stringify({ data: [{ id: "1", login: "a", display_name: "A" }] }), {
        status: 200,
        headers: { "Ratelimit-Limit": "800", "Ratelimit-Remaining": "799", "Ratelimit-Reset": "9999999999" },
      });
    }) as unknown as typeof fetch;

    const client = new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    await client.getUsersByLogin(["player1", "player2"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((captured as any)?.headers["Client-Id"]).toBe("cid");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((captured as any)?.headers.Authorization).toBe("Bearer tok");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((captured as any)?.url).toContain("login=player1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((captured as any)?.url).toContain("login=player2");
  });

  it("handles 404 as not_found", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
    const client = new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    await expect(client.getUsersByLogin(["nonexistent"])).rejects.toThrow(/Helix error 404/);
    try {
      await client.getUsersByLogin(["x"]);
    } catch (e) {
      expect((e as TwitchApiError).kind).toBe("not_found");
    }
  });

  it("handles 429 with reset", async () => {
    const resetEpoch = Math.floor(Date.now() / 1000) + 120;
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("rate limited", { status: 429, headers: { "Ratelimit-Reset": String(resetEpoch), "Ratelimit-Remaining": "0", "Ratelimit-Limit": "800" } });
    }) as unknown as typeof fetch;
    const client = new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    await expect(client.getStreams(["123"])).rejects.toSatisfy((e: unknown) => (e as TwitchApiError).kind === "rate_limited" && (e as TwitchApiError).status === 429);
  });

  it("handles 5xx as server", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("oops", { status: 500 });
    }) as unknown as typeof fetch;
    const client = new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    await expect(client.getStreams(["123"])).rejects.toSatisfy((e: unknown) => (e as TwitchApiError).kind === "server");
  });

  it("handles malformed JSON", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("not json", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    const client = new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    await expect(client.getStreams(["123"])).rejects.toSatisfy((e: unknown) => (e as TwitchApiError).kind === "malformed");
  });

  it("does not leak Authorization in error message", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "secretTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("forbidden", { status: 403 });
    }) as unknown as typeof fetch;
    const client = new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    try {
      await client.getStreams(["123"]);
      expect.fail("should throw");
    } catch (e) {
      expect(String(e)).not.toContain("secretTok");
      expect(String(e)).not.toContain("Authorization");
    }
  });
});

describe("Twitch provider mapping", () => {
  beforeEach(() => {
    clearTwitchTokenCache();
    clearTwitchTokenCacheForTests();
  });

  it("live stream mapping", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/helix/streams")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "stream1",
                user_id: "123",
                user_login: "player1",
                title: "Epic #OurBrand",
                game_name: "League of Legends",
                game_id: "21779",
                tags: ["English"],
                started_at: "2026-03-10T14:00:00Z",
                type: "live",
              },
            ],
          }),
          { status: 200, headers: { "Ratelimit-Remaining": "799" } },
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new TwitchProvider(new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const live = await provider.getLiveState({ platform: "twitch", externalChannelId: "123", externalHandle: "player1", displayName: null, canonicalUrl: "https://twitch.tv/player1" });
    expect(live?.title).toBe("Epic #OurBrand");
    expect(live?.category?.id).toBe("21779");
    expect(live?.tags[0]?.source).toBe("twitch_curated");
    expect(live?.isLive).toBe(true);
  });

  it("offline returns null", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new TwitchProvider(new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const live = await provider.getLiveState({ platform: "twitch", externalChannelId: "123", externalHandle: "player1", displayName: null, canonicalUrl: "https://twitch.tv/player1" });
    expect(live).toBeNull();
  });

  it("video mapping with duration parsing", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/helix/videos")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "vod1",
                user_id: "123",
                title: "VOD #OurBrand",
                description: "desc sponsor",
                duration: "1h2m3s",
                created_at: "2026-03-10T14:00:00Z",
                published_at: "2026-03-10T16:00:00Z",
                viewable: "public",
                thumbnail_url: "",
                url: "https://twitch.tv/videos/vod1",
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new TwitchProvider(new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const vids = await provider.listVideos({ platform: "twitch", externalChannelId: "123", externalHandle: "player1", displayName: null, canonicalUrl: "https://twitch.tv/player1" }, { from: "2026-03-01T00:00:00Z", to: "2026-03-31T00:00:00Z" });
    expect(vids[0]?.durationSeconds).toBe(3723);
    expect(vids[0]?.description).toBe("desc sponsor");
  });

  it("category resolve with cache", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/helix/games")) {
        calls++;
        return new Response(JSON.stringify({ data: [{ id: "21779", name: "League of Legends" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new TwitchProvider(new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const c1 = await provider.resolveCategory("21779");
    const c2 = await provider.resolveCategory("21779");
    expect(c1?.name).toBe("League of Legends");
    expect(calls).toBe(1); // cached
    expect(c2).toEqual(c1);
  });

  it("tags return twitch_curated", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/helix/streams/tags")) {
        return new Response(JSON.stringify({ data: [{ tag_id: "English" }, { tag_id: "esports" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new TwitchProvider(new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const tags = await provider.listTags({ platform: "twitch", externalChannelId: "123", externalHandle: "p", displayName: null, canonicalUrl: "https://twitch.tv/p" });
    expect(tags.map((t) => t.source)).toEqual(["twitch_curated", "twitch_curated"]);
  });

  it("budget 429 handling", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("rate limited", { status: 429, headers: { "Ratelimit-Reset": String(Math.floor(Date.now() / 1000) + 60) } });
    }) as unknown as typeof fetch;
    const budget = createInMemoryBudget({ platform: "twitch", limit: 800, windowMs: 60_000 });
    const provider = new TwitchProvider(new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock), budget);
    await expect(provider.getLiveState({ platform: "twitch", externalChannelId: "123", externalHandle: "p", displayName: null, canonicalUrl: "https://twitch.tv/p" })).rejects.toSatisfy((e: unknown) => (e as TwitchApiError).kind === "rate_limited");
  });

  it("channel resolver", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/helix/users")) {
        return new Response(JSON.stringify({ data: [{ id: "123", login: "player1", display_name: "Player1" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new TwitchProvider(new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const ch = await provider.resolveChannel("player1");
    expect(ch?.canonicalUrl).toBe("https://twitch.tv/player1");
    expect(ch?.externalChannelId).toBe("123");
  });
});

describe("scanner integration with real Twitch (mocked Helix)", () => {
  beforeEach(() => {
    clearTwitchTokenCache();
    clearTwitchTokenCacheForTests();
  });

  it("scanner → Twitch adapter → mocked Helix → canonical → evaluator → persistence", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/helix/streams")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "s1",
                user_id: "123",
                user_login: "player1",
                title: "Live #OurBrand",
                game_name: "League of Legends",
                game_id: "21779",
                tags: ["English"],
                started_at: "2026-03-10T14:00:00Z",
                type: "live",
              },
            ],
          }),
          { status: 200, headers: { "Ratelimit-Remaining": "799", "Ratelimit-Reset": String(Math.floor(Date.now() / 1000) + 60) } },
        );
      }
      if (url.includes("/helix/videos")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "v1",
                user_id: "123",
                title: "VOD OurBrand",
                description: "sponsor desc",
                duration: "1h0m0s",
                created_at: "2026-03-10T14:00:00Z",
                published_at: "2026-03-10T16:00:00Z",
                viewable: "public",
                thumbnail_url: "",
                url: "https://twitch.tv/videos/v1",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/helix/users")) {
        return new Response(JSON.stringify({ data: [{ id: "123", login: "player1", display_name: "Player1" }] }), { status: 200 });
      }
      if (url.includes("/helix/games")) {
        return new Response(JSON.stringify({ data: [{ id: "21779", name: "League of Legends" }] }), { status: 200 });
      }
      if (url.includes("/helix/streams/tags")) {
        return new Response(JSON.stringify({ data: [{ tag_id: "English" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new TwitchClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    const provider = new TwitchProvider(client);

    // Simulate scanner fetch -> evaluate -> persist (without DB, just in-memory check)
    const live = await provider.getLiveState({ platform: "twitch", externalChannelId: "123", externalHandle: "player1", displayName: null, canonicalUrl: "https://twitch.tv/player1" });
    expect(live?.title).toBe("Live #OurBrand");

    const { evaluateRule } = await import("@/features/sponsor-sentinel/services/evaluator");
    const outcome = evaluateRule({ type: "required_title_contains", value: "OurBrand" } as never, "twitch", { kind: "live", data: live });
    expect(outcome.result).toBe("PASS");

    const vids = await provider.listVideos({ platform: "twitch", externalChannelId: "123", externalHandle: "player1", displayName: null, canonicalUrl: "https://twitch.tv/player1" }, { from: "2026-03-01T00:00:00Z", to: "2026-03-31T00:00:00Z" });
    expect(vids[0]?.durationSeconds).toBe(3600);
  });
});
