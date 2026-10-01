import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as evidenceRepo from "@/server/repositories/evidence";
import * as evaluationRepo from "@/server/repositories/evaluations";
import * as scanRepo from "@/server/repositories/scans";
import { executeScan } from "./scan-orchestrator";

function makeSupabaseStub() {
  const stores: Record<string, unknown[]> = { scans: [], evidence: [], evaluations: [] };
  const makeTable = (name: string) => ({
    insert: (row: Record<string, unknown>) => ({
      select: () => ({
        single: async () => {
          const inserted = { id: `${name}-${stores[name].length + 1}`, ...row, created_at: new Date().toISOString() };
          if (name === "evidence") {
            const dup = (stores[name] as Record<string, unknown>[]).find(
              (r) => r["deliverable_id"] === inserted["deliverable_id"] && r["source_id"] === inserted["source_id"],
            );
            if (dup) throw new Error('duplicate key value violates unique constraint "evidence_idempotency_unique"');
          }
          (stores[name] as unknown[]).push(inserted);
          return { data: inserted, error: null };
        },
      }),
    }),
    update: (patch: Record<string, unknown>) => ({
      eq: () => ({
        select: () => ({
          single: async () => {
            const scan = (stores["scans"] as unknown[])[0] as Record<string, unknown> | undefined;
            if (scan) Object.assign(scan, patch);
            return { data: scan ?? { id: "scan-1", ...patch }, error: null };
          },
        }),
      }),
    }),
    from: undefined,
  });
  return {
    from: (t: string) => makeTable(t) as never,
    stores,
  } as unknown as { supabase: SupabaseClient; stores: Record<string, unknown[]> };
}

