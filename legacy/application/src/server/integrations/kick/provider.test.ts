import { describe, expect, it, vi, beforeEach } from "vitest";
import { KickClient, KickApiError, clearKickTokenCacheForTests } from "./client";
import { KickProvider } from "./provider";
import { clearKickTokenCache } from "./auth";
import { createInMemoryBudget } from "@/features/sponsor-sentinel/services/budget";

describe("Kick auth", () => {
  beforeEach(() => {
    clearKickTokenCache();
    clearKickTokenCacheForTests();
  });

  it("acquires app token and reuses (single fetch)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "kTok123", expires_in: 3600, token_type: "bearer" }), { status: 200 }),
    ) as unknown as typeof fetch;
    const { getKickAppToken } = await import("./auth");
    const t1 = await getKickAppToken("cid", "csec", fetchMock);
    const t2 = await getKickAppToken("cid", "csec", fetchMock);
    expect(t1).toBe("kTok123");
    expect(t2).toBe("kTok123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("auth failure throws", async () => {
    clearKickTokenCache();
    const fetchMock = vi.fn(async () => new Response("bad", { status: 401 })) as unknown as typeof fetch;
    const client = new KickClient({ clientId: "cid", clientSecret: "bad" }, fetchMock);
    await expect(client.getChannelsBySlug(["handle"])).rejects.toThrow();
  });
});

describe("Kick client", () => {
  beforeEach(() => {
    clearKickTokenCache();
    clearKickTokenCacheForTests();
  });

  it("sends Bearer and correct endpoint for channels", async () => {
    let captured: { url: string; auth: string | null } | null = null;
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      captured = { url: u, auth: (init?.headers as Record<string, string>)?.Authorization ?? null };
      return new Response(JSON.stringify({ data: [{ id: 1, slug: "playerkick", broadcaster_user_id: 999, stream_title: "title", category: { id: 1, name: "Just Chatting" }, stream: { custom_tags: ["Sponsor"] } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    await client.getChannelsBySlug(["playerkick"]);
    expect((captured as unknown as { auth: string | null } | null)?.auth).toBe("Bearer kTok");
    expect((captured as unknown as { url: string } | null)?.url).toContain("/public/v1/channels");
    expect((captured as unknown as { url: string } | null)?.url).toContain("slug=playerkick");
  });

  it("handles 404 not_found", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    await expect(client.getChannelsBySlug(["nope"])).rejects.toSatisfy((e: unknown) => (e as KickApiError).kind === "not_found");
  });

  it("handles 429 rate_limited with retry-after", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("rate limited", { status: 429, headers: { "Retry-After": "60" } });
    }) as unknown as typeof fetch;
    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    await expect(client.getChannelsBySlug(["a"])).rejects.toSatisfy((e: unknown) => (e as KickApiError).kind === "rate_limited" && (e as KickApiError).retryAfter === "60");
  });

  it("handles 5xx server", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("oops", { status: 500 });
    }) as unknown as typeof fetch;
    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    await expect(client.getChannelsBySlug(["a"])).rejects.toSatisfy((e: unknown) => (e as KickApiError).kind === "server");
  });

  it("handles malformed JSON", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("not json", { status: 200 });
    }) as unknown as typeof fetch;
    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    await expect(client.getChannelsBySlug(["a"])).rejects.toSatisfy((e: unknown) => (e as KickApiError).kind === "malformed");
  });

  it("does not leak token in error message", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "secretKick", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("forbidden", { status: 403 });
    }) as unknown as typeof fetch;
    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    try {
      await client.getChannelsBySlug(["a"]);
      expect.fail("should throw");
    } catch (e) {
      expect(String(e)).not.toContain("secretKick");
      expect(String(e)).not.toContain("Authorization");
    }
  });
});

