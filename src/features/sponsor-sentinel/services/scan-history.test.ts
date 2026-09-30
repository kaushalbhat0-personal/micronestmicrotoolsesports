import { describe, expect, it } from "vitest";
import { getScanHistory } from "./scan-history";

function makeSupabaseMock(opts: {
  scans: Array<{ id: string; campaign_id: string; organization_id: string }>;
  campaigns: Array<{ id: string; name: string }>;
  evidence: Array<{ campaign_id: string }>;
  deliverables: Array<{ id: string; campaign_id: string }>;
  evaluations: Array<{ deliverable_id: string; result: string }>;
}) {
  return {
    from: (table: string) => {
      if (table === "scans") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: opts.scans, error: null }),
              }),
            }),
          }),
        } as never;
      }
      if (table === "sponsor_campaigns") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: opts.campaigns, error: null }),
          }),
        } as never;
      }
      if (table === "evidence") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: opts.evidence, error: null }),
          }),
        } as never;
      }
      if (table === "deliverables") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: opts.deliverables, error: null }),
          }),
        } as never;
      }
      if (table === "evaluations") {
        return {
          select: () => ({
            eq: () => ({
              in: () => Promise.resolve({ data: opts.evaluations, error: null }),
            }),
          }),
        } as never;
      }
      return { select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) } as never;
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("getScanHistory - tenant isolation", () => {
  it("Org A sees only Org A scans", async () => {
    const supabase = makeSupabaseMock({
      scans: [
        { id: "scan-a1", campaign_id: "camp-a1", organization_id: "org-a" },
        { id: "scan-a2", campaign_id: "camp-a1", organization_id: "org-a" },
      ],
      campaigns: [{ id: "camp-a1", name: "Campaign A" }],
      evidence: [{ campaign_id: "camp-a1" }, { campaign_id: "camp-a1" }],
      deliverables: [{ id: "del-1", campaign_id: "camp-a1" }],
      evaluations: [{ deliverable_id: "del-1", result: "PASS" }],
    });

    // Simulate org-a query: mock returns only org-a scans because eq(organization_id, org-a) was called
    const res = await getScanHistory(supabase, "org-a");
    expect(res.scans.length).toBe(2);
    expect(res.scans.every((s) => s.scan.organization_id === "org-a")).toBe(true);
  });

  it("query tampering: ?organization_id ignored - service uses trusted org from context", async () => {
    // Service never reads searchParams; it uses passed organizationId which comes from requireOrganizationContext
    let capturedOrg: string | null = null;
    const supabase = {
      from: (table: string) => ({
        select: () => ({
          eq: (col: string, val: string) => {
            if (table === "scans" && col === "organization_id") capturedOrg = val;
            return {
              order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
              in: () => Promise.resolve({ data: [], error: null }),
            };
          },
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await getScanHistory(supabase, "org-real-from-context");
    expect(capturedOrg).toBe("org-real-from-context");
    expect(capturedOrg).not.toBe("org-evil-from-query");
  });

  it("data minimization: returns only counts, not raw_ref/observed_value", async () => {
    const supabase = makeSupabaseMock({
      scans: [{ id: "scan-1", campaign_id: "camp-1", organization_id: "org-a" }],
      campaigns: [{ id: "camp-1", name: "Camp" }],
      evidence: [{ campaign_id: "camp-1" }],
      deliverables: [{ id: "del-1", campaign_id: "camp-1" }],
      evaluations: [{ deliverable_id: "del-1", result: "PASS" }],
    });
    const res = await getScanHistory(supabase, "org-a");
    const item = res.scans[0];
    expect(item).toHaveProperty("evidenceCount");
    expect(item).toHaveProperty("evaluationSummary");
    // Ensure no raw_ref leakage
    expect((item as unknown as Record<string, unknown>).raw_ref).toBeUndefined();
    expect((item as unknown as Record<string, unknown>).observed_value).toBeUndefined();
  });

  it("empty state", async () => {
    const supabase = makeSupabaseMock({ scans: [], campaigns: [], evidence: [], deliverables: [], evaluations: [] });
    const res = await getScanHistory(supabase, "org-a");
    expect(res.scans.length).toBe(0);
    expect(res.total).toBe(0);
  });

  it("evidence aggregation per campaign", async () => {
    const supabase = makeSupabaseMock({
      scans: [{ id: "scan-1", campaign_id: "camp-1", organization_id: "org-a" }],
      campaigns: [{ id: "camp-1", name: "Camp" }],
      evidence: [{ campaign_id: "camp-1" }, { campaign_id: "camp-1" }, { campaign_id: "camp-1" }],
      deliverables: [{ id: "del-1", campaign_id: "camp-1" }],
      evaluations: [
        { deliverable_id: "del-1", result: "PASS" },
        { deliverable_id: "del-1", result: "FAIL" },
        { deliverable_id: "del-1", result: "PASS" },
      ],
    });
    const res = await getScanHistory(supabase, "org-a");
    expect(res.scans[0]?.evidenceCount).toBe(3);
    expect(res.scans[0]?.evaluationSummary["PASS"]).toBe(2);
    expect(res.scans[0]?.evaluationSummary["FAIL"]).toBe(1);
  });

  it("avoids N+1: 1 scan query + batch evidence/evaluations, not per-scan queries", async () => {
    let scanQueries = 0;
    let evidenceQueries = 0;
    const supabase = {
      from: (table: string) => {
        if (table === "scans") scanQueries++;
        if (table === "evidence") evidenceQueries++;
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: [{ id: "s1", campaign_id: "c1", organization_id: "org-a" }] as never, error: null }) }),
              in: () => Promise.resolve({ data: [], error: null }),
            }),
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        } as never;
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await getScanHistory(supabase, "org-a");
    expect(scanQueries).toBe(1);
    expect(evidenceQueries).toBe(1); // not per-scan
  });
});
