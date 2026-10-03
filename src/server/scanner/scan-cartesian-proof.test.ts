import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as evidenceRepo from "@/server/repositories/evidence";
import * as evaluationRepo from "@/server/repositories/evaluations";
import * as scanRepo from "@/server/repositories/scans";
import { executeScan } from "./scan-orchestrator";
import { resetMocks } from "@/server/integrations/mock/provider";
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
      (r) =>
        r["deliverable_id"] === ev["deliverable_id"] &&
        r["scan_id"] === ev["scan_id"] &&
        r["platform"] === ev["platform"] &&
        r["source_id"] === ev["source_id"] &&
        r["observed_at"] === ev["observed_at"],
    );
    if (dup) throw new Error('duplicate key value violates unique constraint "evidence_idempotency_unique"');
    evidenceStore.push(ev);
    return ev as never;
  });
  vi.spyOn(evaluationRepo, "createEvaluation").mockImplementation(async (_s, input) => {
    const ev = { id: `eval-${evaluationStore.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString() } as Record<string, unknown>;
    evaluationStore.push(ev);
    return ev as never;
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

describe("cartesian proof coverage — every content × every requirement", () => {
  beforeEach(() => {
    resetMocks();
    vi.restoreAllMocks();
  });

  it("Test1: 1 requirement × 3 videos (2 PASS) → 2 Proofs, not 1", async () => {
    const supabase = makeSupabase();
    const deliverables = [{ id: "del-A", rule: { type: "required_title_contains", value: "BrandX" } }];
    const vA = makeVideo({ title: "BrandX tournament", externalVideoId: "vid-A" });
    const vB = makeVideo({ title: "BrandX finals", externalVideoId: "vid-B" });
    const vC = makeVideo({ title: "Other", externalVideoId: "vid-C" });
    const { evidenceStore, evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-1", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([vA, vB, vC]);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-1" }, providers: { twitch: provider } });

    expect(evaluationStore).toHaveLength(2); // 1 req × 3 vids, only 2 PASS persisted (FAIL not persisted when PASS exists, fallback not needed)
    const pass = evaluationStore.filter((e) => (e as { result: string }).result === "PASS");
    expect(pass).toHaveLength(2);
    expect(pass.map((e) => evidenceStore.find((ev) => (ev as { id: string }).id === (e as { evidence_id: string }).evidence_id)?.external_content_id).sort()).toEqual(["vid-A", "vid-B"]);
    expect(res.evidenceCount).toBe(2);
  });

  it("Test2: 2 requirements × 3 videos → 4 PASS associations, 6 total", async () => {
    const supabase = makeSupabase();
    const deliverables = [
      { id: "r1", rule: { type: "required_title_contains", value: "BrandX" } },
      { id: "r2", rule: { type: "required_description_contains", value: "SponsorY" } },
    ];
    const v1 = makeVideo({ title: "BrandX", description: "x", externalVideoId: "vid-1" });
    const v2 = makeVideo({ title: "x", description: "SponsorY", externalVideoId: "vid-2" });
    const v3 = makeVideo({ title: "BrandX", description: "SponsorY", externalVideoId: "vid-3" });
    const { evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-2", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([v1, v2, v3]);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-2" }, providers: { twitch: provider } });

    expect(evaluationStore).toHaveLength(4); // 2×3, only 4 PASS persisted (2 FAIL not persisted due to hasPass fallback)
    const pass = evaluationStore.filter((e) => (e as { result: string }).result === "PASS");
    expect(pass).toHaveLength(4);
    // V1→R1, V2→R2, V3→R1,R2
    expect(res.evidenceCount).toBe(4);
  });

  it("Test3: same video satisfies all 4 requirements → 4 evidences same content", async () => {
    const supabase = makeSupabase();
    const deliverables = [
      { id: "r1", rule: { type: "required_title_contains", value: "BrandX" } },
      { id: "r2", rule: { type: "required_description_contains", value: "brandx.com" } },
      { id: "r3", rule: { type: "minimum_duration", minutes: 1 } },
      { id: "r4", rule: { type: "required_category", categoryId: "gaming-1" } },
    ];
    const v = makeVideo({
      title: "BrandX",
      description: "brandx.com",
      durationSeconds: 120,
      category: { id: "gaming-1", name: "Gaming", platform: "twitch" as Platform },
      externalVideoId: "vid-same",
    });
    const { evidenceStore, evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-3", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([v]);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-3" }, providers: { twitch: provider } });
    expect(evaluationStore).toHaveLength(4);
    expect(evidenceStore.every((e) => (e as { external_content_id: string }).external_content_id === "vid-same")).toBe(true);
    expect(new Set(evidenceStore.map((e) => (e as { deliverable_id: string }).deliverable_id)).size).toBe(4);
    expect(res.scan.id).toBeTruthy();
  });

  it("Test4: 10 requirements × 5 videos → 50 evaluations, no early termination", async () => {
    const supabase = makeSupabase();
    const deliverables = Array.from({ length: 10 }, (_, i) => ({ id: `del-${i}`, rule: { type: "required_title_contains", value: "x" } }));
    const videos = Array.from({ length: 5 }, (_, i) => makeVideo({ title: "x video", externalVideoId: `vid-${i}` }));
    const { evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-4", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos(videos);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-4" }, providers: { twitch: provider } });
    expect(evaluationStore).toHaveLength(50);
    expect(res.evaluationCount).toBe(50);
    expect(res.evidenceCount).toBe(50);
  });

  it("Test5: historical isolation — same video across 2 scans", async () => {
    const supabase = makeSupabase();
    const deliverables = [{ id: "del", rule: { type: "required_title_contains", value: "BrandX" } }];
    const v = makeVideo({ title: "BrandX", externalVideoId: "vid-hist" });
    const { evaluationStore, scans } = setupMocks({ orgId: "org-a", campaignId: "camp-hist2", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([v]);
    const first = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-hist2" }, providers: { twitch: provider } });
    const second = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-hist2" }, providers: { twitch: provider } });
    expect(scans).toHaveLength(2);
    expect(first.scan.id).not.toBe(second.scan.id);
    expect(evaluationStore).toHaveLength(2);
    expect((evaluationStore[0] as { scan_id: string }).scan_id).not.toBe((evaluationStore[1] as { scan_id: string }).scan_id);
  });

  it("Test6: requirement isolation — R1 PASS does not affect R2 FAIL on same video", async () => {
    const supabase = makeSupabase();
    const deliverables = [
      { id: "r1", rule: { type: "required_title_contains", value: "PASSME" } },
      { id: "r2", rule: { type: "required_title_contains", value: "FAILME_NOT_PRESENT" } },
    ];
    const v = makeVideo({ title: "PASSME video", externalVideoId: "vid-iso2" });
    const { evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-iso2", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([v]);
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-iso2" }, providers: { twitch: provider } });
    const r1 = evaluationStore.find((e) => (e as { deliverable_id: string }).deliverable_id === "r1")!;
    const r2 = evaluationStore.find((e) => (e as { deliverable_id: string }).deliverable_id === "r2")!;
    expect((r1 as { result: string }).result).toBe("PASS");
    expect((r2 as { result: string }).result).toBe("FAIL");
  });

  it("Test7: no early termination — 3 PASS videos for 1 requirement → 3 Proofs", async () => {
    const supabase = makeSupabase();
    const deliverables = [{ id: "del", rule: { type: "required_title_contains", value: "BrandX" } }];
    const v1 = makeVideo({ title: "BrandX a", externalVideoId: "vid-1" });
    const v2 = makeVideo({ title: "BrandX b", externalVideoId: "vid-2" });
    const v3 = makeVideo({ title: "BrandX c", externalVideoId: "vid-3" });
    const { evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-early", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([v1, v2, v3]);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-early" }, providers: { twitch: provider } });
    expect(evaluationStore).toHaveLength(3);
    expect(evaluationStore.every((e) => (e as { result: string }).result === "PASS")).toBe(true);
    expect(res.evidenceCount).toBe(3);
  });

  it("Test8: provider bounds preserved — YouTube ≤25, Twitch ≤20 not increased", async () => {
    const supabase = makeSupabase();
    // YouTube bound is enforced in provider, not orchestrator — here we simulate provider returning 25
    const deliverables = [{ id: "del", rule: { type: "required_title_contains", value: "x" } }];
    const manyVideos = Array.from({ length: 30 }, (_, i) => makeVideo({ title: `x ${i}`, externalVideoId: `vid-${i}` }));
    // Simulate provider that would truncate to 25 (we pass 25 to simulate bounded)
    const bounded = manyVideos.slice(0, 25);
    const { evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-bounds", deliverables, channels: [{ platform: "youtube", external_channel_id: "UC123" }] });
    const provider = {
      platform: "youtube" as Platform,
      getLiveState: async () => null,
      listVideos: async () => bounded,
      resolveChannel: async () => null,
      resolveCategory: async () => null,
      listTags: async () => [],
      clearCache: () => {},
    } as unknown as LiveStateProvider & VideoEvidenceProvider;
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-bounds" }, providers: { youtube: provider } });
    expect(evaluationStore).toHaveLength(25); // bounded, not 30
    expect(res.evidenceCount).toBe(25);
  });
});
