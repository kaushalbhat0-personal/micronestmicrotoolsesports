import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/server/repositories/sponsor-campaigns", async () => {
  const actual = await vi.importActual<typeof import("@/server/repositories/sponsor-campaigns")>("@/server/repositories/sponsor-campaigns");
  return actual;
});
vi.mock("@/server/repositories/deliverables", async () => {
  const actual = await vi.importActual<typeof import("@/server/repositories/deliverables")>("@/server/repositories/deliverables");
  return actual;
});

import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as evidenceRepo from "@/server/repositories/evidence";
import * as evaluationRepo from "@/server/repositories/evaluations";
import * as scanRepo from "@/server/repositories/scans";
import { executeScan } from "./scan-orchestrator";
import { getMockProvider, resetMocks } from "@/server/integrations/mock/provider";
import { createInMemoryBudget } from "@/features/sponsor-sentinel/services/budget";

function makeSupabase(): SupabaseClient {
  // Minimal stub: repositories are mocked via vi.mock above where needed, but we need a client for scanRepo calls.
  // We'll create an in-memory store for scans/evidence/evaluations to allow orchestrator to work without DB.
  const stores: Record<string, Record<string, unknown>[]> = { scans: [], evidence: [], evaluations: [] };

  const makeTable = (name: string) => ({
    insert: (row: Record<string, unknown>) => ({
      select: () => ({
        single: async () => {
          const inserted: Record<string, unknown> = { id: `${name}-${(stores[name] ?? []).length + 1}`, ...row, created_at: new Date().toISOString() };
          // Simulate unique constraint for evidence idempotency
          if (name === "evidence") {
            const dup = (stores[name] as Record<string, unknown>[]).find(
              (r) =>
                r["organization_id"] === inserted["organization_id"] &&
                r["deliverable_id"] === inserted["deliverable_id"] &&
                r["platform"] === inserted["platform"] &&
                r["source"] === inserted["source"] &&
                r["source_id"] === inserted["source_id"] &&
                r["observed_at"] === inserted["observed_at"],
            );
            if (dup) throw new Error('duplicate key value violates unique constraint "evidence_idempotency_unique"');
          }
          (stores[name] as Record<string, unknown>[]).push(inserted);
          return { data: inserted, error: null };
        },
      }),
    }),
    select: () => ({
      eq: () => ({
        single: async () => ({ data: null, error: { message: "not found" } as unknown } as never),
        order: async () => ({ data: stores[name], error: null }),
      }),
      single: async () => ({ data: null, error: null }),
    }),
    update: (patch: Record<string, unknown>) => ({
      eq: (_k: string, _v: unknown) => ({
        select: () => ({
          single: async () => {
            const scan = (stores["scans"] as unknown[])[0] as Record<string, unknown> | undefined;
            if (scan) Object.assign(scan, patch);
            return { data: scan ?? { id: "scan-1", ...patch }, error: null };
          },
        }),
      }),
    }),
    delete: () => ({ eq: async () => ({ error: null }) }),
    from: undefined,
  });

  const from = (table: string) => makeTable(table) as never;

  return { from } as unknown as SupabaseClient;
}

