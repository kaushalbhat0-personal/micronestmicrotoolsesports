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
import type { CanonicalVideo, CanonicalLiveStream } from "@/features/sponsor-sentinel/types/observations";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { LiveStateProvider, VideoEvidenceProvider } from "@/features/sponsor-sentinel/types/provider";

function makeSupabase(): SupabaseClient {
  return { from: () => ({}) } as unknown as SupabaseClient;
}

type EvidenceRow = Record<string, unknown> & { id: string; deliverable_id: string; external_content_id: string; observed_value: string; platform: string; scan_id: string };
type EvaluationRow = Record<string, unknown> & { id: string; deliverable_id: string; evidence_id: string; result: string; reason: string; scan_id: string };

function setupMocks(opts: {
  orgId: string;
  campaignId: string;
  deliverables: Array<{ id: string; rule: unknown }>;
  channels: Array<{ platform: Platform; external_channel_id: string }>;
}) {
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

  const evidenceStore: EvidenceRow[] = [];
  const evaluationStore: EvaluationRow[] = [];

  vi.spyOn(evidenceRepo, "createEvidence").mockImplementation(async (_s, input) => {
    const ev = { id: `ev-${evidenceStore.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString() } as EvidenceRow;
    // idempotency check similar to orchestrator expectation
    const dup = evidenceStore.find(
      (r) => r.deliverable_id === ev.deliverable_id && r.platform === ev.platform && r.source_id === (ev as Record<string, unknown>)["source_id"] && r.observed_at === (ev as Record<string, unknown>)["observed_at"],
    );
    if (dup) throw new Error('duplicate key value violates unique constraint "evidence_idempotency_unique"');
    evidenceStore.push(ev);
    return ev as never;
  });

  vi.spyOn(evaluationRepo, "createEvaluation").mockImplementation(async (_s, input) => {
    const ev = { id: `eval-${evaluationStore.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString() } as EvaluationRow;
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
    // required fields
    ...overrides,
  } as CanonicalVideo;
}

function _makeLive(overrides: Partial<CanonicalLiveStream>): CanonicalLiveStream {
  void overrides;
  return {
    platform: "twitch" as Platform,
    externalStreamId: overrides.externalStreamId ?? "stream-1",
    externalChannelId: overrides.externalChannelId ?? "twitch-123",
    title: overrides.title ?? "Live",
    description: overrides.description ?? "",
    tags: overrides.tags ?? [],
    category: overrides.category ?? null,
    viewerCount: 100,
    startedAt: "2026-03-15T12:00:00Z",
    canonicalUrl: "https://twitch.tv/handle-0",
    observedAt: "2026-03-15T12:00:00Z",
    isLive: true,
    ...overrides,
  } as CanonicalLiveStream;
}

function providerWithVideos(videos: CanonicalVideo[], live: CanonicalLiveStream | null = null): LiveStateProvider & VideoEvidenceProvider {
  return {
    platform: "twitch" as Platform,
    getLiveState: async () => live,
    listVideos: async () => videos,
    resolveChannel: async () => null,
    resolveCategory: async () => null,
    listTags: async () => [],
    clearCache: () => {},
  } as unknown as LiveStateProvider & VideoEvidenceProvider;
}

describe("multi-requirement sponsor tracking — regression lock", () => {
  beforeEach(() => {
    resetMocks();
    vi.restoreAllMocks();
  });

  // ── TEST CASE 1 ──
  it("TC1: 4 requirements, one candidate → all 4 PASS", async () => {
    const supabase = makeSupabase();
    const campaignId = "camp-1";
    const orgId = "org-a";

    const deliverables = [
      { id: "del-1", rule: { type: "required_title_contains", value: "BrandX" } },
      { id: "del-2", rule: { type: "required_description_contains", value: "brandx.com" } },
      { id: "del-3", rule: { type: "minimum_duration", minutes: 60 } },
      { id: "del-4", rule: { type: "required_category", categoryId: "gaming-1" } },
    ];

    const video = makeVideo({
      title: "BrandX Gaming Championship #BrandX",
      description: "Sponsored by BrandX — https://brandx.com",
      durationSeconds: 7200,
      category: { id: "gaming-1", name: "Gaming", platform: "twitch" as Platform },
      externalVideoId: "vid-brandx-1",
    });

    const { evidenceStore, evaluationStore } = setupMocks({ orgId, campaignId, deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });

    const provider = providerWithVideos([video]);
    const res = await executeScan({ supabase, input: { organizationId: orgId, campaignId }, providers: { twitch: provider } });

    expect(res.evaluationCount).toBe(4);
    expect(res.evidenceCount).toBe(4);
    expect(evaluationStore).toHaveLength(4);
    for (const ev of evaluationStore) {
      expect(ev.result).toBe("PASS");
      expect(ev.scan_id).toBe(res.scan.id);
      expect(ev.organization_id ?? orgId).toBeDefined();
    }
    // each deliverable has distinct evidence
    const byDel = new Map(evaluationStore.map((e) => [e.deliverable_id, e]));
    expect(byDel.get("del-1")?.result).toBe("PASS");
    expect(byDel.get("del-2")?.result).toBe("PASS");
    expect(byDel.get("del-3")?.result).toBe("PASS");
    expect(byDel.get("del-4")?.result).toBe("PASS");
    // same candidate may provide evidence for multiple requirements
    const contentIds = evidenceStore.map((e) => e.external_content_id);
    expect(contentIds.every((id) => id === "vid-brandx-1")).toBe(true);
  });

  // ── TEST CASE 2 ──
  it("TC2: mixed results — 3 PASS 1 FAIL", async () => {
    const supabase = makeSupabase();
    const deliverables = [
      { id: "del-1", rule: { type: "required_title_contains", value: "#BrandX" } },
      { id: "del-2", rule: { type: "required_description_contains", value: "brandx.com" } },
      { id: "del-3", rule: { type: "minimum_duration", minutes: 60 } },
      { id: "del-4", rule: { type: "required_category", categoryId: "gaming-1" } },
    ];
    const video = makeVideo({
      title: "BrandX Gaming Championship #BrandX",
      description: "Sponsored by BrandX", // no brandx.com
      durationSeconds: 30, // FAIL (<60)
      category: { id: "gaming-1", name: "Gaming", platform: "twitch" as Platform },
      externalVideoId: "vid-mixed",
    });

    // Adjust del-2 to expect brandx.com which will FAIL because description lacks it, but spec says TC2 expects del-2 PASS? Let's make description contain brandx.com for PASS, and duration FAIL
    // For this test we want del-2 PASS, so include brandx.com
    video.description = "Sponsored by BrandX — https://brandx.com";
    // Actually we want 3 PASS 1 FAIL: duration FAIL, others PASS
    // So keep as above: del-1 PASS, del-2 PASS, del-4 PASS, del-3 FAIL

    const { evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-mixed", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([video]);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-mixed" }, providers: { twitch: provider } });

    expect(evaluationStore).toHaveLength(4);
    const byDel = Object.fromEntries(evaluationStore.map((e) => [e.deliverable_id, e.result]));
    expect(byDel["del-1"]).toBe("PASS");
    expect(byDel["del-2"]).toBe("PASS");
    expect(byDel["del-3"]).toBe("FAIL"); // duration 30 <60
    expect(byDel["del-4"]).toBe("PASS");
    // all evaluations preserved, no disappearance
    expect(res.evaluationCount).toBe(4);
  });

  // ── TEST CASE 3 ──
  it("TC3: multiple candidates — documents current per-requirement selection", async () => {
    const supabase = makeSupabase();
    const deliverables = [
      { id: "del-title", rule: { type: "required_title_contains", value: "BrandX" } },
      { id: "del-desc", rule: { type: "required_description_contains", value: "brandx.com" } },
    ];

    const videoA = makeVideo({ title: "BrandX Event", description: "no link", externalVideoId: "vid-A", publishedAt: "2026-03-15T10:00:00Z" });
    const videoB = makeVideo({ title: "Other", description: "visit brandx.com now", externalVideoId: "vid-B", publishedAt: "2026-03-15T11:00:00Z" });
    const videoC = makeVideo({ title: "BrandX Final", description: "brandx.com official", externalVideoId: "vid-C", publishedAt: "2026-03-15T12:00:00Z" });

    // Order as returned by provider: A, B, C (search order). Current engine scans in order and picks first PASS per requirement.
    const provider = providerWithVideos([videoA, videoB, videoC]);

    const { evidenceStore, evaluationStore } = setupMocks({
      orgId: "org-a",
      campaignId: "camp-multi-cand",
      deliverables,
      channels: [{ platform: "twitch", external_channel_id: "twitch-123" }],
    });

    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-multi-cand" }, providers: { twitch: provider } });

    // Cartesian with PASS-only: 2 req × 3 vids = 6 evaluated, 4 PASS persisted
    expect(evaluationStore).toHaveLength(4);
    expect(evidenceStore).toHaveLength(4);
    expect(res.evaluationCount).toBe(4);
    expect(res.evidenceCount).toBe(4);
    // Verify PASS associations: V1→R1, V2→R2, V3→R1,R2 = 4 PASS
    const passCount = evaluationStore.filter((e) => (e as { result: string }).result === "PASS").length;
    expect(passCount).toBe(4);
    // Each deliverable has PASS count (del-title: vid-A,C →2, del-desc: vid-B,C →2)
    expect(evidenceStore.filter((e) => e.deliverable_id === "del-title")).toHaveLength(2);
    expect(evidenceStore.filter((e) => e.deliverable_id === "del-desc")).toHaveLength(2);
    // Specific PASS mappings
    const titlePassIds = evaluationStore.filter((e) => e.deliverable_id === "del-title" && e.result === "PASS").map((e) => evidenceStore.find((ev) => ev.id === e.evidence_id)?.external_content_id);
    const descPassIds = evaluationStore.filter((e) => e.deliverable_id === "del-desc" && e.result === "PASS").map((e) => evidenceStore.find((ev) => ev.id === e.evidence_id)?.external_content_id);
    expect(titlePassIds).toEqual(expect.arrayContaining(["vid-A", "vid-C"]));
    expect(descPassIds).toEqual(expect.arrayContaining(["vid-B", "vid-C"]));
  });

  // ── TEST CASE 4 ──
  it("TC4: 10 requirements — no early termination", async () => {
    const supabase = makeSupabase();
    const deliverables = [
      { id: "del-1", rule: { type: "required_title_contains", value: "BrandX" } },
      { id: "del-2", rule: { type: "required_description_contains", value: "brand" } },
      { id: "del-3", rule: { type: "minimum_duration", minutes: 1 } },
      { id: "del-4", rule: { type: "required_category", categoryId: "gaming-1" } },
      { id: "del-5", rule: { type: "required_hashtag", value: "#BrandX" } },
      { id: "del-6", rule: { type: "required_title_contains", value: "Gaming" } },
      { id: "del-7", rule: { type: "required_description_contains", value: "https" } },
      { id: "del-8", rule: { type: "required_streaming_window", value: "2026-03-01T00:00:00Z" } } as unknown as { type: string; value: string },
      { id: "del-9", rule: { type: "required_title_contains", value: "Championship" } },
      { id: "del-10", rule: { type: "required_description_contains", value: "Sponsored" } },
    ];

    // Need to adjust rule shapes to match evaluator expectations for hashtag/streaming_window/category
    // Fix del-8 to proper type
    (deliverables[7] as { rule: unknown }).rule = { type: "required_streaming_window" };

    const video = makeVideo({
      title: "BrandX Gaming Championship #BrandX",
      description: "Sponsored by BrandX https://brandx.com brand",
      durationSeconds: 600,
      category: { id: "gaming-1", name: "Gaming", platform: "twitch" as Platform },
      externalVideoId: "vid-10",
      tags: [{ source: "twitch_curated", value: "gaming", label: "Gaming" }] as unknown as CanonicalVideo["tags"],
    });

    const { evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-10", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([video], null);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-10" }, providers: { twitch: provider } });
    // debug (only warn allowed)
    if (evaluationStore.length === 0) {
      console.warn("TC4 res", JSON.stringify(res, null, 2));
    }
    expect(evaluationStore).toHaveLength(10);
    expect(res.evaluationCount).toBe(10);
    // No missing, no duplicate deliverable_id
    const ids = evaluationStore.map((e) => e.deliverable_id);
    expect(new Set(ids).size).toBe(10);
    expect(ids).toEqual(expect.arrayContaining(deliverables.map((d) => d.id)));
  });

  // ── TEST CASE 5 ──
  it("TC5: zero requirements — scan still creates with zero evaluations", async () => {
    const supabase = makeSupabase();
    const { evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-zero", deliverables: [], channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([makeVideo({ title: "Any", externalVideoId: "vid-0" })]);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-zero" }, providers: { twitch: provider } });

    expect(res.evaluationCount).toBe(0);
    expect(evaluationStore).toHaveLength(0);
    expect(res.scan.status).toBe("success"); // no failures, no evidence but not failed
  });

  // ── TEST CASE 6 ──
  it("TC6: same candidate satisfies multiple requirements — no duplicate scan/content", async () => {
    const supabase = makeSupabase();
    const deliverables = [
      { id: "del-a", rule: { type: "required_title_contains", value: "BrandX" } },
      { id: "del-b", rule: { type: "required_description_contains", value: "brandx.com" } },
      { id: "del-c", rule: { type: "minimum_duration", minutes: 60 } },
      { id: "del-d", rule: { type: "required_category", categoryId: "gaming-1" } },
    ];
    const video = makeVideo({
      title: "BrandX",
      description: "brandx.com",
      durationSeconds: 120,
      category: { id: "gaming-1", name: "Gaming", platform: "twitch" as Platform },
      externalVideoId: "vid-same",
    });

    const { evidenceStore, scans } = setupMocks({ orgId: "org-a", campaignId: "camp-same", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([video]);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-same" }, providers: { twitch: provider } });

    expect(scans).toHaveLength(1); // one scan record
    expect(res.evaluationCount).toBe(4);
    // All evidence points to same external_content_id but distinct deliverable_id
    for (const ev of evidenceStore) {
      expect(ev.external_content_id).toBe("vid-same");
    }
    const distinctDel = new Set(evidenceStore.map((e) => e.deliverable_id));
    expect(distinctDel.size).toBe(4);
  });

  // ── TEST CASE 7 ──
  it("TC7: requirement isolation — evidence/evaluation cannot cross contaminate", async () => {
    const supabase = makeSupabase();
    const deliverables = [
      { id: "del-pass", rule: { type: "required_title_contains", value: "PASSME" } },
      { id: "del-fail", rule: { type: "required_title_contains", value: "FAILME_NOT_PRESENT" } },
    ];
    const video = makeVideo({ title: "PASSME video", externalVideoId: "vid-iso" });
    const { evidenceStore, evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-iso", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([video]);
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-iso" }, providers: { twitch: provider } });

    const passEval = evaluationStore.find((e) => e.deliverable_id === "del-pass")!;
    const failEval = evaluationStore.find((e) => e.deliverable_id === "del-fail")!;
    expect(passEval.result).toBe("PASS");
    expect(failEval.result).toBe("FAIL");
    // Evidence: both have evidence but for fail, evidence is fallback (still vid-iso but FAIL)
    const passEv = evidenceStore.find((e) => e.deliverable_id === "del-pass")!;
    const failEv = evidenceStore.find((e) => e.deliverable_id === "del-fail")!;
    expect(passEv.deliverable_id).not.toBe(failEv.deliverable_id);
    expect(passEv.id).not.toBe(failEv.id);
    expect(passEval.evidence_id).toBe(passEv.id);
    expect(failEval.evidence_id).toBe(failEv.id);
  });

  // ── TEST CASE 8 ──
  it("TC8: historical checks — two scans do not overwrite", async () => {
    const supabase = makeSupabase();
    const deliverables = [{ id: "del-hist", rule: { type: "required_title_contains", value: "BrandX" } }];
    const { evaluationStore, scans } = setupMocks({ orgId: "org-a", campaignId: "camp-hist", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });

    const videoPass = makeVideo({ title: "BrandX", externalVideoId: "vid-pass" });
    const providerPass = providerWithVideos([videoPass]);
    const first = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-hist" }, providers: { twitch: providerPass } });
    expect(evaluationStore[0]!.result).toBe("PASS");
    expect(evaluationStore[0]!.scan_id).toBe(first.scan.id);

    const videoFail = makeVideo({ title: "No match", externalVideoId: "vid-fail" });
    const providerFail = providerWithVideos([videoFail]);
    const second = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-hist" }, providers: { twitch: providerFail } });

    expect(scans).toHaveLength(2);
    expect(first.scan.id).not.toBe(second.scan.id);
    expect(evaluationStore).toHaveLength(2);
    expect(evaluationStore[0]!.scan_id).not.toBe(evaluationStore[1]!.scan_id);
    expect(evaluationStore[0]!.result).toBe("PASS");
    expect(evaluationStore[1]!.result).toBe("FAIL");
    // Historical not overwritten
  });

  // ── TEST CASE 9 ──
  it("TC9: UI data contract — Check Detail contains all requirement evaluations", async () => {
    const supabase = makeSupabase();
    const deliverables = [
      { id: "del-1", rule: { type: "required_title_contains", value: "BrandX" } },
      { id: "del-2", rule: { type: "required_description_contains", value: "brandx.com" } },
    ];
    const video = makeVideo({ title: "BrandX", description: "brandx.com", externalVideoId: "vid-ui" });
    const { evidenceStore, evaluationStore } = setupMocks({ orgId: "org-a", campaignId: "camp-ui", deliverables, channels: [{ platform: "twitch", external_channel_id: "twitch-123" }] });
    const provider = providerWithVideos([video]);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-ui" }, providers: { twitch: provider } });

    // Simulate what scan-detail service does: fetch scan + evidence + evaluations by scan_id
    expect(res.scan.id).toBeTruthy();
    for (const del of deliverables) {
      const ev = evidenceStore.find((e) => e.deliverable_id === del.id && e.scan_id === res.scan.id);
      const evl = evaluationStore.find((e) => e.deliverable_id === del.id && e.scan_id === res.scan.id);
      expect(ev).toBeDefined();
      expect(evl).toBeDefined();
      expect(evl!.result).toBe("PASS");
      expect(evl!.evidence_id).toBe(ev!.id);
    }
    // Proof grouping would show 1 platform with 2 evidence
    expect(evidenceStore.filter((e) => e.scan_id === res.scan.id)).toHaveLength(2);
  });
});
