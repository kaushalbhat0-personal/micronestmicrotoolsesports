import { describe, expect, it, vi } from "vitest";
import { YouTubeClient, YouTubeApiError } from "./client";
import { YouTubeProvider } from "./provider";
import { createInMemoryBudget } from "@/features/sponsor-sentinel/services/budget";

describe("YouTube client", () => {
  it("appends api key query and correct endpoint", async () => {
    let capturedUrl = "";
    const fetchMock = vi.fn(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ items: [{ id: "UC123", snippet: { title: "Channel", description: "desc", customUrl: "@handle" } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new YouTubeClient({ apiKey: "test-key" }, fetchMock);
    await client.channelsList({ id: "UC123" });
    expect(capturedUrl).toContain("www.googleapis.com/youtube/v3/channels");
    expect(capturedUrl).toContain("key=test-key");
    expect(capturedUrl).toContain("id=UC123");
  });

  it("handles quota exceeded 403", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "quotaExceeded", errors: [{ reason: "quotaExceeded" }] } }), { status: 403 }),
    ) as unknown as typeof fetch;
    const client = new YouTubeClient({ apiKey: "k" }, fetchMock);
    await expect(client.videosList({ id: "vid1" })).rejects.toSatisfy((e: unknown) => (e as YouTubeApiError).kind === "quota_exceeded");
  });

  it("handles 429 rate_limited", async () => {
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    const client = new YouTubeClient({ apiKey: "k" }, fetchMock);
    await expect(client.videosList({ id: "vid1" })).rejects.toSatisfy((e: unknown) => (e as YouTubeApiError).kind === "rate_limited");
  });

  it("handles 404 not_found", async () => {
    const fetchMock = vi.fn(async () => new Response("not found", { status: 404 })) as unknown as typeof fetch;
    const client = new YouTubeClient({ apiKey: "k" }, fetchMock);
    await expect(client.channelsList({ id: "bad" })).rejects.toSatisfy((e: unknown) => (e as YouTubeApiError).kind === "not_found");
  });

  it("handles 5xx as server", async () => {
    const fetchMock = vi.fn(async () => new Response("oops", { status: 500 })) as unknown as typeof fetch;
    const client = new YouTubeClient({ apiKey: "k" }, fetchMock);
    await expect(client.channelsList({ id: "UC123" })).rejects.toSatisfy((e: unknown) => (e as YouTubeApiError).kind === "server");
  });

  it("handles malformed JSON", async () => {
    const fetchMock = vi.fn(async () => new Response("not json", { status: 200 })) as unknown as typeof fetch;
    const client = new YouTubeClient({ apiKey: "k" }, fetchMock);
    await expect(client.channelsList({ id: "UC123" })).rejects.toSatisfy((e: unknown) => (e as YouTubeApiError).kind === "malformed");
  });

  it("does not leak api key in error message", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: "key=secret123" } }), { status: 403 })) as unknown as typeof fetch;
    const client = new YouTubeClient({ apiKey: "secret123" }, fetchMock);
    try {
      await client.channelsList({ id: "UC123" });
      expect.fail("should throw");
    } catch (e) {
      expect(String(e)).not.toContain("secret123");
      expect(String(e)).toContain("key=***");
    }
  });

  it("handles search pagination nextPageToken", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/search")) {
        return new Response(JSON.stringify({ items: [{ id: { videoId: "vid1" }, snippet: { title: "t", publishedAt: "2026-03-10T14:00:00Z", channelId: "UC123" } }], nextPageToken: "token123" }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new YouTubeClient({ apiKey: "k" }, fetchMock);
    const res = await client.searchList({ channelId: "UC123" });
    expect(res.nextPageToken).toBe("token123");
  });
});