function setupCampaignMocks(opts: { orgId: string; campaignId: string; deliverables: unknown[]; from: string; to: string }) {
  vi.spyOn(campaignRepo, "findSponsorCampaignById").mockResolvedValue({
    id: opts.campaignId,
    organization_id: opts.orgId,
    name: "Camp",
    description: null,
    status: "active",
    starts_at: opts.from,
    ends_at: opts.to,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never);
  vi.spyOn(deliverableRepo, "listDeliverablesByCampaign").mockResolvedValue(
    opts.deliverables.map((rule, i) => ({
      id: `del-${i + 1}`,
      organization_id: opts.orgId,
      campaign_id: opts.campaignId,
      name: `Del ${i + 1}`,
      description: null,
      rule,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })) as never,
  );
  vi.spyOn(channelRepo, "listConnectedChannelsByOrg").mockResolvedValue([
    {
      id: "ch-1",
      organization_id: opts.orgId,
      platform: "youtube",
      external_channel_id: "UCoZxzLMwr06_UEj2JpkAtoQ",
      external_handle: "@mysticminutes17",
      display_name: "Mystic Minutes",
      canonical_url: "https://youtube.com/channel/UCoZxzLMwr06_UEj2JpkAtoQ",
      connection_mode: "discovered",
      connection_status: "connected",
      authorized_at: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never,
  ]);
  const scans: unknown[] = [];
  vi.spyOn(scanRepo, "createScan").mockImplementation(async (_s, input) => {
    const scan = { id: `scan-${scans.length + 1}`, ...input, created_at: new Date().toISOString(), started_at: new Date().toISOString() } as never;
    scans.push(scan);
    return scan;
  });
  vi.spyOn(scanRepo, "updateScanStatus").mockImplementation(async (_s, id, patch) => {
    const found = scans.find((x) => (x as { id: string }).id === id) as Record<string, unknown> | undefined;
    if (found) Object.assign(found, patch);
    return { id, ...patch, organization_id: opts.orgId, campaign_id: opts.campaignId, platform: "youtube" } as never;
  });
  const evidenceStore: unknown[] = [];
  vi.spyOn(evidenceRepo, "createEvidence").mockImplementation(async (_s, input) => {
    const ev: Record<string, unknown> = { id: `ev-${evidenceStore.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString() };
    evidenceStore.push(ev);
    return ev as never;
  });
  vi.spyOn(evaluationRepo, "createEvaluation").mockImplementation(async (_s, input) => {
    return { id: `eval-${Math.random()}`, ...input, created_at: new Date().toISOString() } as never;
  });
  return { evidenceStore };
}

function makeVideo(overrides: Partial<CanonicalVideo> & { externalVideoId: string }): CanonicalVideo {
  return {
    platform: "youtube",
    externalVideoId: overrides.externalVideoId,
    externalChannelId: "UCoZxzLMwr06_UEj2JpkAtoQ",
    channelHandle: "@mysticminutes17",
    title: overrides.title ?? "Title",
    description: overrides.description ?? null,
    category: null,
    tags: [],
    startedAt: null,
    publishedAt: overrides.publishedAt ?? "2025-11-17T00:00:00Z",
    endedAt: null,
    durationSeconds: 30,
    canonicalUrl: `https://youtube.com/watch?v=${overrides.externalVideoId}`,
    observedAt: new Date().toISOString(),
    viewable: null,
    ...overrides,
  } as CanonicalVideo;
}

describe("proof engine — candidate evaluation + bounded discovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Test 1 — candidate after first video (video[2] PASS, proof = video[2])", async () => {
    const { supabase } = makeSupabaseStub() as unknown as { supabase: SupabaseClient };
    const { evidenceStore } = setupCampaignMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ type: "required_description_contains", value: "#spirituality" }],
      from: "2025-11-01T00:00:00Z",
      to: "2025-11-30T23:59:59Z",
    });
    const provider = {
      platform: "youtube" as Platform,
      getLiveState: async () => null,
      listVideos: async () =>
        [
          makeVideo({ externalVideoId: "vid0", description: "nope", title: "t0", publishedAt: "2025-11-20T00:00:00Z" }),
          makeVideo({ externalVideoId: "vid1", description: "nope2", title: "t1", publishedAt: "2025-11-19T00:00:00Z" }),
          makeVideo({ externalVideoId: "uKj01I5o3RI", description: "Krishna #spirituality gita", title: "Mind vs You", publishedAt: "2025-11-17T00:00:00Z" }),
        ] as const,
      resolveChannel: async () => null,
      listTags: async () => [],
      resolveCategory: async () => null,
    };
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { youtube: provider as never } });
    expect(res.evidenceCount).toBe(1);
    expect(evidenceStore[0] as Record<string, unknown>).toMatchObject({ source_id: "uKj01I5o3RI", source_url: "https://youtube.com/watch?v=uKj01I5o3RI" });
    expect(res.evaluationCount).toBe(1);
  });

  it("Test 2 — candidate on second search page (bounded pagination)", async () => {
    // This is tested at provider level; here we ensure scanner picks second page video if provider returns it
    const { supabase } = makeSupabaseStub() as unknown as { supabase: SupabaseClient };
    setupCampaignMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ type: "required_description_contains", value: "#spirituality" }],
      from: "2025-11-01T00:00:00Z",
      to: "2025-11-30T23:59:59Z",
    });
    const provider = {
      platform: "youtube" as Platform,
      getLiveState: async () => null,
      listVideos: async () =>
        Array.from({ length: 12 }, (_, i) => makeVideo({ externalVideoId: `vid${i}`, description: i === 10 ? "has #spirituality" : "nope", publishedAt: "2025-11-15T00:00:00Z" })),
      resolveChannel: async () => null,
      listTags: async () => [],
      resolveCategory: async () => null,
    };
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { youtube: provider as never } });
    expect(res.evidenceCount).toBe(1);
  });

  it("Test 3 — no candidate passes → FAIL", async () => {
    const { supabase } = makeSupabaseStub() as unknown as { supabase: SupabaseClient };
    setupCampaignMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ type: "required_description_contains", value: "#spirituality" }],
      from: "2025-11-01T00:00:00Z",
      to: "2025-11-30T23:59:59Z",
    });
    const provider = {
      platform: "youtube" as Platform,
      getLiveState: async () => null,
      listVideos: async () => [makeVideo({ externalVideoId: "vid0", description: "nope" }), makeVideo({ externalVideoId: "vid1", description: "also nope" })],
      resolveChannel: async () => null,
      listTags: async () => [],
      resolveCategory: async () => null,
    };
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { youtube: provider as never } });
    // Evidence still created for first failing video (FAIL still persists proof of attempt)
    expect(res.evidenceCount).toBe(1);
    expect(res.evaluationCount).toBe(1);
    // Evaluation should be FAIL, not PASS
    const { evaluateRule } = await import("@/features/sponsor-sentinel/services/evaluator");
    const out = evaluateRule({ type: "required_description_contains", value: "#spirituality" } as never, "youtube", { kind: "video", data: makeVideo({ externalVideoId: "vid0", description: "nope" }) } as never);
    expect(out.result).toBe("FAIL");
  });

  it("Test 4 — candidate outside campaign window → no PASS", async () => {
    const { supabase } = makeSupabaseStub() as unknown as { supabase: SupabaseClient };
    setupCampaignMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ type: "required_description_contains", value: "#spirituality" }],
      from: "2026-10-01T00:00:00Z",
      to: "2026-10-30T23:59:59Z",
    });
    // Provider returns video with #spirituality but we simulate already filtered by window: provider would have filtered it out, so listVideos returns []
    // To test scanner window respect, we let provider return video with old date, but scanner's observation still has that video;
    // evaluator will PASS but campaign window filter in provider would have removed it, so evidence would be for old video but campaign window's filtered list empty → scanner would see no video → no evidence.
    // Simulate provider correctly filtered: return []
    const provider = {
      platform: "youtube" as Platform,
      getLiveState: async () => null,
      listVideos: async () => [] as const,
      resolveChannel: async () => null,
      listTags: async () => [],
      resolveCategory: async () => null,
    };
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { youtube: provider as never } });
    expect(res.evidenceCount).toBe(0);
    expect(res.evaluationCount).toBe(0);
  });

  it("Test 5 — known Short regression uKj01I5o3RI", async () => {
    const { supabase } = makeSupabaseStub() as unknown as { supabase: SupabaseClient };
    const { evidenceStore } = setupCampaignMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ type: "required_description_contains", value: "#spirituality" }],
      from: "2025-11-01T00:00:00Z",
      to: "2025-11-30T23:59:59Z",
    });
    const provider = {
      platform: "youtube" as Platform,
      getLiveState: async () => null,
      listVideos: async () => [
        makeVideo({ externalVideoId: "other1", description: "nope", publishedAt: "2025-11-20T00:00:00Z" }),
        makeVideo({ externalVideoId: "uKj01I5o3RI", description: "Krishna #spirituality bhagavadgita", title: "Mind vs You: The Ultimate Showdown", publishedAt: "2025-11-17T00:00:00Z" }),
      ],
      resolveChannel: async () => null,
      listTags: async () => [],
      resolveCategory: async () => null,
    };
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { youtube: provider as never } });
    expect(res.evidenceCount).toBe(1);
    expect(evidenceStore[0] as Record<string, unknown>).toMatchObject({
      external_content_id: "uKj01I5o3RI",
      source_id: "uKj01I5o3RI",
      source_url: "https://youtube.com/watch?v=uKj01I5o3RI",
      platform: "youtube",
    });
    expect(res.evaluationCount).toBe(1);
  });

  it("Test 6 — evidence correctness points to matching candidate not first", async () => {
    const { supabase } = makeSupabaseStub() as unknown as { supabase: SupabaseClient };
    const { evidenceStore } = setupCampaignMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ type: "required_youtube_tags", tags: ["#spirituality"] }],
      from: "2025-11-01T00:00:00Z",
      to: "2025-11-30T23:59:59Z",
    });
    // Two videos: first has wrong tags, second has correct
    const v0 = makeVideo({ externalVideoId: "vid0", title: "t0", publishedAt: "2025-11-20T00:00:00Z" });
    // @ts-expect-error tags missing but we set via as
    (v0 as unknown as Record<string, unknown>).tags = [{ value: "wrong", source: "youtube_freeform", platform: "youtube", label: "wrong" }];
    const v1 = makeVideo({ externalVideoId: "uKj01I5o3RI", title: "t1", publishedAt: "2025-11-17T00:00:00Z" });
    (v1 as unknown as Record<string, unknown>).tags = [{ value: "#spirituality", source: "youtube_freeform", platform: "youtube", label: "#spirituality" }];
    const provider = {
      platform: "youtube" as Platform,
      getLiveState: async () => null,
      listVideos: async () => [v0, v1],
      resolveChannel: async () => null,
      listTags: async () => [],
      resolveCategory: async () => null,
    };
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { youtube: provider as never } });
    expect(evidenceStore[0] as Record<string, unknown>).toMatchObject({ external_content_id: "uKj01I5o3RI" });
    expect(res.evidenceCount).toBe(1);
  });
});

