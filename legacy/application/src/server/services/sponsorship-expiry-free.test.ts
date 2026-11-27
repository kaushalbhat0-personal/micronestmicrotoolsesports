import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * FINDING-2 acceptance (FIX-06): expired paid Sponsorship resolves logically
 * to Free — without mutating rows, without a second free row, without a cron.
 * Mocked Supabase at the query boundary; real-Postgres parity for the
 * reservation path lives in consume-free-check.integration.test.ts.
 */

const TOOL_ID = "tool-sponsor-id";
const FUTURE = new Date(Date.now() + 86400000 * 30).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

type Row = Record<string, unknown>;

interface Fixture {
  organization_members?: Row[];
  organizations?: Row[];
  tools?: Row[];
  tool_entitlements?: Row[];
  user_tool_entitlements?: Row[];
  rpcAccess?: boolean | null;
}

function makeClient(fx: Fixture) {
  const tables: Record<string, Row[]> = {
    organization_members: fx.organization_members ?? [],
    organizations: fx.organizations ?? [],
    tools: fx.tools ?? [{ id: TOOL_ID, slug: "sponsor-sentinel", is_active: true }],
    tool_entitlements: fx.tool_entitlements ?? [],
    user_tool_entitlements: fx.user_tool_entitlements ?? [],
  };
  const rpc = vi.fn(async () => ({ data: fx.rpcAccess ?? null, error: null }));
  function builder(table: string) {
    const rows = tables[table] ?? [];
    const filters: Array<(r: Row) => boolean> = [];
    const chain: Record<string, (...args: never[]) => unknown> = {};
    const self = new Proxy(chain, {
      get(_t, prop: string) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => {
            resolve({ data: rows.filter((r) => filters.every((f) => f(r))), error: null });
          };
        }
        if (prop === "single" || prop === "maybeSingle") {
          return async () => {
            const out = rows.filter((r) => filters.every((f) => f(r)));
            return { data: out[0] ?? null, error: null };
          };
        }
        if (prop === "select") return () => self;
        if (prop === "eq") {
          return (col: string, val: unknown) => {
            filters.push((r) => r[col] === val);
            return self;
          };
        }
        if (prop === "in") {
          return (col: string, vals: unknown[]) => {
            filters.push((r) => (vals as unknown[]).includes(r[col]));
            return self;
          };
        }
        if (prop === "order" || prop === "limit" || prop === "gte") return () => self;
        return () => self;
      },
    });
    return self;
  }
  const from = vi.fn((table: string) => builder(table));
  return { from, rpc } as unknown as SupabaseClient;
}

const U1 = "user-1";
const ORG = "org-a";
const member = (userId = U1, orgId = ORG, role = "member") => ({ id: `m-${userId}`, organization_id: orgId, user_id: userId, role });
const grant = (source: string, expires_at: string | null, userId = U1) => ({ id: `g-${source}`, user_id: userId, tool_id: TOOL_ID, source, expires_at });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FINDING-2: expired paid → free (org branch)", () => {
  it.each([["subscription"], ["manual"], ["promo"]])("1-3. expired %s grant → free", async (source) => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient({ organization_members: [member()], user_tool_entitlements: [grant(source, PAST)] });
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG })).toBe("free");
  });

  it("4. valid paid grant → paid", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient({ organization_members: [member()], user_tool_entitlements: [grant("subscription", FUTURE)] });
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG })).toBe("paid");
  });

  it("5. valid free grant → free", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient({ organization_members: [member()], user_tool_entitlements: [grant("free", null)] });
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG })).toBe("free");
  });

  it("6. no grant → none", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient({ organization_members: [member()] });
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG })).toBe("none");
  });

  it("7. expired paid + no membership → none (membership stays first)", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient({ user_tool_entitlements: [grant("subscription", PAST)] });
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG })).toBe("none");
  });

  it("9/10. org branch and no-org branch agree on expired paid → free", async () => {
    const { resolveSponsorshipLimits } = await import("./sponsorship-limits");
    const fx: Fixture = { organization_members: [member()], user_tool_entitlements: [grant("manual", PAST)] };
    const withOrg = await resolveSponsorshipLimits(makeClient(fx), { userId: U1, organizationId: ORG });
    const withoutOrg = await resolveSponsorshipLimits(makeClient(fx), { userId: U1 });
    expect(withOrg.level).toBe("free");
    expect(withoutOrg.level).toBe("free");
    expect(withOrg.monthlyCheckLimit).toBe(withoutOrg.monthlyCheckLimit);
    expect(withOrg.historyWindowDays).toBe(withoutOrg.historyWindowDays);
    expect(withOrg.exportAllowed).toBe(false);
  });

  it("expired grant of unknown source → none (fail closed, no invention)", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient({ organization_members: [member()], user_tool_entitlements: [grant("legacy", PAST)] });
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG })).toBe("none");
  });
});

