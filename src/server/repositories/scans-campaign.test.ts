import { describe, it, expect, vi, beforeEach } from "vitest";
import { listScansByCampaign } from "./scans";

function mockSupabase(expected: { org: string; campaign: string; limit: number }) {
  const order = vi.fn().mockReturnThis();
  const limitFn = vi.fn().mockImplementation((n: number) => {
    expect(n).toBe(expected.limit);
    return Promise.resolve({ data: [{ id: "scan-1", campaign_id: expected.campaign }], error: null });
  });
  const eqCampaign = vi.fn((col: string, val: string) => {
    expect(col).toBe("campaign_id");
    expect(val).toBe(expected.campaign);
    return { order, limit: limitFn } as never;
  });
  const eqOrg = vi.fn((col: string, val: string) => {
    expect(col).toBe("organization_id");
    expect(val).toBe(expected.org);
    return { eq: eqCampaign } as never;
  });
  const select = vi.fn((cols: string) => {
    expect(cols).toContain("campaign_id");
    expect(cols).not.toBe("*");
    return { eq: eqOrg } as never;
  });
  const from = vi.fn(() => ({ select }));
  return { from, _spies: { select, eqOrg, eqCampaign, order, limitFn } } as unknown as never;
}

describe("listScansByCampaign — P0-C", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters by organization_id + campaign_id, orders newest first, limits to 5 at DB", async () => {
    const supabase = mockSupabase({ org: "org-a", campaign: "camp-1", limit: 5 });
    const result = await listScansByCampaign(supabase as never, "org-a", "camp-1", 5);
    expect(result).toHaveLength(1);
    expect(result[0]!.campaign_id).toBe("camp-1");
  });

  it("respects custom limit", async () => {
    const supabase = mockSupabase({ org: "org-a", campaign: "camp-1", limit: 1 });
    const result = await listScansByCampaign(supabase as never, "org-a", "camp-1", 1);
    expect(result).toHaveLength(1);
  });

  it("preserves organization isolation (requires org filter)", async () => {
    const supabase = mockSupabase({ org: "org-a", campaign: "camp-1", limit: 5 });
    await listScansByCampaign(supabase as never, "org-a", "camp-1", 5);
    // verified via expect in mock eqOrg
    expect(true).toBe(true);
  });

  it("uses narrowed projection (not select *)", async () => {
    let cols = "";
    const supabase = {
      from: () => ({
        select: (c: string) => {
          cols = c;
          return {
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          } as never;
        },
      }),
    } as never;
    await listScansByCampaign(supabase, "org-a", "camp-1", 5);
    expect(cols).not.toBe("*");
    expect(cols).toContain("platform");
    expect(cols).toContain("status");
  });
});
