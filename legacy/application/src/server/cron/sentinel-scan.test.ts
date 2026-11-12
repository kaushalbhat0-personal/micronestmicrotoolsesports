import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadEligibleCampaigns, runCampaignScans } from "./sentinel-scan";
import * as scanner from "@/server/scanner/scan-orchestrator";

vi.mock("@/server/scanner/scan-orchestrator", async () => {
  const actual = await vi.importActual<typeof scanner>("@/server/scanner/scan-orchestrator");
  return { ...actual, executeScan: vi.fn() };
});

function makeSupabaseMock(campaigns: Array<{ id: string; organization_id: string; status: string }>, entitlements: Record<string, boolean>, deliverableCounts: Record<string, number>, channelCounts: Record<string, number>) {
  return {
    from: (table: string) => {
      if (table === "sponsor_campaigns") {
        return {
          select: () => ({
            eq: (_k: string, _v: string) => Promise.resolve({ data: campaigns.filter((c) => c.status === "active"), error: null }),
          }),
        } as never;
      }
      if (table === "tools") {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { id: "tool-id" }, error: null }) }) }) } as never;
      }
      if (table === "tool_entitlements") {
        return {
          select: () => ({
            eq: (k: string, v: string) => {
              // ignore
              return Promise.resolve({ data: Object.entries(entitlements).map(([org, isAll]) => ({ organization_id: org, is_all_access: isAll, tool_id: "tool-id", expires_at: null })).filter((e) => e.organization_id === v), error: null });
            },
          }),
        } as never;
      }
      if (table === "deliverables") {
        return {
          select: (_cols: string, _opts?: { count: string; head: boolean }) => ({
            eq: (_k: string, v: string) => Promise.resolve({ count: deliverableCounts[v] ?? 0, error: null, data: null }),
          }),
        } as never;
      }
      if (table === "connected_channels") {
        return {
          select: (_cols: string, _opts?: { count: string; head: boolean }) => ({
            eq: (_k: string, v: string) => Promise.resolve({ count: channelCounts[v] ?? 0, error: null, data: null }),
          }),
        } as never;
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) } as never;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === "has_tool_access") {
        const org = args.org_id as string;
        return { data: entitlements[org] ?? false, error: null } as never;
      }
      return { data: null, error: { message: "not found" } } as never;
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("loadEligibleCampaigns", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects active with deliverables, channels, entitlement", async () => {
    const supabase = makeSupabaseMock(
      [
        { id: "camp-active", organization_id: "org-a", status: "active" },
        { id: "camp-draft", organization_id: "org-a", status: "draft" },
      ],
      { "org-a": true },
      { "camp-active": 1, "camp-draft": 1 },
      { "org-a": 1 },
    );
    const res = await loadEligibleCampaigns(supabase);
    expect(res.map((r) => r.campaign.id)).toEqual(["camp-active"]);
    expect(res[0]?.organizationId).toBe("org-a");
  });

  it("excludes inactive, missing deliverables, missing channels, unentitled", async () => {
    const supabase = makeSupabaseMock(
      [
        { id: "c1", organization_id: "org-a", status: "active" },
        { id: "c2", organization_id: "org-b", status: "active" },
      ],
      { "org-a": false, "org-b": true },
      { c1: 0, c2: 1 },
      { "org-a": 1, "org-b": 0 },
    );
    const res = await loadEligibleCampaigns(supabase);
    expect(res.length).toBe(0);
  });

  it("tenant identity comes from DB record not request", async () => {
    const supabase = makeSupabaseMock(
      [{ id: "camp-1", organization_id: "org-real", status: "active" }],
      { "org-real": true },
      { "camp-1": 1 },
      { "org-real": 1 },
    );
    const res = await loadEligibleCampaigns(supabase);
    expect(res[0]?.organizationId).toBe("org-real");
  });
});

describe("runCampaignScans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("each campaign attempted, failure isolation", async () => {
    const supabase = {} as unknown as import("@supabase/supabase-js").SupabaseClient;
    const execMock = vi.mocked(scanner.executeScan);
    execMock.mockImplementation(async ({ input }) => {
      if (input.campaignId === "camp-fail") throw new Error("provider down");
      return { scan: { id: "scan-1" } as never, evidenceCount: 1, evaluationCount: 1, stageErrors: [] };
    });

    const campaigns = [
      { campaign: { id: "camp-ok-1" } as never, organizationId: "org-a" },
      { campaign: { id: "camp-fail" } as never, organizationId: "org-a" },
      { campaign: { id: "camp-ok-2" } as never, organizationId: "org-a" },
    ];

    const res = await runCampaignScans(supabase, campaigns);
    expect(res.attempted).toBe(3);
    expect(res.succeeded).toBe(2);
    expect(res.failed).toBe(1);
    expect(execMock).toHaveBeenCalledTimes(3);
  });

  it("calls existing scanner not duplicate logic", async () => {
    const supabase = {} as unknown as import("@supabase/supabase-js").SupabaseClient;
    const execMock = vi.mocked(scanner.executeScan);
    execMock.mockResolvedValue({ scan: { id: "s" } as never, evidenceCount: 0, evaluationCount: 0, stageErrors: [] });
    await runCampaignScans(supabase, [{ campaign: { id: "c1" } as never, organizationId: "org-a" }]);
    expect(execMock).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ campaignId: "c1" }) }));
  });
});
