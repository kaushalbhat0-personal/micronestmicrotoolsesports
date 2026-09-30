import { describe, expect, it } from "vitest";
import { getScanDetail } from "./scan-detail";
function makeSupabaseMockDetailed(opts: {
  scan: { id: string; organization_id: string; campaign_id: string } | null;
  evidence: Array<{ id: string; scan_id: string | null; organization_id: string; campaign_id: string; deliverable_id: string }>;
  evaluations: Array<{ id: string; scan_id: string | null; organization_id: string; result: string; deliverable_id: string }>;
  campaignName?: string;
}) {
  return {
    from: (table: string) => {
      if (table === "scans") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => (opts.scan ? { data: opts.scan, error: null } : { data: null, error: { message: "not found" } }),
            }),
          }),
        } as never;
      }
      if (table === "sponsor_campaigns") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { name: opts.campaignName ?? "Camp" }, error: null }),
            }),
          }),
        } as never;
      }
      if (table === "evidence") {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              order: () => Promise.resolve({ data: opts.evidence.filter((e) => e.scan_id === val), error: null } as never),
            } as never),
          }),
        } as never;
      }
      if (table === "evaluations") {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              order: () => Promise.resolve({ data: opts.evaluations.filter((e) => e.scan_id === val), error: null } as never),
            } as never),
          }),
        } as never;
      }
      if (table === "deliverables") {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: null, error: null }) }),
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        } as never;
      }
      return { from: () => ({}) } as never;
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("getScanDetail - per-scan attribution", () => {
  it("correct scan lookup", async () => {
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-1", organization_id: "org-a", campaign_id: "camp-1" },
      evidence: [{ id: "ev-1", scan_id: "scan-1", organization_id: "org-a", campaign_id: "camp-1", deliverable_id: "del-1" }],
      evaluations: [{ id: "eval-1", scan_id: "scan-1", organization_id: "org-a", result: "PASS", deliverable_id: "del-1" }],
    });
    const detail = await getScanDetail(supabase, "org-a", "scan-1");
    expect(detail.scan.id).toBe("scan-1");
    expect(detail.evidence.length).toBe(1);
    expect(detail.evaluations.length).toBe(1);
  });

  it("organization isolation: org A cannot see org B scan", async () => {
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-1", organization_id: "org-b", campaign_id: "camp-1" },
      evidence: [],
      evaluations: [],
    });
    await expect(getScanDetail(supabase, "org-a", "scan-1")).rejects.toThrow(/not found/i);
  });

  it("non-existent scan -> not found", async () => {
    const supabase = makeSupabaseMockDetailed({ scan: null, evidence: [], evaluations: [] });
    await expect(getScanDetail(supabase, "org-a", "nope")).rejects.toThrow(/not found/i);
  });

  it("evidence belongs to selected scan only, no campaign-wide leakage", async () => {
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-target", organization_id: "org-a", campaign_id: "camp-1" },
      evidence: [
        { id: "ev-target", scan_id: "scan-target", organization_id: "org-a", campaign_id: "camp-1", deliverable_id: "del-1" },
        { id: "ev-other-scan", scan_id: "scan-other", organization_id: "org-a", campaign_id: "camp-1", deliverable_id: "del-1" },
        { id: "ev-no-scan", scan_id: null, organization_id: "org-a", campaign_id: "camp-1", deliverable_id: "del-1" },
      ],
      evaluations: [],
    });
    const detail = await getScanDetail(supabase, "org-a", "scan-target");
    expect(detail.evidence.map((e) => e.id)).toEqual(["ev-target"]);
    expect(detail.evidence.some((e) => e.id === "ev-other-scan")).toBe(false);
  });

  it("evaluations belong to selected scan only", async () => {
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-1", organization_id: "org-a", campaign_id: "camp-1" },
      evidence: [],
      evaluations: [
        { id: "eval-target", scan_id: "scan-1", organization_id: "org-a", result: "PASS", deliverable_id: "del-1" },
        { id: "eval-other", scan_id: "scan-other", organization_id: "org-a", result: "FAIL", deliverable_id: "del-1" },
      ],
    });
    const detail = await getScanDetail(supabase, "org-a", "scan-1");
    expect(detail.evaluations.map((e) => e.id)).toEqual(["eval-target"]);
  });

  it("empty evidence/evaluations states", async () => {
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-empty", organization_id: "org-a", campaign_id: "camp-1" },
      evidence: [],
      evaluations: [],
    });
    const detail = await getScanDetail(supabase, "org-a", "scan-empty");
    expect(detail.evidence.length).toBe(0);
    expect(detail.evaluations.length).toBe(0);
    expect(Object.keys(detail.evaluationSummary).length).toBe(0);
  });

  it("evaluation-state aggregation per-scan", async () => {
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-1", organization_id: "org-a", campaign_id: "camp-1" },
      evidence: [{ id: "ev-1", scan_id: "scan-1", organization_id: "org-a", campaign_id: "camp-1", deliverable_id: "del-1" }],
      evaluations: [
        { id: "e1", scan_id: "scan-1", organization_id: "org-a", result: "PASS", deliverable_id: "del-1" },
        { id: "e2", scan_id: "scan-1", organization_id: "org-a", result: "FAIL", deliverable_id: "del-1" },
        { id: "e3", scan_id: "scan-1", organization_id: "org-a", result: "PASS", deliverable_id: "del-1" },
      ],
    });
    const detail = await getScanDetail(supabase, "org-a", "scan-1");
    expect(detail.evaluationSummary["PASS"]).toBe(2);
    expect(detail.evaluationSummary["FAIL"]).toBe(1);
  });

  it("does not expose scan belonging to other org even if scan_id guessed", async () => {
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-b", organization_id: "org-b", campaign_id: "camp-b" },
      evidence: [],
      evaluations: [],
    });
    await expect(getScanDetail(supabase, "org-a", "scan-b")).rejects.toThrow();
  });
});