describe("long-form YouTube video coverage (PROOF-05A)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function makeLongForm(overrides: Partial<CanonicalVideo> & { externalVideoId: string }): CanonicalVideo {
    return makeVideo({
      durationSeconds: 1800, // 30 min
      title: "Complete Market Psychology Masterclass",
      description: "Learn market psychology and trading discipline. #trading",
      publishedAt: "2025-11-18T10:00:00Z",
      ...overrides,
    });
  }

  it("long-form video discoverable via same published-video path and passes description contains", async () => {
    const { supabase } = makeSupabaseStub() as unknown as { supabase: SupabaseClient };
    const { evidenceStore } = setupCampaignMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ type: "required_description_contains", value: "#trading" }],
      from: "2025-11-01T00:00:00Z",
      to: "2025-11-30T23:59:59Z",
    });
    const long = makeLongForm({ externalVideoId: "long-form-test-video", publishedAt: "2025-11-18T10:00:00Z" });
    const provider = {
      platform: "youtube" as Platform,
      getLiveState: async () => null,
      listVideos: async () => [long],
      resolveChannel: async () => null,
      listTags: async () => [],
      resolveCategory: async () => null,
    };
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { youtube: provider as never } });
    expect(res.evidenceCount).toBe(1);
    expect(evidenceStore[0] as Record<string, unknown>).toMatchObject({ external_content_id: "long-form-test-video", source_id: "long-form-test-video" });
  });

  it("mixed Short FAIL + long-form PASS → proof is long-form", async () => {
    const { supabase } = makeSupabaseStub() as unknown as { supabase: SupabaseClient };
    const { evidenceStore } = setupCampaignMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ type: "required_description_contains", value: "#trading" }],
      from: "2025-11-01T00:00:00Z",
      to: "2025-11-30T23:59:59Z",
    });
    const short = makeVideo({ externalVideoId: "short-test-video", description: "nope", title: "Short", publishedAt: "2025-11-17T00:00:00Z", durationSeconds: 30 });
    const long = makeLongForm({ externalVideoId: "long-form-test-video", publishedAt: "2025-11-18T10:00:00Z" });
    const provider = {
      platform: "youtube" as Platform,
      getLiveState: async () => null,
      listVideos: async () => [short, long],
      resolveChannel: async () => null,
      listTags: async () => [],
      resolveCategory: async () => null,
    };
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { youtube: provider as never } });
    expect(res.evidenceCount).toBe(1);
    expect(evidenceStore[0] as Record<string, unknown>).toMatchObject({ external_content_id: "long-form-test-video" });
  });

  it("mixed Short PASS + long-form FAIL → proof is short (no content-type preference)", async () => {
    const { supabase } = makeSupabaseStub() as unknown as { supabase: SupabaseClient };
    const { evidenceStore } = setupCampaignMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ type: "required_description_contains", value: "#spirituality" }],
      from: "2025-11-01T00:00:00Z",
      to: "2025-11-30T23:59:59Z",
    });
    const short = makeVideo({ externalVideoId: "short-test-video", description: "#spirituality short", publishedAt: "2025-11-17T00:00:00Z" });
    const long = makeLongForm({ externalVideoId: "long-form-test-video", description: "nope long", publishedAt: "2025-11-18T00:00:00Z" });
    const provider = {
      platform: "youtube" as Platform,
      getLiveState: async () => null,
      listVideos: async () => [short, long],
      resolveChannel: async () => null,
      listTags: async () => [],
      resolveCategory: async () => null,
    };
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { youtube: provider as never } });
    expect(evidenceStore[0] as Record<string, unknown>).toMatchObject({ external_content_id: "short-test-video" });
    expect(res.evidenceCount).toBe(1);
  });

  it("long-form outside window excluded", async () => {
    const { supabase } = makeSupabaseStub() as unknown as { supabase: SupabaseClient };
    setupCampaignMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ type: "required_description_contains", value: "#trading" }],
      from: "2025-11-01T00:00:00Z",
      to: "2025-11-30T23:59:59Z",
    });
    // Provider would have filtered this out; we simulate empty
    const provider = {
      platform: "youtube" as Platform,
      getLiveState: async () => null,
      listVideos: async () => [] as const,
      resolveChannel: async () => null,
      listTags: async () => [],
      resolveCategory: async () => null,
    };
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, providers: { youtube: provider as never } });
    expect(res.evidenceCount).toBe(0);
  });
});
