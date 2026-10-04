import { describe, expect, it, vi } from "vitest";
import { YouTubeClient } from "./client";
import { YouTubeProvider } from "./provider";
import { createInMemoryBudget } from "@/features/sponsor-sentinel/services/budget";

function providerWithFetch(fetchMock: typeof fetch) {
  return new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock as unknown as typeof fetch));
}

describe("YouTube historical discovery — uploads playlist (search-free)", () => {
  it("does NOT call search.list for historical discovery", async () => {
    let searchCalled = false;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/search")) searchCalled = true;
      if (url.includes("/channels")) return new Response(JSON.stringify({ items: [{ id: "UC123", snippet: { title: "t", description: "d" }, contentDetails: { relatedPlaylists: { uploads: "UU123" } } }] }), { status: 200 });
      if (url.includes("/playlistItems")) return new Response(JSON.stringify({ items: [{ snippet: { publishedAt: "2026-03-10T16:00:00Z", title: "t", resourceId: { videoId: "vid1" } }, contentDetails: { videoId: "vid1" } }] }), { status: 200 });
      if (url.includes("/videos")) return new Response(JSON.stringify({ items: [{ id: "vid1", snippet: { title: "VOD #spirituality", description: "desc", tags: [], categoryId: "20", publishedAt: "2026-03-10T16:00:00Z", channelId: "UC123", liveBroadcastContent: "none" }, contentDetails: { duration: "PT30S" } }] }), { status: 200 });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = providerWithFetch(fetchMock);
    await provider.listVideos({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" }, { from: "2026-03-01T00:00:00Z", to: "2026-03-31T00:00:00Z" });
    expect(searchCalled).toBe(false);
  });

  it("resolves uploads playlist via channels.list contentDetails", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes("/channels")) return new Response(JSON.stringify({ items: [{ id: "UCABC", snippet: { title: "t", description: "d" }, contentDetails: { relatedPlaylists: { uploads: "UUABC" } } }] }), { status: 200 });
      if (url.includes("/playlistItems")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = providerWithFetch(fetchMock);
    await provider.listVideos({ platform: "youtube", externalChannelId: "UCABC", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UCABC" }, { from: "2026-01-01T00:00:00Z", to: "2026-12-31T00:00:00Z" });
    expect(urls.some((u) => u.includes("/channels") && u.includes("contentDetails"))).toBe(true);
    expect(urls.some((u) => u.includes("/playlistItems") && u.includes("UUABC"))).toBe(true);
  });

  it("campaign timeframe filtering — only videos inside window", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/channels")) return new Response(JSON.stringify({ items: [{ id: "UC123", snippet: { title: "t", description: "d" }, contentDetails: { relatedPlaylists: { uploads: "UU123" } } }] }), { status: 200 });
      if (url.includes("/playlistItems")) return new Response(JSON.stringify({ items: [
        { snippet: { publishedAt: "2026-03-10T16:00:00Z", title: "t1", resourceId: { videoId: "vid1" } }, contentDetails: { videoId: "vid1" } },
        { snippet: { publishedAt: "2026-02-01T16:00:00Z", title: "t2", resourceId: { videoId: "vid2" } }, contentDetails: { videoId: "vid2" } },
      ] }), { status: 200 });
      if (url.includes("/videos")) return new Response(JSON.stringify({ items: [
        { id: "vid1", snippet: { title: "VOD inside", description: "", tags: [], categoryId: "20", publishedAt: "2026-03-10T16:00:00Z", channelId: "UC123", liveBroadcastContent: "none" }, contentDetails: { duration: "PT0S" } },
        { id: "vid2", snippet: { title: "VOD outside", description: "", tags: [], categoryId: "20", publishedAt: "2026-02-01T16:00:00Z", channelId: "UC123", liveBroadcastContent: "none" }, contentDetails: { duration: "PT0S" } },
      ] }), { status: 200 });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = providerWithFetch(fetchMock);
    const vids = await provider.listVideos({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" }, { from: "2026-03-01T00:00:00Z", to: "2026-03-31T00:00:00Z" });
    expect(vids.map((v) => v.externalVideoId)).toEqual(["vid1"]);
  });

  it("candidate cap 25 enforced", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ snippet: { publishedAt: "2026-03-10T16:00:00Z", title: `t${i}`, resourceId: { videoId: `vid${i}` } }, contentDetails: { videoId: `vid${i}` } }));
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/channels")) return new Response(JSON.stringify({ items: [{ id: "UC123", snippet: { title: "t", description: "d" }, contentDetails: { relatedPlaylists: { uploads: "UU123" } } }] }), { status: 200 });
      if (url.includes("/playlistItems")) return new Response(JSON.stringify({ items: many.slice(0, 50) }), { status: 200 });
      if (url.includes("/videos")) {
        const ids = many.slice(0, 30).map((_, i) => `vid${i}`).join(",");
        // Return 30 items but provider should cap to 25 after mapping
        const items = Array.from({ length: 30 }, (_, i) => ({ id: `vid${i}`, snippet: { title: `t${i}`, description: "", tags: [], categoryId: "20", publishedAt: "2026-03-10T16:00:00Z", channelId: "UC123", liveBroadcastContent: "none" }, contentDetails: { duration: "PT0S" } }));
        void ids;
        return new Response(JSON.stringify({ items }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = providerWithFetch(fetchMock);
    const vids = await provider.listVideos({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" }, { from: "2026-01-01T00:00:00Z", to: "2026-12-31T00:00:00Z" });
    expect(vids.length).toBeLessThanOrEqual(25);
  });

  it("empty channel returns empty", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/channels")) return new Response(JSON.stringify({ items: [{ id: "UC123", snippet: { title: "t", description: "d" }, contentDetails: { relatedPlaylists: { uploads: "UU123" } } }] }), { status: 200 });
      if (url.includes("/playlistItems")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = providerWithFetch(fetchMock);
    const vids = await provider.listVideos({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" }, { from: "2026-01-01T00:00:00Z", to: "2026-12-31T00:00:00Z" });
    expect(vids).toEqual([]);
  });

  it("deduplicates video IDs from playlist", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/channels")) return new Response(JSON.stringify({ items: [{ id: "UC123", snippet: { title: "t", description: "d" }, contentDetails: { relatedPlaylists: { uploads: "UU123" } } }] }), { status: 200 });
      if (url.includes("/playlistItems")) return new Response(JSON.stringify({ items: [
        { snippet: { publishedAt: "2026-03-10T16:00:00Z", title: "t", resourceId: { videoId: "vid1" } }, contentDetails: { videoId: "vid1" } },
        { snippet: { publishedAt: "2026-03-10T16:00:00Z", title: "t", resourceId: { videoId: "vid1" } }, contentDetails: { videoId: "vid1" } },
      ] }), { status: 200 });
      if (url.includes("/videos")) return new Response(JSON.stringify({ items: [{ id: "vid1", snippet: { title: "t", description: "", tags: [], categoryId: "20", publishedAt: "2026-03-10T16:00:00Z", channelId: "UC123", liveBroadcastContent: "none" }, contentDetails: { duration: "PT0S" } }] }), { status: 200 });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = providerWithFetch(fetchMock);
    const vids = await provider.listVideos({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" }, { from: "2026-01-01T00:00:00Z", to: "2026-12-31T00:00:00Z" });
    expect(vids.map((v) => v.externalVideoId)).toEqual(["vid1"]);
  });

  it("quota: historical path costs 3 general, 0 search (budget accounting)", async () => {
    const general = createInMemoryBudget({ platform: "youtube", limit: 10_000, windowMs: 24 * 60 * 60 * 1000 });
    const search = createInMemoryBudget({ platform: "youtube", limit: 100, windowMs: 24 * 60 * 60 * 1000 });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/channels")) return new Response(JSON.stringify({ items: [{ id: "UC123", snippet: { title: "t", description: "d" }, contentDetails: { relatedPlaylists: { uploads: "UU123" } } }] }), { status: 200 });
      if (url.includes("/playlistItems")) return new Response(JSON.stringify({ items: [{ snippet: { publishedAt: "2026-03-10T16:00:00Z", title: "t", resourceId: { videoId: "vid1" } }, contentDetails: { videoId: "vid1" } }] }), { status: 200 });
      if (url.includes("/videos")) return new Response(JSON.stringify({ items: [{ id: "vid1", snippet: { title: "t", description: "", tags: [], categoryId: "20", publishedAt: "2026-03-10T16:00:00Z", channelId: "UC123", liveBroadcastContent: "none" }, contentDetails: { duration: "PT0S" } }] }), { status: 200 });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new YouTubeProvider(new YouTubeClient({ apiKey: "k" }, fetchMock), general, search);
    await provider.listVideos({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" }, { from: "2026-01-01T00:00:00Z", to: "2026-12-31T00:00:00Z" });
    expect(search.canConsume(1).remaining).toBe(100); // search untouched
    expect(general.canConsume(1).remaining).toBe(10_000 - 3);
  });

  it("liveState still uses search.list (isolated, 1 search + 1 videos)", async () => {
    let searchCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/search") && url.includes("eventType=live")) {
        searchCalls++;
        return new Response(JSON.stringify({ items: [{ id: { videoId: "live1" }, snippet: { title: "Live", publishedAt: "2026-03-10T14:00:00Z", channelId: "UC123" } }] }), { status: 200 });
      }
      if (url.includes("/videos") && url.includes("live1")) return new Response(JSON.stringify({ items: [{ id: "live1", snippet: { title: "Live", description: "d", tags: [], categoryId: "20", publishedAt: "2026-03-10T14:00:00Z", channelId: "UC123", liveBroadcastContent: "live" }, contentDetails: { duration: "PT0S" }, liveStreamingDetails: { actualStartTime: "2026-03-10T14:00:00Z" } }] }), { status: 200 });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const provider = providerWithFetch(fetchMock);
    await provider.getLiveState({ platform: "youtube", externalChannelId: "UC123", externalHandle: "h", displayName: null, canonicalUrl: "https://youtube.com/channel/UC123" });
    expect(searchCalls).toBe(1);
  });
});
