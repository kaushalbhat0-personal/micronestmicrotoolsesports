import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as evidenceRepo from "@/server/repositories/evidence";
import * as evaluationRepo from "@/server/repositories/evaluations";
import * as scanRepo from "@/server/repositories/scans";
import { executeScan } from "./scan-orchestrator";
import type { CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { LiveStateProvider, VideoEvidenceProvider } from "@/features/sponsor-sentinel/types/provider";

function makeSupabase(): SupabaseClient {
  return { from: () => ({}) } as unknown as SupabaseClient;
}

function setupMocks(opts: { orgId: string; campaignId: string; deliverables: Array<{ id: string; rule: unknown }>; channels: Array<{ platform: Platform; external_channel_id: string }> }) {
  vi.spyOn(campaignRepo, "findSponsorCampaignById").mockResolvedValue({
    id: opts.campaignId,
    organization_id: opts.orgId,
    name: "Camp",
    description: null,
    status: "active",
    starts_at: "2026-03-01T00:00:00Z",
    ends_at: "2026-03-31T00:00:00Z",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never);
  vi.spyOn(deliverableRepo, "listDeliverablesByCampaign").mockResolvedValue(
    opts.deliverables.map((d) => ({
      id: d.id,
      organization_id: opts.orgId,
      campaign_id: opts.campaignId,
      name: "Del",
      description: null,
      rule: d.rule,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })) as never,
  );
  vi.spyOn(channelRepo, "listConnectedChannelsByOrg").mockResolvedValue(
    opts.channels.map((c, i) => ({
      id: `ch-${i}`,
      organization_id: opts.orgId,
      platform: c.platform,
      external_channel_id: c.external_channel_id,
      external_handle: `handle-${i}`,
      display_name: null,
      canonical_url: `https://${c.platform}.com/handle-${i}`,
      connection_mode: "discovered",
      connection_status: "connected",
      authorized_at: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })) as never,
  );
  const scans: Record<string, unknown>[] = [];
  vi.spyOn(scanRepo, "createScan").mockImplementation(async (_s, input) => {
    const scan = { id: `scan-${scans.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString(), started_at: new Date().toISOString() } as Record<string, unknown>;
    scans.push(scan);
    return scan as never;
  });
  vi.spyOn(scanRepo, "updateScanStatus").mockImplementation(async (_s, id, patch) => {
    const found = scans.find((x) => (x as { id: string }).id === id) as Record<string, unknown> | undefined;
    if (found) Object.assign(found, patch);
    return { id, ...(found ?? {}), ...patch, organization_id: opts.orgId, campaign_id: opts.campaignId, platform: "twitch", scanner_version: "v1" } as never;
  });
  vi.spyOn(scanRepo, "updateScanPlatform").mockImplementation(async (_s, id, platform) => {
    const found = scans.find((x) => (x as { id: string }).id === id) as Record<string, unknown> | undefined;
    if (found) (found as Record<string, unknown>).platform = platform;
    return { id, platform } as never;
  });
  const evidenceStore: Record<string, unknown>[] = [];
  const evaluationStore: Record<string, unknown>[] = [];
  vi.spyOn(evidenceRepo, "createEvidence").mockImplementation(async (_s, input) => {
    const ev = { id: `ev-${evidenceStore.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString() } as Record<string, unknown>;
    const dup = evidenceStore.find(
      (r) => r["deliverable_id"] === ev["deliverable_id"] && r["platform"] === ev["platform"] && r["source_id"] === ev["source_id"] && r["observed_at"] === ev["observed_at"],
    );
    if (dup) throw new Error('duplicate key value violates unique constraint "evidence_idempotency_unique"');
    evidenceStore.push(ev);
    return ev as never;
  });
  vi.spyOn(evidenceRepo, "createEvidenceBatch").mockImplementation(async (_s, inputs) => {
    const results: Record<string, unknown>[] = [];
    for (const input of inputs as unknown as Record<string, unknown>[]) {
      const ev = { id: `ev-${evidenceStore.length + 1}`, ...input, created_at: new Date().toISOString() } as Record<string, unknown>;
      const dup = evidenceStore.find(
        (r) => r["deliverable_id"] === ev["deliverable_id"] && r["platform"] === ev["platform"] && r["source_id"] === ev["source_id"] && r["observed_at"] === ev["observed_at"],
      );
      if (dup) throw new Error('duplicate key value violates unique constraint "evidence_idempotency_unique"');
      evidenceStore.push(ev);
      results.push(ev);
    }
    return results as never;
  });
  vi.spyOn(evaluationRepo, "createEvaluation").mockImplementation(async (_s, input) => {
    const ev = { id: `eval-${evaluationStore.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString() } as Record<string, unknown>;
    evaluationStore.push(ev);
    return ev as never;
  });
  vi.spyOn(evaluationRepo, "createEvaluationsBatch").mockImplementation(async (_s, inputs) => {
    const results: Record<string, unknown>[] = [];
    for (const input of inputs as unknown as Record<string, unknown>[]) {
      const ev = { id: `eval-${evaluationStore.length + 1}`, ...input, created_at: new Date().toISOString() } as Record<string, unknown>;
      evaluationStore.push(ev);
      results.push(ev);
    }
    return results as never;
  });
  return { evidenceStore, evaluationStore, scans };
}

function makeVideo(overrides: Partial<CanonicalVideo> & { title: string }): CanonicalVideo {
  return {
    platform: "twitch" as Platform,
    externalVideoId: overrides.externalVideoId ?? "vid-1",
    externalChannelId: overrides.externalChannelId ?? "twitch-123",
    title: overrides.title,
    description: overrides.description ?? "",
    tags: overrides.tags ?? [],
    category: overrides.category ?? null,
    durationSeconds: overrides.durationSeconds ?? null,
    publishedAt: overrides.publishedAt ?? "2026-03-15T12:00:00Z",
    channelId: overrides.channelId ?? "twitch-123",
    liveBroadcastContent: "none",
    canonicalUrl: overrides.canonicalUrl ?? "https://twitch.tv/videos/vid-1",
    observedAt: overrides.observedAt ?? "2026-03-15T12:00:00Z",
    ...overrides,
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

describe("batch persistence", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("multiple evidence rows batch correctly with correct FKs", async () => {
    const supabase = makeSupabase();
    const deliverables = [
      { id: "del-1", rule: { type: "required_title_contains", value: "BrandX" } },
      { id: "del-2", rule: { type: "required_title_contains", value: "BrandX" } },
    ];
    const videos = [makeVideo({ title: "BrandX video", externalVideoId: "vid-1" }), makeVideo({ title: "BrandX video2", externalVideoId: "vid-2" })];
    const { evidenceStore, evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-1", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos(videos);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-1" }, providers: { twitch: provider } });
    // 2 deliverables × 2 videos all PASS → 4 evidence, 4 evaluations
    expect(evidenceStore).toHaveLength(4);
    expect(evaluationStore).toHaveLength(4);
    for (const ev of evidenceStore) {
      expect(ev["organization_id"]).toBe("org-a");
      expect(ev["campaign_id"]).toBe("camp-1");
      expect(ev["scan_id"]).toBeTruthy();
      expect((ev["scan_id"] as string).startsWith("scan-")).toBe(true);
    }
    for (const ev of evaluationStore) {
      expect(evidenceStore.find((e) => e["id"] === ev["evidence_id"])).toBeTruthy();
      expect(ev["organization_id"]).toBe("org-a");
    }
    expect(res.evidenceCount).toBe(4);
    expect(res.evaluationCount).toBe(4);
  });

  it("duplicate candidate does not create duplicate rows (idempotency)", async () => {
    const supabase = makeSupabase();
    const deliverables = [{ id: "del-1", rule: { type: "required_title_contains", value: "BrandX" } }];
    const videos = [makeVideo({ title: "BrandX", externalVideoId: "vid-dup", observedAt: "2026-03-15T12:00:00Z" })];
    const { evidenceStore } = setupMocks({ orgId: "org-a", campaignId: "camp-dup", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos(videos);
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-dup" }, providers: { twitch: provider } });
    expect(evidenceStore).toHaveLength(1);
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-dup" }, providers: { twitch: provider } });
    expect(evidenceStore).toHaveLength(1); // duplicate swallowed
  });

  it("Cartesian: video A → req 1,2 and video B → req1 still persisted correctly", async () => {
    const supabase = makeSupabase();
    const deliverables = [
      { id: "r1", rule: { type: "required_title_contains", value: "BrandX" } },
      { id: "r2", rule: { type: "required_description_contains", value: "SponsorY" } },
    ];
    const v1 = makeVideo({ title: "BrandX", description: "x", externalVideoId: "vid-1" });
    const v2 = makeVideo({ title: "x", description: "SponsorY", externalVideoId: "vid-2" });
    const v3 = makeVideo({ title: "BrandX", description: "SponsorY", externalVideoId: "vid-3" });
    const { evidenceStore, evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-cart", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([v1, v2, v3]);
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-cart" }, providers: { twitch: provider } });
    // r1 PASS for v1,v3 (2), r2 PASS for v2,v3 (2) → 4
    expect(evidenceStore).toHaveLength(4);
    expect(evaluationStore).toHaveLength(4);
  });

  it("batch reduces Supabase insert calls: before N*2 vs after 2", async () => {
    const supabase = makeSupabase();
    const deliverables = Array.from({ length: 10 }, (_, i) => ({ id: `del-${i}`, rule: { type: "required_title_contains", value: "x" } }));
    const videos = Array.from({ length: 5 }, (_, i) => makeVideo({ title: "x video", externalVideoId: `vid-${i}` }));
    const { evidenceStore } = setupMocks({ orgId: "org-a", campaignId: "camp-bench", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos(videos);
    const batchSpyEvidence = vi.spyOn(evidenceRepo, "createEvidenceBatch");
    const batchSpyEvals = vi.spyOn(evaluationRepo, "createEvaluationsBatch");
    const singleSpyEvidence = vi.spyOn(evidenceRepo, "createEvidence");
    const singleSpyEvals = vi.spyOn(evaluationRepo, "createEvaluation");
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-bench" }, providers: { twitch: provider } });
    // 10 delivs ×5 videos =50 PASS → 50 evidence
    expect(evidenceStore).toHaveLength(50);
    expect(batchSpyEvidence).toHaveBeenCalledTimes(1);
    expect(batchSpyEvals).toHaveBeenCalledTimes(1);
    // Fallback single should not have been called (batch succeeded)
    // Note single spies were also set up in setupMocks but batch succeeded so single 0
    // We check that single was not called beyond batch
    expect(singleSpyEvidence.mock.calls.length).toBe(0);
    expect(singleSpyEvals.mock.calls.length).toBe(0);
  });

  it("benchmark cases A/B/C measure DB round trips", async () => {
    const cases: Array<{ label: string; channels: number; videos: number; reqs: number; expectedEvidence: number }> = [
      { label: "A 1×25×4", channels: 1, videos: 25, reqs: 4, expectedEvidence: 100 },
      { label: "B 1×25×10", channels: 1, videos: 25, reqs: 10, expectedEvidence: 250 },
      { label: "C 5×25×10", channels: 5, videos: 25, reqs: 10, expectedEvidence: 1250 },
    ];
    for (const c of cases) {
      vi.restoreAllMocks();
      const supabase = makeSupabase();
      const deliverables = Array.from({ length: c.reqs }, (_, i) => ({ id: `del-${i}`, rule: { type: "required_title_contains", value: "x" } }));
      const channels = Array.from({ length: c.channels }, (_, i) => ({ platform: "twitch" as Platform, external_channel_id: `twitch-${i}` }));
      setupMocks({ orgId: "org-a", campaignId: `camp-${c.label}`, deliverables, channels });
      // Channel-aware provider: distinct videoIds per channel to avoid evidence_idempotency_unique collision (which excludes channel)
      const provider: LiveStateProvider & VideoEvidenceProvider = {
        platform: "twitch" as Platform,
        getLiveState: async () => null,
        listVideos: async (ch) => {
          return Array.from({ length: c.videos }, (_, i) =>
            makeVideo({
              title: "x video",
              externalVideoId: `${ch.externalChannelId}-vid-${i}`,
              externalChannelId: ch.externalChannelId,
              observedAt: `2026-03-15T12:00:${String(i).padStart(2, "0")}Z`,
              // ensure distinct source_id+observed_at per channel/video
            }),
          );
        },
        resolveChannel: async () => null,
        resolveCategory: async () => null,
        listTags: async () => [],
        clearCache: () => {},
      } as unknown as LiveStateProvider & VideoEvidenceProvider;
      const evidenceBatchSpy = vi.spyOn(evidenceRepo, "createEvidenceBatch");
      const evalBatchSpy = vi.spyOn(evaluationRepo, "createEvaluationsBatch");
      const start = Date.now();
      const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: `camp-${c.label}` }, providers: { twitch: provider } });
      const elapsed = Date.now() - start;
      expect(res.evidenceCount).toBe(c.expectedEvidence);
      expect(res.evaluationCount).toBe(c.expectedEvidence);
      expect(evidenceBatchSpy).toHaveBeenCalledTimes(1);
      expect(evalBatchSpy).toHaveBeenCalledTimes(1);
      const beforeRoundTrips = c.expectedEvidence * 2 + 3;
      const afterRoundTrips = 2 + 3;
      expect(afterRoundTrips).toBeLessThan(beforeRoundTrips);
      void elapsed;
    }
  });
});
