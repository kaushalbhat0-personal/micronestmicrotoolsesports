import { describe, expect, it } from "vitest";
import { getScanDetail } from "./scan-detail";

/**
 * Faithful mock that mirrors real repository projections:
 * - listEvidenceByScan selects id, organization_id, campaign_id, deliverable_id, scan_id, ...
 *   and filters WHERE scan_id = val
 * - listEvaluationsByScan selects id, organization_id, scan_id, ...
 * If projection omitted organization_id/scan_id, in-memory filter would fail — this mock
 * now returns those columns so tenant/scan_id filtering is testable.
 */
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
            // Faithful: repo now projects organization_id, campaign_id, scan_id; mock filters by scan_id only
            // but returns rows that include those columns (DB would have them).
            eq: (_col: string, val: string) => ({
              // _col expected "scan_id" — filter evidence by scan_id
              order: () => Promise.resolve({ data: opts.evidence.filter((e) => e.scan_id === val), error: null } as never),
            }),
            // Support .in for history tests via same mock (not used here)
            in: () => Promise.resolve({ data: opts.evidence, error: null } as never),
          }),
        } as never;
      }
      if (table === "evaluations") {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              order: () => Promise.resolve({ data: opts.evaluations.filter((e) => e.scan_id === val), error: null } as never),
              // chain for .eq("organization_id").in() in scan-history: handle second eq
              in: () => Promise.resolve({ data: opts.evaluations.filter((e) => e.scan_id === val), error: null } as never),
            }),
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

describe("getScanDetail - per-scan attribution (PROOF-08)", () => {
  it("correct scan lookup — Proof 1 Result PASS for valid scan", async () => {
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-1", organization_id: "org-a", campaign_id: "camp-1" },
      evidence: [{ id: "ev-1", scan_id: "scan-1", organization_id: "org-a", campaign_id: "camp-1", deliverable_id: "del-1" }],
      evaluations: [{ id: "eval-1", scan_id: "scan-1", organization_id: "org-a", result: "PASS", deliverable_id: "del-1" }],
    });
    const detail = await getScanDetail(supabase, "org-a", "scan-1");
    expect(detail.scan.id).toBe("scan-1");
    expect(detail.evidence.length).toBe(1);
    expect(detail.evaluations.length).toBe(1);
    expect(detail.evaluationSummary["PASS"]).toBe(1);
  });

  it("organization isolation: org A cannot see org B scan", async () => {
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-1", organization_id: "org-b", campaign_id: "camp-1" },
      evidence: [],
      evaluations: [],
    });
    await expect(getScanDetail(supabase, "org-a", "scan-1")).rejects.toThrow(/not found/i);
  });

  it("tenant isolation on evidence: cross-org evidence not counted", async () => {
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-1", organization_id: "org-a", campaign_id: "camp-1" },
      // evidence has matching scan_id but different organization — must be filtered out
      evidence: [{ id: "ev-evil", scan_id: "scan-1", organization_id: "org-b", campaign_id: "camp-1", deliverable_id: "del-1" }],
      evaluations: [{ id: "eval-evil", scan_id: "scan-1", organization_id: "org-b", result: "PASS", deliverable_id: "del-1" }],
    });
    const detail = await getScanDetail(supabase, "org-a", "scan-1");
    expect(detail.evidence.length).toBe(0);
    expect(detail.evaluations.length).toBe(0);
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
    expect(detail.evidence.some((e) => e.id === "ev-no-scan")).toBe(false);
  });

  it("NULL scan_id is not attributed to arbitrary Check", async () => {
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-target", organization_id: "org-a", campaign_id: "camp-1" },
      evidence: [
        { id: "ev-null-1", scan_id: null, organization_id: "org-a", campaign_id: "camp-1", deliverable_id: "del-1" },
        { id: "ev-null-2", scan_id: null, organization_id: "org-a", campaign_id: "camp-1", deliverable_id: "del-1" },
      ],
      evaluations: [{ id: "eval-null", scan_id: null, organization_id: "org-a", result: "PASS", deliverable_id: "del-1" }],
    });
    const detail = await getScanDetail(supabase, "org-a", "scan-target");
    expect(detail.evidence.length).toBe(0);
    expect(detail.evaluations.length).toBe(0);
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

  it("scan_id scoping: evidence with same campaign but different scan_id excluded", async () => {
    // Regression for production bug: campaign-level leakage must not happen
    const supabase = makeSupabaseMockDetailed({
      scan: { id: "scan-1", organization_id: "org-a", campaign_id: "camp-1" },
      evidence: [
        { id: "ev-1", scan_id: "scan-1", organization_id: "org-a", campaign_id: "camp-1", deliverable_id: "del-1" },
        { id: "ev-2", scan_id: "scan-2", organization_id: "org-a", campaign_id: "camp-1", deliverable_id: "del-1" },
      ],
      evaluations: [
        { id: "eval-1", scan_id: "scan-1", organization_id: "org-a", result: "PASS", deliverable_id: "del-1" },
        { id: "eval-2", scan_id: "scan-2", organization_id: "org-a", result: "PASS", deliverable_id: "del-1" },
      ],
    });
    const d1 = await getScanDetail(supabase, "org-a", "scan-1");
    expect(d1.evidence.length).toBe(1);
    expect(d1.evidence[0]!.id).toBe("ev-1");
    expect(d1.evaluations.length).toBe(1);
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

  it("production regression: GautBLs9_vc proof counted for correct scan", async () => {
    // Simulates Historical Proof Test - Nov 2025 production case
    const scanId = "5cba5034-44be-4f99-8699-349c403752ea";
    const supabase = makeSupabaseMockDetailed({
      scan: { id: scanId, organization_id: "org-mystic", campaign_id: "f00c9bd0-a23a-43fb-ad66-5e200844803d" },
      evidence: [
        {
          id: "ev-gaut",
          scan_id: scanId,
          organization_id: "org-mystic",
          campaign_id: "f00c9bd0-a23a-43fb-ad66-5e200844803d",
          deliverable_id: "del-1",
        },
      ],
      evaluations: [{ id: "eval-gaut", scan_id: scanId, organization_id: "org-mystic", result: "PASS", deliverable_id: "del-1" }],
      campaignName: "Historical Proof Test - Nov 2025",
    });
    const detail = await getScanDetail(supabase, "org-mystic", scanId);
    expect(detail.evidence.length).toBe(1);
    expect(detail.evaluations.length).toBe(1);
    expect(detail.evaluationSummary["PASS"]).toBe(1);
  });
});
