import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as evidenceRepo from "@/server/repositories/evidence";
import * as evaluationRepo from "@/server/repositories/evaluations";
import * as scanRepo from "@/server/repositories/scans";
import { executeScan } from "./scan-orchestrator";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { LiveStateProvider, VideoEvidenceProvider } from "@/features/sponsor-sentinel/types/provider";
import type { CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";

function makeSupabase(): SupabaseClient {
  return { from: () => ({}) } as unknown as SupabaseClient;
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

function providerWithVideos(videos: CanonicalVideo[]): LiveStateProvider & VideoEvidenceProvider {
  return {
    platform: "twitch" as Platform,
    getLiveState: async () => null,
    listVideos: async () => videos,
    resolveChannel: async () => null,
    resolveCategory: async () => null,
    listTags: async () => [],
    clearCache: () => {},
  } as unknown as LiveStateProvider & VideoEvidenceProvider;
}

function setupBaseMocks(orgId: string, campaignId: string) {
  vi.spyOn(campaignRepo, "findSponsorCampaignById").mockResolvedValue({
    id: campaignId,
    organization_id: orgId,
    name: "Camp",
    description: null,
    status: "active",
    starts_at: "2026-03-01T00:00:00Z",
    ends_at: "2026-03-31T00:00:00Z",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never);
  vi.spyOn(deliverableRepo, "listDeliverablesByCampaign").mockResolvedValue([
    { id: "del-1", organization_id: orgId, campaign_id: campaignId, name: "Del", description: null, rule: { type: "required_title_contains", value: "x" }, status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ] as never);
  vi.spyOn(channelRepo, "listConnectedChannelsByOrg").mockResolvedValue([
    {
      id: "ch-1",
      organization_id: orgId,
      platform: "twitch",
      external_channel_id: "twitch-123",
      external_handle: "handle",
      display_name: null,
      canonical_url: "https://twitch.tv/handle",
      connection_mode: "discovered",
      connection_status: "connected",
      authorized_at: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never,
  ]);
  vi.spyOn(evidenceRepo, "createEvidence").mockImplementation(async (_s, input) => ({ id: `ev-${Math.random()}`, ...(input as Record<string, unknown>) } as never));
  vi.spyOn(evidenceRepo, "createEvidenceBatch").mockImplementation(async (_s, inputs) => (inputs as unknown[]).map((inp) => ({ id: `ev-${Math.random()}`, ...(inp as Record<string, unknown>) })) as never);
  vi.spyOn(evaluationRepo, "createEvaluation").mockImplementation(async (_s, input) => ({ id: `eval-${Math.random()}`, ...(input as Record<string, unknown>) } as never));
  vi.spyOn(evaluationRepo, "createEvaluationsBatch").mockImplementation(async (_s, inputs) => (inputs as unknown[]).map((inp) => ({ id: `eval-${Math.random()}`, ...(inp as Record<string, unknown>) })) as never);
}

describe("concurrency lock", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("Test1 double Check Now same campaign → one executes, one ALREADY_RUNNING", async () => {
    const orgId = "org-a";
    const campId = "camp-a";
    setupBaseMocks(orgId, campId);
    const scans: Record<string, unknown>[] = [];
    // Mock tryCreateScanWithLock to enforce at most one pending/running per campaign
    vi.spyOn(scanRepo, "tryCreateScanWithLock").mockImplementation(async (_s, input) => {
      const active = scans.find((s) => s["campaign_id"] === input.campaign_id && (s["status"] === "pending" || s["status"] === "running"));
      if (active) {
        const err = new Error("duplicate key value violates unique constraint \"scans_campaign_active_unique\"") as unknown as Record<string, unknown>;
        (err as Record<string, unknown>).code = "23505";
        throw err;
      }
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
    // Mock tryCreateScanWithLock's internal AppError conversion
    const { AppError } = await import("@/lib/errors");
    vi.spyOn(scanRepo, "tryCreateScanWithLock").mockImplementation(async (_s, input) => {
      const active = scans.find((s) => s["campaign_id"] === input.campaign_id && (s["status"] === "pending" || s["status"] === "running"));
      if (active) throw new AppError({ code: "CONFLICT", status: 409, message: "A check is already running for this campaign. Please wait a moment and try again." });
      const scan = { id: `scan-${scans.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString(), started_at: new Date().toISOString() } as Record<string, unknown>;
      scans.push(scan);
      return scan as never;
    });

    const supabase = makeSupabase();
    const provider = providerWithVideos([makeVideo("x", "vid1")]);
    const p1 = executeScan({ supabase, input: { organizationId: orgId, campaignId: campId }, providers: { twitch: provider } });
    const p2 = executeScan({ supabase, input: { organizationId: orgId, campaignId: campId }, providers: { twitch: provider } });
    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled") as unknown as { value: { scan: { id: string } } }[];
    const rejected = results.filter((r) => r.status === "rejected") as unknown as { reason: { code?: string } }[];
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as unknown as { reason: Error }).reason.message).toMatch(/already running/i);
  });

  it("Test3 different campaigns both execute (no global lock)", async () => {
    const orgId = "org-a";
    setupBaseMocks(orgId, "camp-a");
    const scans: Record<string, unknown>[] = [];
    const { AppError } = await import("@/lib/errors");
    vi.spyOn(scanRepo, "tryCreateScanWithLock").mockImplementation(async (_s, input) => {
      const active = scans.find((s) => s["campaign_id"] === input.campaign_id && (s["status"] === "pending" || s["status"] === "running"));
      if (active) throw new AppError({ code: "CONFLICT", status: 409, message: "already running" });
      const scan = { id: `scan-${input.campaign_id}-${scans.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString(), started_at: new Date().toISOString() } as Record<string, unknown>;
      scans.push(scan);
      return scan as never;
    });
    vi.spyOn(scanRepo, "updateScanStatus").mockImplementation(async (_s, id, patch) => {
      const found = scans.find((x) => (x as { id: string }).id === id) as Record<string, unknown> | undefined;
      if (found) Object.assign(found, patch);
      return { id, ...(found ?? {}), ...patch } as never;
    });
    vi.spyOn(scanRepo, "updateScanPlatform").mockImplementation(async (_s, id, platform) => ({ id, platform } as never));
    // Need per-campaign mocks for findSponsorCampaignById
    vi.spyOn(campaignRepo, "findSponsorCampaignById").mockImplementation(async (_s, id) => ({
      id: id as string,
      organization_id: orgId,
      name: "Camp",
      description: null,
      status: "active",
      starts_at: "2026-03-01T00:00:00Z",
      ends_at: "2026-03-31T00:00:00Z",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }) as never);
    vi.spyOn(deliverableRepo, "listDeliverablesByCampaign").mockImplementation(async (_s, campaignId) => [
      { id: `del-${campaignId}`, organization_id: orgId, campaign_id: campaignId as string, name: "Del", description: null, rule: { type: "required_title_contains", value: "x" }, status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ] as never);

    const supabase = makeSupabase();
    const provider = providerWithVideos([makeVideo("x", "vid1")]);
    const p1 = executeScan({ supabase, input: { organizationId: orgId, campaignId: "camp-a" }, providers: { twitch: provider } });
    const p2 = executeScan({ supabase, input: { organizationId: orgId, campaignId: "camp-b" }, providers: { twitch: provider } });
    const results = await Promise.allSettled([p1, p2]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(2);
  });

  it("Test4 failed Check does not block future Check", async () => {
    const orgId = "org-a";
    const campId = "camp-a";
    setupBaseMocks(orgId, campId);
    const scans: Record<string, unknown>[] = [];
    const { AppError } = await import("@/lib/errors");
    vi.spyOn(scanRepo, "tryCreateScanWithLock").mockImplementation(async (_s, input) => {
      const active = scans.find((s) => s["campaign_id"] === input.campaign_id && (s["status"] === "pending" || s["status"] === "running"));
      if (active) throw new AppError({ code: "CONFLICT", status: 409, message: "already running" });
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
    // First scan will be marked failed via provider failure
    vi.spyOn(channelRepo, "listConnectedChannelsByOrg").mockResolvedValue([
      { id: "ch-1", organization_id: orgId, platform: "twitch", external_channel_id: "twitch-123", external_handle: "h", display_name: null, canonical_url: "https://twitch.tv/h", connection_mode: "discovered", connection_status: "connected", authorized_at: null, metadata: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ] as never);
    const supabase = makeSupabase();
    const failingProvider = { platform: "twitch" as Platform, getLiveState: async () => { throw new Error("provider down"); }, listVideos: async () => [], resolveChannel: async () => null, resolveCategory: async () => null, listTags: async () => [], clearCache: () => {} } as unknown as LiveStateProvider & VideoEvidenceProvider;
    const res1 = await executeScan({ supabase, input: { organizationId: orgId, campaignId: campId }, providers: { twitch: failingProvider } });
    expect(res1.scan.status).toBe("failed");
    // Now second scan should be allowed (previous is failed, not pending/running)
    const provider2 = providerWithVideos([makeVideo("x", "vid1")]);
    const res2 = await executeScan({ supabase, input: { organizationId: orgId, campaignId: campId }, providers: { twitch: provider2 } });
    expect(res2.scan.status).toBe("success");
  });

  it("Test5 stale execution beyond threshold allows new Check", async () => {
    const orgId = "org-a";
    const campId = "camp-a";
    setupBaseMocks(orgId, campId);
    const scans: Record<string, unknown>[] = [
      { id: "scan-stale", campaign_id: campId, organization_id: orgId, platform: "twitch", status: "running", started_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(), created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(), scanner_version: "v1" },
    ];
    // Mock expireStaleScans to update stale to failed
    vi.spyOn(scanRepo, "expireStaleScans").mockImplementation(async (_s, cId) => {
      let count = 0;
      for (const s of scans) {
        if (s["campaign_id"] === cId && (s["status"] === "pending" || s["status"] === "running")) {
          const age = Date.now() - Date.parse(s["started_at"] as string);
          if (age > 10 * 60 * 1000) {
            s["status"] = "failed";
            s["completed_at"] = new Date().toISOString();
            count++;
          }
        }
      }
      return count;
    });
    vi.spyOn(scanRepo, "tryCreateScanWithLock").mockImplementation(async (_s, input) => {
      // Call expire first (as real does)
      await scanRepo.expireStaleScans(_s as unknown as SupabaseClient, input.campaign_id);
      const active = scans.find((s) => s["campaign_id"] === input.campaign_id && (s["status"] === "pending" || s["status"] === "running"));
      if (active) {
        const { AppError } = await import("@/lib/errors");
        throw new AppError({ code: "CONFLICT", status: 409, message: "already running" });
      }
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
    const supabase = makeSupabase();
    const provider = providerWithVideos([makeVideo("x", "vid1")]);
    const res = await executeScan({ supabase, input: { organizationId: orgId, campaignId: campId }, providers: { twitch: provider } });
    expect(res.scan.status).toBe("success");
    expect(scans.find((s) => s["id"] === "scan-stale")?.["status"]).toBe("failed");
  });

  it("10 simultaneous attempts same campaign → 1 executes 9 skipped", async () => {
    const orgId = "org-a";
    const campId = "camp-a";
    setupBaseMocks(orgId, campId);
    const scans: Record<string, unknown>[] = [];
    const { AppError } = await import("@/lib/errors");
    vi.spyOn(scanRepo, "tryCreateScanWithLock").mockImplementation(async (_s, input) => {
      const active = scans.find((s) => s["campaign_id"] === input.campaign_id && (s["status"] === "pending" || s["status"] === "running"));
      if (active) throw new AppError({ code: "CONFLICT", status: 409, message: "already running" });
      const scan = { id: `scan-${scans.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString(), started_at: new Date().toISOString() } as Record<string, unknown>;
      scans.push(scan);
      // Simulate some async work to keep lock held
      await new Promise((r) => setTimeout(r, 20));
      return scan as never;
    });
    vi.spyOn(scanRepo, "updateScanStatus").mockImplementation(async (_s, id, patch) => {
      const found = scans.find((x) => (x as { id: string }).id === id) as Record<string, unknown> | undefined;
      if (found) Object.assign(found, patch);
      return { id, ...(found ?? {}), ...patch } as never;
    });
    vi.spyOn(scanRepo, "updateScanPlatform").mockImplementation(async (_s, id, platform) => ({ id, platform } as never));
    const supabase = makeSupabase();
    const provider = providerWithVideos([makeVideo("x", "vid1")]);
    const promises = Array.from({ length: 10 }, () => executeScan({ supabase, input: { organizationId: orgId, campaignId: campId }, providers: { twitch: provider } }));
    const results = await Promise.allSettled(promises);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect(results.filter((r) => r.status === "rejected").length).toBe(9);
  });

  it("10 attempts 5 campaigns → up to 5 execute", async () => {
    const orgId = "org-a";
    const scans: Record<string, unknown>[] = [];
    const { AppError } = await import("@/lib/errors");
    vi.spyOn(campaignRepo, "findSponsorCampaignById").mockImplementation(async (_s, id) => ({
      id: id as string,
      organization_id: orgId,
      name: "Camp",
      description: null,
      status: "active",
      starts_at: "2026-03-01T00:00:00Z",
      ends_at: "2026-03-31T00:00:00Z",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }) as never);
    vi.spyOn(deliverableRepo, "listDeliverablesByCampaign").mockImplementation(async (_s, campaignId) => [
      { id: `del-${campaignId}`, organization_id: orgId, campaign_id: campaignId as string, name: "Del", description: null, rule: { type: "required_title_contains", value: "x" }, status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ] as never);
    vi.spyOn(channelRepo, "listConnectedChannelsByOrg").mockResolvedValue([
      { id: "ch-1", organization_id: orgId, platform: "twitch", external_channel_id: "twitch-123", external_handle: "h", display_name: null, canonical_url: "https://twitch.tv/h", connection_mode: "discovered", connection_status: "connected", authorized_at: null, metadata: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ] as never);
    vi.spyOn(evidenceRepo, "createEvidence").mockImplementation(async (_s, input) => ({ id: `ev-${Math.random()}`, ...(input as Record<string, unknown>) } as never));
    vi.spyOn(evidenceRepo, "createEvidenceBatch").mockImplementation(async (_s, inputs) => (inputs as unknown[]).map((inp) => ({ id: `ev-${Math.random()}`, ...(inp as Record<string, unknown>) })) as never);
    vi.spyOn(evaluationRepo, "createEvaluation").mockImplementation(async (_s, input) => ({ id: `eval-${Math.random()}`, ...(input as Record<string, unknown>) } as never));
    vi.spyOn(evaluationRepo, "createEvaluationsBatch").mockImplementation(async (_s, inputs) => (inputs as unknown[]).map((inp) => ({ id: `eval-${Math.random()}`, ...(inp as Record<string, unknown>) })) as never);
    vi.spyOn(scanRepo, "tryCreateScanWithLock").mockImplementation(async (_s, input) => {
      const active = scans.find((s) => s["campaign_id"] === input.campaign_id && (s["status"] === "pending" || s["status"] === "running"));
      if (active) throw new AppError({ code: "CONFLICT", status: 409, message: "already running" });
      const scan = { id: `scan-${input.campaign_id}-${scans.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString(), started_at: new Date().toISOString() } as Record<string, unknown>;
      scans.push(scan);
      await new Promise((r) => setTimeout(r, 10));
      return scan as never;
    });
    vi.spyOn(scanRepo, "updateScanStatus").mockImplementation(async (_s, id, patch) => {
      const found = scans.find((x) => (x as { id: string }).id === id) as Record<string, unknown> | undefined;
      if (found) Object.assign(found, patch);
      return { id, ...(found ?? {}), ...patch } as never;
    });
    vi.spyOn(scanRepo, "updateScanPlatform").mockImplementation(async (_s, id, platform) => ({ id, platform } as never));
    const supabase = makeSupabase();
    const provider = providerWithVideos([makeVideo("x", "vid1")]);
    const campaignIds = ["camp-a", "camp-b", "camp-c", "camp-d", "camp-e"];
    const promises: Promise<unknown>[] = [];
    for (const cid of campaignIds) {
      promises.push(executeScan({ supabase, input: { organizationId: orgId, campaignId: cid }, providers: { twitch: provider } }));
      promises.push(executeScan({ supabase, input: { organizationId: orgId, campaignId: cid }, providers: { twitch: provider } }));
    }
    const results = await Promise.allSettled(promises);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(5);
    expect(results.filter((r) => r.status === "rejected").length).toBe(5);
  });
});