describe("Kick provider", () => {
  beforeEach(() => {
    clearKickTokenCache();
    clearKickTokenCacheForTests();
  });

  it("channel resolver maps slug", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/public/v1/channels")) {
        return new Response(JSON.stringify({ data: [{ id: 1, slug: "playerkick", broadcaster_user_id: 999, stream_title: "Live Title", category: { id: 1, name: "Just Chatting" } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new KickProvider(new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const ch = await provider.resolveChannel("playerkick");
    expect(ch?.externalChannelId).toBe("999");
    expect(ch?.canonicalUrl).toBe("https://kick.com/playerkick");
  });

  it("unknown channel returns null", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new KickProvider(new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const ch = await provider.resolveChannel("nope");
    expect(ch).toBeNull();
  });

  it("live stream mapping with tags", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/public/v1/users/livestreams")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "kick-uuid-1",
                broadcaster_user: { id: 999, username: "playerkick" },
                channel: { slug: "playerkick" },
                category: { id: 1, name: "Just Chatting", thumbnail: "" },
                title: "Kick Live #OurBrand",
                tags: ["English"],
                thumbnail: "",
                viewer_count: 100,
                started_at: "2026-03-10T14:00:00Z",
                language_code: "en",
                has_mature_content: false,
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new KickProvider(new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const live = await provider.getLiveState({ platform: "kick", externalChannelId: "999", externalHandle: "playerkick", displayName: null, canonicalUrl: "https://kick.com/playerkick" });
    expect(live?.title).toBe("Kick Live #OurBrand");
    expect(live?.category?.id).toBe("1");
    expect(live?.isLive).toBe(true);
    expect(live?.description).toBeNull();
  });

  it("offline returns null", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new KickProvider(new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const live = await provider.getLiveState({ platform: "kick", externalChannelId: "999", externalHandle: "playerkick", displayName: null, canonicalUrl: "https://kick.com/playerkick" });
    expect(live).toBeNull();
  });

  it("category resolve with cache", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/public/v1/categories/")) {
        calls++;
        return new Response(JSON.stringify({ data: { id: 1, name: "Just Chatting" } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new KickProvider(new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const c1 = await provider.resolveCategory("1");
    const c2 = await provider.resolveCategory("1");
    expect(c1?.name).toBe("Just Chatting");
    expect(calls).toBe(1);
    expect(c2).toEqual(c1);
  });

  it("tags kick and kick_custom", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/public/v1/channels")) {
        return new Response(JSON.stringify({ data: [{ id: 1, slug: "playerkick", broadcaster_user_id: 999, stream: { custom_tags: ["SponsorTag"] } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new KickProvider(new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const tags = await provider.listTags({ platform: "kick", externalChannelId: "999", externalHandle: "playerkick", displayName: null, canonicalUrl: "https://kick.com/playerkick" });
    expect(tags.some((t) => t.source === "kick_custom")).toBe(true);
  });

  it("VOD unsupported returns empty", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new KickProvider(new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock));
    const vids = await provider.listVideos({ platform: "kick", externalChannelId: "999", externalHandle: "playerkick", displayName: null, canonicalUrl: "https://kick.com/playerkick" }, { from: "2026-03-01T00:00:00Z", to: "2026-03-31T00:00:00Z" });
    expect(vids).toEqual([]);
    // evaluator should mark VOD duration as NOT_SUPPORTED
    const { evaluateRule } = await import("@/features/sponsor-sentinel/services/evaluator");
    expect(evaluateRule({ type: "minimum_duration", minutes: 60 } as never, "kick", { kind: "none" }).result).toBe("NOT_SUPPORTED");
  });

  it("budget 429 handling", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("rate limited", { status: 429, headers: { "Retry-After": "60" } });
    }) as unknown as typeof fetch;
    const budget = createInMemoryBudget({ platform: "kick", limit: 300, windowMs: 60_000 });
    const provider = new KickProvider(new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock), budget);
    await expect(provider.getLiveState({ platform: "kick", externalChannelId: "999", externalHandle: "playerkick", displayName: null, canonicalUrl: "https://kick.com/playerkick" })).rejects.toSatisfy((e: unknown) => (e as KickApiError).kind === "rate_limited");
  });
});

describe("scanner integration with real Kick (mocked HTTP)", () => {
  beforeEach(() => {
    clearKickTokenCache();
    clearKickTokenCacheForTests();
  });

  it("scanner → Kick adapter → mocked HTTP → canonical → evaluator", async () => {
    const fetchMock = vi.fn(async (u: string | URL) => {
      const url = typeof u === "string" ? u : u.toString();
      if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "kTok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      if (url.includes("/public/v1/users/livestreams")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "kick-uuid-1",
                broadcaster_user: { id: 999, username: "playerkick" },
                channel: { slug: "playerkick" },
                category: { id: 1, name: "Just Chatting" },
                title: "Kick Live #OurBrand",
                tags: ["English"],
                started_at: "2026-03-10T14:00:00Z",
                viewer_count: 100,
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, fetchMock);
    const provider = new KickProvider(client);
    const live = await provider.getLiveState({ platform: "kick", externalChannelId: "999", externalHandle: "playerkick", displayName: null, canonicalUrl: "https://kick.com/playerkick" });
    expect(live?.title).toBe("Kick Live #OurBrand");
    const { evaluateRule } = await import("@/features/sponsor-sentinel/services/evaluator");
    const out = evaluateRule({ type: "required_hashtag", value: "#OurBrand" } as never, "kick", { kind: "live", data: live });
    expect(out.result).toBe("PASS");
    const vids = await provider.listVideos({ platform: "kick", externalChannelId: "999", externalHandle: "playerkick", displayName: null, canonicalUrl: "https://kick.com/playerkick" }, { from: "2026-03-01T00:00:00Z", to: "2026-03-31T00:00:00Z" });
    expect(vids.length).toBe(0);
  });
});