describe("FINDING-2: background principal prefers valid free, falls back to expired paid", () => {
  it("11. valid free owner preferred over expired-paid owner", async () => {
    const { resolveOrgCheckPrincipal } = await import("./sponsorship-limits");
    const c = makeClient({
      organizations: [{ id: ORG, owner_id: "owner-a" }],
      organization_members: [
        { id: "m1", organization_id: ORG, user_id: "owner-a", role: "owner" },
        { id: "m2", organization_id: ORG, user_id: "owner-b", role: "owner" },
      ],
      user_tool_entitlements: [grant("free", null, "owner-a"), grant("subscription", PAST, "owner-b")],
    });
    expect(await resolveOrgCheckPrincipal(c, ORG)).toEqual({ level: "free", userId: "owner-a" });
  });

  it("12. expired-paid owner serves as free principal when no valid free owner exists", async () => {
    const { resolveOrgCheckPrincipal } = await import("./sponsorship-limits");
    const c = makeClient({
      organizations: [{ id: ORG, owner_id: "owner-b" }],
      organization_members: [{ id: "m2", organization_id: ORG, user_id: "owner-b", role: "owner" }],
      user_tool_entitlements: [grant("promo", PAST, "owner-b")],
    });
    expect(await resolveOrgCheckPrincipal(c, ORG)).toEqual({ level: "free", userId: "owner-b" });
  });

  it("owner with no grant at all → none (never invents coverage)", async () => {
    const { resolveOrgCheckPrincipal } = await import("./sponsorship-limits");
    const c = makeClient({
      organizations: [{ id: ORG, owner_id: "owner-b" }],
      organization_members: [{ id: "m2", organization_id: ORG, user_id: "owner-b", role: "owner" }],
    });
    expect(await resolveOrgCheckPrincipal(c, ORG)).toEqual({ level: "none", userId: null });
  });
});

describe("FINDING-2: no row mutation on expiry", () => {
  it("15. valid paid rows are never converted by the resolver (read-only decision)", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const rows = [grant("subscription", FUTURE)];
    const c = makeClient({ organization_members: [member()], user_tool_entitlements: rows });
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG })).toBe("paid");
    expect(rows[0]).toMatchObject({ source: "subscription", expires_at: FUTURE });
  });

  it("16. grandfathered manual lifetime stays paid and unlimited", async () => {
    const { resolveSponsorshipLimits } = await import("./sponsorship-limits");
    const c = makeClient({ organization_members: [member()], user_tool_entitlements: [grant("manual", null)] });
    const limits = await resolveSponsorshipLimits(c, { userId: U1, organizationId: ORG });
    expect(limits.level).toBe("paid");
    expect(limits.monthlyCheckLimit).toBeNull();
    expect(limits.exportAllowed).toBe(true);
  });

  it("14. no-row user still resolves none (claim flow remains their path)", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient({
      organization_members: [member()],
      tool_entitlements: [],
    });
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG })).toBe("none");
  });
});
