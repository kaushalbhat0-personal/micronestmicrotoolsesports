import { describe, expect, it, vi, beforeEach } from "vitest";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as evidenceRepo from "@/server/repositories/evidence";
import * as evaluationRepo from "@/server/repositories/evaluations";
import * as scanRepo from "@/server/repositories/scans";
import { executeScan } from "./scan-orchestrator";
import { createInMemoryBudget } from "@/features/sponsor-sentinel/services/budget";
import type { CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { LiveStateProvider, VideoEvidenceProvider } from "@/features/sponsor-sentinel/types/provider";
import { YouTubeClient } from "@/server/integrations/youtube/client";
import { YouTubeProvider } from "@/server/integrations/youtube/provider";

function makeSupabase() {
  return { from: () => ({}) } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

function setupMocksChannels(channels: Array<{ platform: Platform; external_channel_id: string }>, deliverables: Array<{ id: string; rule: unknown }>) {
  const orgId = "org-a";
  const campId = "camp-a";
  vi.spyOn(campaignRepo, "findSponsorCampaignById").mockResolvedValue({
    id: campId, organization_id: orgId, name: "Camp", description: null, status: "active", starts_at: "2026-03-01T00:00:00Z", ends_at: "2026-03-31T00:00:00Z", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  } as never);
  vi.spyOn(deliverableRepo, "listDeliverablesByCampaign").mockResolvedValue(
    deliverables.map((d) => ({ id: d.id, organization_id: orgId, campaign_id: campId, name: "Del", description: null, rule: d.rule, status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)),
  );
  vi.spyOn(channelRepo, "listConnectedChannelsByOrg").mockResolvedValue(
    channels.map((c, i) => ({ id: `ch-${i}`, organization_id: orgId, platform: c.platform, external_channel_id: c.external_channel_id, external_handle: `handle-${i}`, display_name: null, canonical_url: `https://${c.platform}.com/handle-${i}`, connection_mode: "discovered", connection_status: "connected", authorized_at: null, metadata: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)),
  );
  const scans: Record<string, unknown>[] = [];
  vi.spyOn(scanRepo, "tryCreateScanWithLock").mockImplementation(async (_s, input) => {
    const scan = { id: `scan-${scans.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString(), started_at: new Date().toISOString() } as Record<string, unknown>;
    scans.push(scan);
    return scan as never;
  });
  vi.spyOn(scanRepo, "updateScanStatus").mockImplementation(async (_s, id, patch) => {
    const found = scans.find((x) => (x as { id: string }).id === id) as Record<string, unknown> | undefined;
    if (found) Object.assign(found, patch);
    return { id, ...(found ?? {}), ...patch } as never;
  });
  vi.spyOn(scanRepo, "updateScanPlatform").mockImplementation(async (_s, id, platform) => ({ id, platform } as never));
  const evidenceStore: Record<string, unknown>[] = [];
  const evaluationStore: Record<string, unknown>[] = [];
  vi.spyOn(evidenceRepo, "createEvidence").mockImplementation(async (_s, input) => {
    const ev = { id: `ev-${evidenceStore.length + 1}`, ...(input as Record<string, unknown>) } as Record<string, unknown>;
    evidenceStore.push(ev);
    return ev as never;
  });
  vi.spyOn(evidenceRepo, "createEvidenceBatch").mockImplementation(async (_s, inputs) => {
    const res: Record<string, unknown>[] = [];
    for (const inp of inputs as unknown as Record<string, unknown>[]) {
      const ev = { id: `ev-${evidenceStore.length + 1}`, ...inp } as Record<string, unknown>;
      evidenceStore.push(ev);
      res.push(ev);
    }
    return res as never;
  });
  vi.spyOn(evaluationRepo, "createEvaluation").mockImplementation(async (_s, input) => {
    const ev = { id: `eval-${evaluationStore.length + 1}`, ...(input as Record<string, unknown>) } as Record<string, unknown>;
    evaluationStore.push(ev);
    return ev as never;
  });
  vi.spyOn(evaluationRepo, "createEvaluationsBatch").mockImplementation(async (_s, inputs) => {
    const res: Record<string, unknown>[] = [];
    for (const inp of inputs as unknown as Record<string, unknown>[]) {
      const ev = { id: `eval-${evaluationStore.length + 1}`, ...inp } as Record<string, unknown>;
      evaluationStore.push(ev);
      res.push(ev);
    }
    return res as never;
  });
  return { evidenceStore, evaluationStore, scans };
}

function makeVideo(title: string, id: string): CanonicalVideo {
  return {
    platform: "twitch" as Platform,
    externalVideoId: id,
    externalChannelId: "twitch-123",
    title,
    description: "",
    tags: [],
    category: null,
    durationSeconds: null,
    publishedAt: "2026-03-15T12:00:00Z",
    channelId: "twitch-123",
    liveBroadcastContent: "none",
    canonicalUrl: `https://twitch.tv/videos/${id}`,
    observedAt: new Date().toISOString(),
  } as CanonicalVideo;
}

describe("provider concurrency", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("concurrency actually occurs - 5 channels with delay overlap", async () => {
    const channels = Array.from({ length: 5 }, (_, i) => ({ platform: "twitch" as Platform, external_channel_id: `twitch-${i}` }));
    const deliverables = [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }];
    setupMocksChannels(channels, deliverables);
    let active = 0;
    let maxActive = 0;
    const provider: LiveStateProvider & VideoEvidenceProvider = {
      platform: "twitch" as Platform,
      getLiveState: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 30));
        active--;
        return null;
      },
      listVideos: async (ch) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 30));
        active--;
        return [makeVideo("x", `${ch.externalChannelId}-vid`)];
      },
      resolveChannel: async () => null,
      resolveCategory: async () => null,
      listTags: async () => [],
      clearCache: () => {},
    } as unknown as LiveStateProvider & VideoEvidenceProvider;
    const supabase = makeSupabase();
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { twitch: provider } });
    expect(maxActive).toBeGreaterThan(1); // concurrent
    expect(maxActive).toBeLessThanOrEqual(3); // bounded to 3
  });

  it("concurrency bound 3 - 10 channels never exceeds 3", async () => {
    const channels = Array.from({ length: 10 }, (_, i) => ({ platform: "twitch" as Platform, external_channel_id: `twitch-${i}` }));
    const deliverables = [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }];
    setupMocksChannels(channels, deliverables);
    let active = 0;
    let maxActive = 0;
    const provider: LiveStateProvider & VideoEvidenceProvider = {
      platform: "twitch" as Platform,
      getLiveState: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active--;
        return null;
      },
      listVideos: async (ch) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 20));
        active--;
        return [makeVideo("x", `${ch.externalChannelId}-vid`)];
      },
      resolveChannel: async () => null,
      resolveCategory: async () => null,
      listTags: async () => [],
      clearCache: () => {},
    } as unknown as LiveStateProvider & VideoEvidenceProvider;
    const supabase = makeSupabase();
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { twitch: provider } });
    expect(maxActive).toBe(3);
  });

  it("provider budget concurrency-safe - no negative remaining", async () => {
    const budget = createInMemoryBudget({ platform: "twitch", limit: 5, windowMs: 60_000 });
    const attempts = Array.from({ length: 10 }, () => budget.tryConsume(1));
    const allowed = attempts.filter((a) => a.allowed).length;
    expect(allowed).toBe(5);
    expect(budget.canConsume(1).remaining).toBe(0);
    expect(budget.canConsume(1).allowed).toBe(false);
  });

  it("provider failure isolation - 1 fail, 2 succeed → partial", async () => {
    const channels = [
      { platform: "twitch" as Platform, external_channel_id: "twitch-0" },
      { platform: "twitch" as Platform, external_channel_id: "twitch-1" },
      { platform: "twitch" as Platform, external_channel_id: "twitch-2" },
    ];
    const deliverables = [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }];
    const { evidenceStore } = setupMocksChannels(channels, deliverables);
    const failingProvider: LiveStateProvider & VideoEvidenceProvider = {
      platform: "twitch" as Platform,
      getLiveState: async (ch) => {
        if (ch.externalChannelId === "twitch-1") throw new Error("provider down");
        return null;
      },
      listVideos: async (ch) => {
        if (ch.externalChannelId === "twitch-1") throw new Error("provider down");
        return [makeVideo("x", `${ch.externalChannelId}-vid`)];
      },
      resolveChannel: async () => null,
      resolveCategory: async () => null,
      listTags: async () => [],
      clearCache: () => {},
    } as unknown as LiveStateProvider & VideoEvidenceProvider;
    const supabase = makeSupabase();
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { twitch: failingProvider } });
    expect(res.scan.status).toBe("partial");
    expect(evidenceStore.length).toBe(2); // 2 success, 1 fail
  });

  it("YouTube historical remains search-free via uploads playlist", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/channels")) return new Response(JSON.stringify({ items: [{ id: "UC123", snippet: { title: "t", description: "d" }, contentDetails: { relatedPlaylists: { uploads: "UU123" } } }] }), { status: 200 });
      if (url.includes("/playlistItems")) return new Response(JSON.stringify({ items: [{ snippet: { title: "t", publishedAt: "2026-03-15T12:00:00Z", resourceId: { videoId: "vid1" } }, contentDetails: { videoId: "vid1" } }] }), { status: 200 });
      if (url.includes("/videos")) return new Response(JSON.stringify({ items: [{ id: "vid1", snippet: { title: "x", description: "", tags: [], categoryId: "20", publishedAt: "2026-03-15T12:00:00Z", channelId: "UC123", liveBroadcastContent: "none" }, contentDetails: { duration: "PT0S" } }] }), { status: 200 });
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    let searchHistoricalCalled = false;
    const origFetch = fetchMock;
    const wrappedFetch = vi.fn(async (url: string, ...args: unknown[]) => {
      if (String(url).includes("/search") && !String(url).includes("eventType=live")) searchHistoricalCalled = true;
      return origFetch(url, ...args) as unknown as Response;
    }) as unknown as typeof fetch;
    const client = new YouTubeClient({ apiKey: "k" }, wrappedFetch);
    const provider = new YouTubeProvider(client);
    const channels = [{ platform: "youtube" as Platform, external_channel_id: "UC123" }];
    const deliverables = [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }];
    setupMocksChannels(channels, deliverables);
    const supabase = makeSupabase();
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { youtube: provider } });
    expect(searchHistoricalCalled).toBe(false); // historical used uploads, not search (live may still use search)
  });

  it("Cartesian and batch persistence still correct with concurrency", async () => {
    const channels = [{ platform: "twitch" as Platform, external_channel_id: "twitch-123" }];
    const deliverables = [
      { id: "r1", rule: { type: "required_title_contains", value: "BrandX" } },
      { id: "r2", rule: { type: "required_description_contains", value: "SponsorY" } },
    ];
    const v1 = makeVideo("BrandX", "vid-1");
    (v1 as unknown as Record<string, unknown>).description = "x";
    const v2 = makeVideo("x", "vid-2");
    (v2 as unknown as Record<string, unknown>).description = "SponsorY";
    const v3 = makeVideo("BrandX", "vid-3");
    (v3 as unknown as Record<string, unknown>).description = "SponsorY";
    const { evidenceStore } = setupMocksChannels(channels, deliverables);
    const provider = {
      platform: "twitch" as Platform,
      getLiveState: async () => null,
      listVideos: async () => [v1, v2, v3],
      resolveChannel: async () => null,
      resolveCategory: async () => null,
      listTags: async () => [],
      clearCache: () => {},
    } as unknown as LiveStateProvider & VideoEvidenceProvider;
    const supabase = makeSupabase();
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { twitch: provider } });
    expect(evidenceStore.length).toBe(4);
  });
});