describe("YouTube provider", () => {
  it("channel ID resolution", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/channels")) {
        return new Response(JSON.stringify({ items: [{ id: "UC123", snippet: { title: "Channel Title", description: "desc", customUrl: "@handle" } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock));
    const ch = await provider.resolveChannel("UC1234567890");
    expect(ch?.externalChannelId).toBe("UC123");
    expect(ch?.canonicalUrl).toBe("https://youtube.com/channel/UC123");
  });

  it("handle resolution via forHandle", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("forHandle")) {
        return new Response(JSON.stringify({ items: [{ id: "UC999", snippet: { title: "Handle Channel", description: "", customUrl: "@myhandle" } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock));
    const ch = await provider.resolveChannel("@myhandle");
    expect(ch?.externalChannelId).toBe("UC999");
  });

  it("unknown channel returns null", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })) as unknown as typeof fetch;
    const provider = new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock));
    const ch = await provider.resolveChannel("UC0000000000");
    expect(ch).toBeNull();
  });

  it("live broadcast found via search+videos", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/search") && url.includes("eventType=live")) {
        return new Response(JSON.stringify({ items: [{ id: { videoId: "liveVid" }, snippet: { title: "Live #OurBrand", publishedAt: "2026-03-10T14:00:00Z", channelId: "UC123" } }] }), { status: 200 });
      }
      if (url.includes("/videos") && url.includes("liveVid")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "liveVid",
                snippet: { title: "Live #OurBrand", description: "desc", tags: ["Sponsor"], categoryId: "20", publishedAt: "2026-03-10T14:00:00Z", channelId: "UC123", liveBroadcastContent: "live" },
                contentDetails: { duration: "PT0S" },
                liveStreamingDetails: { actualStartTime: "2026-03-10T14:00:00Z" },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock));
    const live = await provider.getLiveState({ platform: "youtube", externalChannelId: "UC123", externalHandle: "@handle", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" });
    expect(live?.isLive).toBe(true);
    expect(live?.title).toBe("Live #OurBrand");
    expect(live?.tags[0]?.source).toBe("youtube_freeform");
  });

  it("no live returns null", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/search")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock));
    const live = await provider.getLiveState({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" });
    expect(live).toBeNull();
  });

  it("video VOD mapping with duration and category", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/search")) {
        return new Response(
          JSON.stringify({ items: [{ id: { videoId: "vid1" }, snippet: { title: "t", publishedAt: "2026-03-10T16:00:00Z", channelId: "UC123" } }] }),
          { status: 200 },
        );
      }
      if (url.includes("/videos")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "vid1",
                snippet: { title: "VOD OurBrand", description: "sponsor desc", tags: ["Sponsor"], categoryId: "20", publishedAt: "2026-03-10T16:00:00Z", channelId: "UC123", liveBroadcastContent: "none" },
                contentDetails: { duration: "PT1H0M0S" },
                liveStreamingDetails: { actualStartTime: "2026-03-10T14:00:00Z", actualEndTime: "2026-03-10T15:00:00Z" },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock));
    const vids = await provider.listVideos({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" }, { from: "2026-03-01T00:00:00Z", to: "2026-03-31T00:00:00Z" });
    expect(vids[0]?.durationSeconds).toBe(3600);
    expect(vids[0]?.description).toBe("sponsor desc");
    expect(vids[0]?.canonicalUrl).toBe("https://youtube.com/watch?v=vid1");
  });

  it("category cache", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/videoCategories")) {
        calls++;
        return new Response(JSON.stringify({ items: [{ id: "20", snippet: { title: "Gaming" } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock));
    const c1 = await provider.resolveCategory("20");
    const c2 = await provider.resolveCategory("20");
    expect(c1?.name).toBe("Gaming");
    expect(calls).toBe(1);
    expect(c2).toEqual(c1);
  });

  it("tags freeform", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/search")) {
        return new Response(JSON.stringify({ items: [{ id: { videoId: "vid1" } }] }), { status: 200 });
      }
      if (url.includes("/videos")) {
        return new Response(JSON.stringify({ items: [{ id: "vid1", snippet: { title: "t", description: "", tags: ["TagA", "TagB"], categoryId: "20", publishedAt: "2026-03-10T14:00:00Z", channelId: "UC123", liveBroadcastContent: "none" }, contentDetails: { duration: "PT0S" } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock));
    const tags = await provider.listTags({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" });
    expect(tags.map((t) => t.source)).toEqual(["youtube_freeform", "youtube_freeform"]);
  });

  it("budget insufficient before search", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })) as unknown as typeof fetch;
    const budget = createInMemoryBudget({ platform: "youtube", limit: 1, windowMs: 60_000 }, 0);
    const searchBudget = createInMemoryBudget({ platform: "youtube", limit: 1, windowMs: 60_000 }, 0);
    const provider = new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock), budget, searchBudget);
    await expect(provider.getLiveState({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" })).rejects.toSatisfy((e: unknown) => (e as YouTubeApiError).kind === "quota_exceeded");
  });

  it("pagination bounded (max 3 pages, max 25)", async () => {
    let searchCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/search")) {
        searchCalls++;
        return new Response(JSON.stringify({ items: [{ id: { videoId: `vid${searchCalls}` }, snippet: { title: "t", publishedAt: "2026-03-10T16:00:00Z", channelId: "UC123" } }], nextPageToken: searchCalls < 5 ? "next" : undefined }), { status: 200 });
      }
      if (url.includes("/videos")) {
        return new Response(JSON.stringify({ items: [{ id: "vid1", snippet: { title: "t", description: "", tags: [], categoryId: "20", publishedAt: "2026-03-10T16:00:00Z", channelId: "UC123", liveBroadcastContent: "none" }, contentDetails: { duration: "PT0S" } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock));
    await provider.listVideos({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" }, { from: "2026-03-01T00:00:00Z", to: "2026-03-31T00:00:00Z" });
    expect(searchCalls).toBe(3); // bounded to 3, not unbounded
  });
});

describe("scanner integration with real YouTube (mocked HTTP)", () => {
  it("scanner → YouTube adapter → mocked HTTP → canonical → evaluator", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/search") && url.includes("eventType=live")) {
        return new Response(JSON.stringify({ items: [{ id: { videoId: "liveVid" }, snippet: { title: "Live #OurBrand", publishedAt: "2026-03-10T14:00:00Z", channelId: "UC123" } }] }), { status: 200 });
      }
      if (url.includes("/videos") && url.includes("liveVid")) {
        return new Response(
          JSON.stringify({
            items: [{ id: "liveVid", snippet: { title: "Live #OurBrand", description: "desc", tags: ["Sponsor"], categoryId: "20", publishedAt: "2026-03-10T14:00:00Z", channelId: "UC123", liveBroadcastContent: "live" }, contentDetails: { duration: "PT0S" }, liveStreamingDetails: { actualStartTime: "2026-03-10T14:00:00Z" } }],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new YouTubeClient({ apiKey: "k" }, fetchMock);
    const provider = new YouTubeProvider(client);
    const live = await provider.getLiveState({ platform: "youtube", externalChannelId: "UC123", externalHandle: "handle", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" });
    expect(live?.isLive).toBe(true);
    const { evaluateRule } = await import("@/features/sponsor-sentinel/services/evaluator");
    const out = evaluateRule({ type: "required_hashtag", value: "#OurBrand" } as never, "youtube", { kind: "live", data: live });
    expect(out.result).toBe("PASS");
  });
});