// Helper to setup campaign/deliverables/channels via mocked repos
function setupMocks(opts: {
  orgId: string;
  campaignId: string;
  deliverables: Array<{ id: string; rule: unknown }>;
  channels: Array<{ platform: "twitch" | "youtube" | "kick"; external_channel_id: string }>;
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

  // Mock scan repo to use in-memory
  const scans: unknown[] = [];
  vi.spyOn(scanRepo, "createScan").mockImplementation(async (_s, input) => {
    const scan = { id: `scan-${scans.length + 1}`, ...input, created_at: new Date().toISOString(), started_at: new Date().toISOString() } as never;
    scans.push(scan);
    return scan;
  });
  vi.spyOn(scanRepo, "updateScanStatus").mockImplementation(async (_s, id, patch) => {
    const found = scans.find((x) => (x as { id: string }).id === id) as Record<string, unknown> | undefined;
    if (found) Object.assign(found, patch);
    return { id, ...patch, organization_id: opts.orgId, campaign_id: opts.campaignId, platform: "twitch", scanner_version: "v1" } as never;
  });

  const evidenceStore: Record<string, unknown>[] = [];
  vi.spyOn(evidenceRepo, "createEvidence").mockImplementation(async (_s, input) => {
    const dup = evidenceStore.find(
      (r) =>
        r["deliverable_id"] === input.deliverable_id &&
        r["platform"] === (input as Record<string, unknown>)["platform"] &&
        r["source_id"] === (input as Record<string, unknown>)["source_id"] &&
        r["observed_at"] === (input as Record<string, unknown>)["observed_at"],
    );
    if (dup) throw new Error('duplicate key value violates unique constraint "evidence_idempotency_unique"');
    const ev: Record<string, unknown> = { id: `ev-${evidenceStore.length + 1}`, ...(input as Record<string, unknown>), created_at: new Date().toISOString() };
    evidenceStore.push(ev);
    return ev as never;
  });

  vi.spyOn(evaluationRepo, "createEvaluation").mockImplementation(async (_s, input) => {
    return { id: `eval-${Math.random()}`, ...input, created_at: new Date().toISOString() } as never;
  });

  return { evidenceStore, scans };
}

describe("scan orchestrator - pipeline", () => {
  beforeEach(() => {
    resetMocks();
    vi.restoreAllMocks();
  });

  it("successful scan twitch PASS", async () => {
    const supabase = makeSupabase();
    setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "OurBrand" } }],
      channels: [{ platform: "twitch", external_channel_id: "twitch-123" }],
    });
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    expect(res.scan.status).toBe("success");
    expect(res.evidenceCount).toBeGreaterThan(0);
    expect(res.evaluationCount).toBeGreaterThan(0);
    expect(res.stageErrors.length).toBe(0);
  });

  it("youtube success and kick live-only success", async () => {
    const supabase = makeSupabase();
    setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_hashtag", value: "#OurBrand" } }],
      channels: [
        { platform: "youtube", external_channel_id: "UC123" },
        { platform: "kick", external_channel_id: "999" },
      ],
    });
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    expect(["success", "partial"]).toContain(res.scan.status);
    expect(res.evidenceCount).toBeGreaterThan(0);
  });

  it("NOT_SUPPORTED for kick VOD duration", async () => {
    const supabase = makeSupabase();
    setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "minimum_duration", minutes: 60 } }],
      channels: [{ platform: "kick", external_channel_id: "999" }],
    });
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    // Even though rule is NOT_SUPPORTED, scan should succeed (evidence may be empty but no provider failure)
    expect(res.scan.status).toBe("success");
    // evaluation should be NOT_SUPPORTED (not FAIL) - we can check by evaluating directly
    const { evaluateRule } = await import("@/features/sponsor-sentinel/services/evaluator");
    const out = evaluateRule({ type: "minimum_duration", minutes: 60 } as never, "kick", { kind: "none" });
    expect(out.result).toBe("NOT_SUPPORTED");
  });

  it("provider error does not become FAIL", async () => {
    const supabase = makeSupabase();
    setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }],
      channels: [{ platform: "twitch", external_channel_id: "twitch-123" }],
    });
    getMockProvider("twitch").setConfig({ shouldFail: true, failMessage: "twitch down" });
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    expect(res.scan.status).toBe("failed");
    expect(res.stageErrors.some((e) => e.stage === "FETCH")).toBe(true);
    // No evaluation should be FAIL due to provider error (evaluator not called)
    expect(res.evaluationCount).toBe(0);
  });

  it("budget exhaustion handled as operational not FAIL", async () => {
    const supabase = makeSupabase();
    setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }],
      channels: [{ platform: "twitch", external_channel_id: "twitch-123" }],
    });
    const budget = createInMemoryBudget({ platform: "twitch", limit: 1, windowMs: 60_000 }, 0);
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" }, budgets: { twitch: budget } });
    expect(res.scan.status).toBe("failed");
    expect(res.stageErrors[0]?.message).toMatch(/budget/);
  });

  it("partial: twitch+ youtube succeed, kick fails", async () => {
    const supabase = makeSupabase();
    setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "OurBrand" } }],
      channels: [
        { platform: "twitch", external_channel_id: "twitch-123" },
        { platform: "youtube", external_channel_id: "UC123" },
        { platform: "kick", external_channel_id: "999" },
      ],
    });
    getMockProvider("kick").setConfig({ shouldFail: true, failMessage: "kick down" });
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    expect(res.scan.status).toBe("partial");
    expect(res.evidenceCount).toBeGreaterThan(0); // twitch/youtube evidence preserved
    expect(res.stageErrors.some((e) => e.platform === "kick")).toBe(true);
  });

  it("complete failure all providers fail", async () => {
    const supabase = makeSupabase();
    setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }],
      channels: [
        { platform: "twitch", external_channel_id: "twitch-123" },
        { platform: "youtube", external_channel_id: "UC123" },
      ],
    });
    getMockProvider("twitch").setConfig({ shouldFail: true });
    getMockProvider("youtube").setConfig({ shouldFail: true });
    const res = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    expect(res.scan.status).toBe("failed");
    expect(res.evidenceCount).toBe(0);
  });

  it("retry creates new scan, previous evidence unchanged", async () => {
    const supabase = makeSupabase();
    const { evidenceStore } = setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "OurBrand" } }],
      channels: [{ platform: "twitch", external_channel_id: "twitch-123" }],
    });
    const first = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    expect(first.scan.status).toBe("success");
    const countAfterFirst = evidenceStore.length;
    const second = await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    expect(second.scan.id).not.toBe(first.scan.id);
    // Second run duplicate evidence should be swallowed via unique constraint, so count unchanged
    expect(evidenceStore.length).toBe(countAfterFirst);
  });

  it("idempotency duplicate evidence not duplicated", async () => {
    const supabase = makeSupabase();
    const { evidenceStore } = setupMocks({
      orgId: "org-a",
      campaignId: "camp-a",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "OurBrand" } }],
      channels: [{ platform: "twitch", external_channel_id: "twitch-123" }],
    });
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    const before = evidenceStore.length;
    await executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-a" } });
    expect(evidenceStore.length).toBe(before);
  });

  it("tenant isolation: org A cannot scan org B campaign", async () => {
    const supabase = makeSupabase();
    setupMocks({
      orgId: "org-b",
      campaignId: "camp-b",
      deliverables: [{ id: "del-1", rule: { type: "required_title_contains", value: "x" } }],
      channels: [{ platform: "twitch", external_channel_id: "twitch-123" }],
    });
    await expect(executeScan({ supabase, input: { organizationId: "org-a", campaignId: "camp-b" } })).rejects.toThrow(/organization mismatch/);
  });
});
