import { describe, expect, it } from "vitest";
import { getScanHistory } from "./scan-history";

/**
 * Mock that mirrors per-scan aggregation (PROOF-08 fix):
 * evidence table queried by .in("scan_id", scanIds) and returns scan_id
 * evaluations queried by .in("scan_id", scanIds) with organization_id filter
 */

function makeSupabaseMock(opts: {
  scans: Array<{ id: string; campaign_id: string; organization_id: string }>;
  campaigns: Array<{ id: string; name: string }>;
  evidence: Array<{ scan_id: string | null; campaign_id?: string }>;
  evaluations: Array<{ scan_id: string | null; result: string; deliverable_id?: string }>;
}) {
  return {
    from: (table: string) => {
      if (table === "scans") {
        return {
          select: (..._args: unknown[]) => ({
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
          select: (..._args: unknown[]) => ({
            eq: (_col: string, _val: string) => ({
              in: (_c2: string, vals: string[]) =>
                Promise.resolve({
                  data: opts.evidence.filter((e) => e.scan_id !== null && vals.includes(e.scan_id as string)),
                  error: null,
                }),
            }),
            in: (_col: string, vals: string[]) =>
              Promise.resolve({
                data: opts.evidence.filter((e) => e.scan_id !== null && vals.includes(e.scan_id as string)),
                error: null,
              }),
          }),
        } as never;
      }
      if (table === "deliverables") {
        // Not used in new scan_history (per-scan), but keep for backward compat if called
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        } as never;
      }
      if (table === "evaluations") {
        return {
          select: (..._args: unknown[]) => ({
            eq: (_col: string, _val: string) => ({
              in: (_c2: string, vals: string[]) =>
                Promise.resolve({
                  data: opts.evaluations.filter((e) => e.scan_id !== null && vals.includes(e.scan_id as string)),
                  error: null,
                }),
            }),
            // also support direct .in without eq for flexibility
            in: (_col: string, vals: string[]) =>
              Promise.resolve({
                data: opts.evaluations.filter((e) => e.scan_id !== null && vals.includes(e.scan_id as string)),
                error: null,
              }),
          }),
        } as never;
      }
      return { select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) } as never;
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("getScanHistory - per-scan attribution (PROOF-08)", () => {
  it("Org A sees only Org A scans", async () => {
    const supabase = makeSupabaseMock({
      scans: [
        { id: "scan-a1", campaign_id: "camp-a1", organization_id: "org-a" },
        { id: "scan-a2", campaign_id: "camp-a1", organization_id: "org-a" },
      ],
      campaigns: [{ id: "camp-a1", name: "Campaign A" }],
      evidence: [{ scan_id: "scan-a1" }, { scan_id: "scan-a2" }],
      evaluations: [{ scan_id: "scan-a1", result: "PASS" }],
    });
    const res = await getScanHistory(supabase, "org-a");
    expect(res.scans.length).toBe(2);
    expect(res.scans.every((s) => s.scan.organization_id === "org-a")).toBe(true);
  });

  it("query tampering: ?organization_id ignored - service uses trusted org from context", async () => {
    let capturedOrg: string | null = null;
    const supabase = {
      from: (table: string) => ({
        select: (..._args: unknown[]) => ({
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
      evidence: [{ scan_id: "scan-1" }],
      evaluations: [{ scan_id: "scan-1", result: "PASS" }],
    });
    const res = await getScanHistory(supabase, "org-a");
    const item = res.scans[0]!;
    expect(item).toHaveProperty("evidenceCount");
    expect(item).toHaveProperty("evaluationSummary");
    expect((item as unknown as Record<string, unknown>).raw_ref).toBeUndefined();
    expect((item as unknown as Record<string, unknown>).observed_value).toBeUndefined();
  });

  it("empty state", async () => {
    const supabase = makeSupabaseMock({ scans: [], campaigns: [], evidence: [], evaluations: [] });
    const res = await getScanHistory(supabase, "org-a");
    expect(res.scans.length).toBe(0);
    expect(res.total).toBe(0);
  });

  it("per-scan evidence count: independent counts for multiple scans in same campaign", async () => {
    const supabase = makeSupabaseMock({
      scans: [
        { id: "scan-1", campaign_id: "camp-1", organization_id: "org-a" },
        { id: "scan-2", campaign_id: "camp-1", organization_id: "org-a" },
      ],
      campaigns: [{ id: "camp-1", name: "Camp" }],
      evidence: [{ scan_id: "scan-1" }, { scan_id: "scan-1" }, { scan_id: "scan-2" }],
      evaluations: [
        { scan_id: "scan-1", result: "PASS" },
        { scan_id: "scan-1", result: "FAIL" },
      ],
    });
    const res = await getScanHistory(supabase, "org-a");
    const s1 = res.scans.find((s) => s.scan.id === "scan-1")!;
    const s2 = res.scans.find((s) => s.scan.id === "scan-2")!;
    expect(s1.evidenceCount).toBe(2);
    expect(s2.evidenceCount).toBe(1);
    expect(s1.evaluationSummary["PASS"]).toBe(1);
    expect(s1.evaluationSummary["FAIL"]).toBe(1);
    expect(Object.keys(s2.evaluationSummary).length).toBe(0);
  });

  it("NULL scan_id is not attributed to any scan", async () => {
    const supabase = makeSupabaseMock({
      scans: [{ id: "scan-1", campaign_id: "camp-1", organization_id: "org-a" }],
      campaigns: [{ id: "camp-1", name: "Camp" }],
      evidence: [{ scan_id: null }],
      evaluations: [{ scan_id: null, result: "PASS" }],
    });
    const res = await getScanHistory(supabase, "org-a");
    expect(res.scans[0]!.evidenceCount).toBe(0);
    expect(Object.keys(res.scans[0]!.evaluationSummary).length).toBe(0);
  });

  it("per-scan aggregation: same campaign, only scan-2 has proof -> scan-1 has 0", async () => {
    const supabase = makeSupabaseMock({
      scans: [
        { id: "scan-1", campaign_id: "camp-1", organization_id: "org-a" },
        { id: "scan-2", campaign_id: "camp-1", organization_id: "org-a" },
      ],
      campaigns: [{ id: "camp-1", name: "Camp" }],
      evidence: [{ scan_id: "scan-2" }],
      evaluations: [{ scan_id: "scan-2", result: "PASS" }],
    });
    const res = await getScanHistory(supabase, "org-a");
    expect(res.scans.find((s) => s.scan.id === "scan-1")!.evidenceCount).toBe(0);
    expect(res.scans.find((s) => s.scan.id === "scan-2")!.evidenceCount).toBe(1);
    expect(res.scans.find((s) => s.scan.id === "scan-1")!.evaluationSummary["PASS"]).toBeUndefined();
    expect(res.scans.find((s) => s.scan.id === "scan-2")!.evaluationSummary["PASS"]).toBe(1);
  });

  it("avoids N+1: 1 scan page query + 1 count query + 1 evidence batch + 1 evaluation batch, not per-scan queries", async () => {
    let scanQueries = 0;
    let evidenceQueries = 0;
    let evaluationQueries = 0;
    const supabase = {
      from: (table: string) => {
        if (table === "scans") scanQueries++;
        if (table === "evidence") evidenceQueries++;
        if (table === "evaluations") evaluationQueries++;
        return {
          select: (..._args: unknown[]) => ({
            eq: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: [{ id: "s1", campaign_id: "c1", organization_id: "org-a" }] as never, error: null }) }),
              in: () => Promise.resolve({ data: [], error: null }),
            }),
            in: (_c: string, _v: unknown) => Promise.resolve({ data: [], error: null }),
          }),
        } as never;
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    await getScanHistory(supabase, "org-a");
    expect(scanQueries).toBe(2); // page + exact total (both single batched queries)
    expect(evidenceQueries).toBe(1); // not per-scan
    expect(evaluationQueries).toBe(1);
  });

  it("evidence batch explicitly filters by trusted organization_id (P2 hardening)", async () => {
    const captured: Array<{ table: string; col: string; val: string }> = [];
    const supabase = {
      from: (table: string) => ({
        select: (..._args: unknown[]) => ({
          eq: (col: string, val: string) => {
            captured.push({ table, col, val });
            return {
              order: () => ({ limit: () => Promise.resolve({ data: [{ id: "s1", campaign_id: "c1", organization_id: "org-trusted" }] as never, error: null }) }),
              in: () => Promise.resolve({ data: [], error: null }),
            };
          },
          in: () => Promise.resolve({ data: [], error: null }),
          order: () => ({ limit: () => Promise.resolve({ data: [{ id: "s1", campaign_id: "c1", organization_id: "org-trusted" }] as never, error: null }) }),
        }),
      }),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    await getScanHistory(supabase, "org-trusted");
    // evidence query should have eq organization_id = org-trusted
    expect(captured.some((c) => c.table === "evidence" && c.col === "organization_id" && c.val === "org-trusted")).toBe(true);
    // evaluations already had it
    expect(captured.some((c) => c.table === "evaluations" && c.col === "organization_id" && c.val === "org-trusted")).toBe(true);
  });

  it("total is the true org-wide count, not the page length", async () => {
    const supabase = {
      from: (table: string) => ({
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => ({
          eq: () => {
            if (opts?.head) return Promise.resolve({ data: [], count: 120, error: null });
            return {
              order: () => ({ limit: () => Promise.resolve({ data: [{ id: "s1", campaign_id: "c1", organization_id: "org-a" }], error: null }) }),
              in: () => Promise.resolve({ data: [], error: null }),
            };
          },
          in: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const res = await getScanHistory(supabase, "org-a");
    expect(res.scans.length).toBe(1);
    expect(res.total).toBe(120);
  });

  it("total falls back to page length when the count is unavailable", async () => {
    const supabase = makeSupabaseMock({
      scans: [{ id: "scan-1", campaign_id: "camp-1", organization_id: "org-a" }],
      campaigns: [{ id: "camp-1", name: "Camp" }],
      evidence: [],
      evaluations: [],
    });
    const res = await getScanHistory(supabase, "org-a");
    expect(res.scans.length).toBe(1);
    expect(res.total).toBe(1);
  });
});
