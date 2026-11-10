import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Free-tier acceptance suite (RCCF free-tier IMPLEMENT-03).
 * Covers: level resolution, global quotas, checks, history, export,
 * upgrade/expiry semantics, grandfathering, All Access, cross-org security,
 * and the concurrency edge — against mocked Supabase at the query boundary.
 */

const TOOL_ID = "tool-sponsor-id";
const FUTURE = new Date(Date.now() + 86400000 * 30).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}
function isoDaysAhead(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

// ── Generic mock supabase: chainable query builder over in-memory rows ──

type Row = Record<string, unknown>;

interface Fixture {
  tools?: Row[];
  organization_members?: Row[];
  organizations?: Row[];
  tool_entitlements?: Row[];
  user_tool_entitlements?: Row[];
  sponsor_campaigns?: Row[];
  connected_channels?: Row[];
  scans?: Row[];
  rpcAccess?: boolean | null;
}

function makeClient(fx: Fixture) {
  const tables: Record<string, Row[]> = {
    tools: fx.tools ?? [{ id: TOOL_ID, slug: "sponsor-sentinel", is_active: true }],
    organization_members: fx.organization_members ?? [],
    organizations: fx.organizations ?? [],
    tool_entitlements: fx.tool_entitlements ?? [],
    user_tool_entitlements: fx.user_tool_entitlements ?? [],
    sponsor_campaigns: fx.sponsor_campaigns ?? [],
    connected_channels: fx.connected_channels ?? [],
    scans: fx.scans ?? [],
  };

  const rpc = vi.fn(async () => ({ data: fx.rpcAccess ?? null, error: null }));

  function builder(table: string) {
    const rows = tables[table] ?? [];
    const filters: Array<(r: Row) => boolean> = [];
    let orderKey: string | null = null;
    let orderAsc = true;
    let limitN: number | null = null;

    const chain: Record<string, (...args: never[]) => unknown> = {};
    const self = new Proxy(chain, {
      get(target, prop: string) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => {
            let out = rows.filter((r) => filters.every((f) => f(r)));
            if (orderKey) {
              out = [...out].sort((a, b) => {
                const av = a[orderKey as string];
                const bv = b[orderKey as string];
                if (av === bv) return 0;
                if (av === undefined || av === null) return 1;
                if (bv === undefined || bv === null) return -1;
                if (av < bv) return orderAsc ? -1 : 1;
                return orderAsc ? 1 : -1;
              });
            }
            if (limitN !== null) out = out.slice(0, limitN);
            resolve({ data: out, error: null, count: out.length });
          };
        }
        if (prop === "single" || prop === "maybeSingle") {
          return async () => {
            const out = rows.filter((r) => filters.every((f) => f(r)));
            return { data: out[0] ?? null, error: null };
          };
        }
        if (prop === "insert" || prop === "upsert" || prop === "update") {
          return (...args: unknown[]) => {
            if (prop !== "update") {
              const payload = args[0] as Row | Row[];
              const list = Array.isArray(payload) ? payload : [payload];
              for (const row of list) {
                if (prop === "upsert") {
                  const idx = (tables[table] ?? []).findIndex(
                    (r) => r.user_id === row.user_id && r.tool_id === row.tool_id,
                  );
                  if (idx >= 0) tables[table]![idx] = { ...tables[table]![idx], ...row };
                  else tables[table]!.push({ id: `id-${Date.now()}-${Math.random()}`, ...row });
                } else {
                  tables[table]!.push({ id: `id-${Date.now()}-${Math.random()}`, ...row });
                }
              }
            }
            return self;
          };
        }
        if (prop === "delete") return () => self;
        if (prop === "select") return (..._a: never[]) => self;
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
        if (prop === "gte") {
          return (col: string, val: string) => {
            filters.push((r) => typeof r[col] === "string" && (r[col] as string) >= val);
            return self;
          };
        }
        if (prop === "order") {
          return (col: string, opts?: { ascending?: boolean }) => {
            orderKey = col;
            orderAsc = opts?.ascending !== false;
            return self;
          };
        }
        if (prop === "limit") {
          return (n: number) => {
            limitN = n;
            return self;
          };
        }
        return (..._a: never[]) => self;
      },
    });
    return self;
  }

  const from = vi.fn((table: string) => builder(table));
  return { from, rpc, __tables: tables } as unknown as SupabaseClient & { __tables: Record<string, Row[]> };
}

function member(userId: string, orgId: string, role = "member"): Row {
  return { id: `m-${userId}-${orgId}`, organization_id: orgId, user_id: userId, role };
}
function campaign(orgId: string, status: string, createdDays = 0): Row {
  return {
    id: `camp-${orgId}-${status}-${Math.random().toString(36).slice(2, 8)}`,
    organization_id: orgId,
    status,
    created_at: isoDaysAgo(createdDays),
    starts_at: isoDaysAgo(10),
    ends_at: isoDaysAhead(10),
  };
}
function channel(orgId: string, status = "connected"): Row {
  return {
    id: `ch-${orgId}-${Math.random().toString(36).slice(2, 8)}`,
    organization_id: orgId,
    platform: "twitch",
    connection_status: status,
    created_at: isoDaysAgo(2),
  };
}
function scan(orgId: string, campId: string, startedAt: string, status = "success"): Row {
  return {
    id: `scan-${Math.random().toString(36).slice(2, 8)}`,
    organization_id: orgId,
    campaign_id: campId,
    platform: "twitch",
    status,
    started_at: startedAt,
    created_at: startedAt,
  };
}

const U1 = "user-1";
const ORG_A = "org-a";
const ORG_B = "org-b";
const ORG_C = "org-c";

function baseFx(over: Partial<Fixture> = {}): Fixture {
  return {
    organization_members: [member(U1, ORG_A)],
    organizations: [{ id: ORG_A, owner_id: U1 }],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("access level resolution", () => {
  it("none without membership — free grant never bypasses membership", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient(baseFx({ organization_members: [], user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }] }));
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG_A })).toBe("none");
  });

  it("paid via org grant (rpc) even with no user grant", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient(baseFx({ rpcAccess: true }));
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG_A })).toBe("paid");
  });

  it("paid via All Access org row (fallback query, no rpc)", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient(
      baseFx({ rpcAccess: null, tool_entitlements: [{ organization_id: ORG_A, is_all_access: true, tool_id: null, expires_at: null }] }),
    );
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG_A })).toBe("paid");
  });

  it.each(["subscription", "manual", "promo"])(`paid via user grant source=%s (grandfathered never free)`, async (source) => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient(baseFx({ user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source, expires_at: null }] }));
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG_A })).toBe("paid");
  });

  it("free via user grant source=free", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient(baseFx({ user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }] }));
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG_A })).toBe("free");
  });

  it("expired free-era paid grant reverts to free (paid expiry → free)", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient(baseFx({ user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "subscription", expires_at: PAST }] }));
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG_A })).toBe("free");
  });

  it("no grant at all → none", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient(baseFx({}));
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG_A })).toBe("none");
  });

  it("limits: paid unlimited + export; free quotas + no export", async () => {
    const { resolveSponsorshipLimits, FREE_MONTHLY_CHECK_LIMIT, FREE_HISTORY_WINDOW_DAYS } = await import("./sponsorship-limits");
    const paid = makeClient(baseFx({ rpcAccess: true }));
    const pl = await resolveSponsorshipLimits(paid, { userId: U1, organizationId: ORG_A });
    expect(pl).toMatchObject({ level: "paid", campaignActiveLimit: null, channelConnectedLimit: null, monthlyCheckLimit: null, historyWindowDays: null, exportAllowed: true });
    const free = makeClient(baseFx({ user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }] }));
    const fl = await resolveSponsorshipLimits(free, { userId: U1, organizationId: ORG_A });
    expect(fl).toMatchObject({ level: "free", campaignActiveLimit: 1, draftLimit: 1, channelConnectedLimit: 1, monthlyCheckLimit: FREE_MONTHLY_CHECK_LIMIT, historyWindowDays: FREE_HISTORY_WINDOW_DAYS, exportAllowed: false });
  });
});

describe("campaign quotas (global)", () => {
  it("1 active succeeds; 2nd active fails", async () => {
    const { assertFreeCampaignActivateAllowed } = await import("./sponsorship-limits");
    const grant = [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }];
    const one = makeClient(baseFx({ user_tool_entitlements: grant, sponsor_campaigns: [campaign(ORG_A, "active")] }));
    await expect(assertFreeCampaignActivateAllowed(one, { userId: U1, organizationId: ORG_A, campaignId: (one.__tables.sponsor_campaigns![0] as Row).id as string })).resolves.toBeUndefined();
    const two = makeClient(baseFx({ user_tool_entitlements: grant, sponsor_campaigns: [campaign(ORG_A, "active"), campaign(ORG_A, "active")] }));
    await expect(assertFreeCampaignActivateAllowed(two, { userId: U1, organizationId: ORG_A, campaignId: "other" })).rejects.toThrow(/free campaign/);
  });

  it("1 draft + 1 active succeeds; 2nd draft fails", async () => {
    const { assertFreeCampaignCreateAllowed } = await import("./sponsorship-limits");
    const grant = [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }];
    const ok = makeClient(baseFx({ user_tool_entitlements: grant, sponsor_campaigns: [campaign(ORG_A, "draft"), campaign(ORG_A, "active")] }));
    await expect(assertFreeCampaignCreateAllowed(ok, { userId: U1, organizationId: ORG_A })).rejects.toThrow(/free draft/);
    const none = makeClient(baseFx({ user_tool_entitlements: grant, sponsor_campaigns: [] }));
    await expect(assertFreeCampaignCreateAllowed(none, { userId: U1, organizationId: ORG_A })).resolves.toBeUndefined();
  });

  it("completed/archived do not occupy the slot", async () => {
    const { getFreeUsage } = await import("./sponsorship-limits");
    const c = makeClient(baseFx({ user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }], sponsor_campaigns: [campaign(ORG_A, "completed"), campaign(ORG_A, "archived")] }));
    const u = await getFreeUsage(c, U1);
    expect(u.activeCampaigns).toBe(0);
    expect(u.drafts).toBe(0);
  });

  it("three orgs share one global campaign slot", async () => {
    const { getFreeUsage, assertFreeCampaignCreateAllowed } = await import("./sponsorship-limits");
    const fx = baseFx({
      organization_members: [member(U1, ORG_A), member(U1, ORG_B), member(U1, ORG_C)],
      user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }],
      sponsor_campaigns: [campaign(ORG_A, "active")],
    });
    const c = makeClient(fx);
    const u = await getFreeUsage(c, U1);
    expect(u.orgIds.sort()).toEqual([ORG_A, ORG_B, ORG_C].sort());
    expect(u.activeCampaigns).toBe(1);
    await expect(assertFreeCampaignCreateAllowed(c, { userId: U1, organizationId: ORG_B })).resolves.toBeUndefined();
    const full = makeClient({ ...fx, sponsor_campaigns: [campaign(ORG_A, "active"), campaign(ORG_B, "draft")] });
    await expect(assertFreeCampaignCreateAllowed(full, { userId: U1, organizationId: ORG_C })).rejects.toThrow();
  });

  it("paid users unlimited campaigns", async () => {
    const { assertFreeCampaignCreateAllowed, assertFreeCampaignActivateAllowed } = await import("./sponsorship-limits");
    const c = makeClient(
      baseFx({
        user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "manual", expires_at: null }],
        sponsor_campaigns: [campaign(ORG_A, "active"), campaign(ORG_A, "active"), campaign(ORG_A, "draft"), campaign(ORG_A, "draft")],
      }),
    );
    await expect(assertFreeCampaignCreateAllowed(c, { userId: U1, organizationId: ORG_A })).resolves.toBeUndefined();
    await expect(assertFreeCampaignActivateAllowed(c, { userId: U1, organizationId: ORG_A, campaignId: "x" })).resolves.toBeUndefined();
  });
});

describe("channel quotas (global, connected only)", () => {
  it("one connected succeeds from empty; second fails regardless of platform/org", async () => {
    const { assertFreeChannelConnectAllowed } = await import("./sponsorship-limits");
    const grant = [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }];
    const empty = makeClient(baseFx({ user_tool_entitlements: grant, connected_channels: [] }));
    await expect(assertFreeChannelConnectAllowed(empty, { userId: U1, organizationId: ORG_A })).resolves.toBeUndefined();
    const one = makeClient(baseFx({ user_tool_entitlements: grant, connected_channels: [channel(ORG_A)] }));
    await expect(assertFreeChannelConnectAllowed(one, { userId: U1, organizationId: ORG_A })).rejects.toThrow(/free channel slot/);
    const crossOrg = makeClient(
      baseFx({
        organization_members: [member(U1, ORG_A), member(U1, ORG_B)],
        user_tool_entitlements: grant,
        connected_channels: [{ ...channel(ORG_A), platform: "youtube" }],
      }),
    );
    // one connected anywhere → a new connection in another org is blocked
    await expect(assertFreeChannelConnectAllowed(crossOrg, { userId: U1, organizationId: ORG_B })).rejects.toThrow(/free channel slot/);
  });

  it("disconnected/expired/revoked do not count; disconnect releases slot", async () => {
    const { getFreeUsage, assertFreeChannelConnectAllowed } = await import("./sponsorship-limits");
    const c = makeClient(
      baseFx({
        user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }],
        connected_channels: [channel(ORG_A, "disconnected"), channel(ORG_A, "expired"), channel(ORG_A, "revoked")],
      }),
    );
    const u = await getFreeUsage(c, U1);
    expect(u.connectedChannels).toBe(0);
    await expect(assertFreeChannelConnectAllowed(c, { userId: U1, organizationId: ORG_A })).resolves.toBeUndefined();
  });
});

describe("check quotas (10/month, shared)", () => {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  function scans(n: number, orgId = ORG_A, campId = "camp-1"): Row[] {
    return Array.from({ length: n }, (_, i) => scan(orgId, campId, new Date(Date.parse(monthStart) + (i + 1) * 3600000).toISOString()));
  }

  it("10 checks succeed; 11th fails", async () => {
    const { assertFreeCheckAllowed, hasFreeChecksRemaining } = await import("./sponsorship-limits");
    const grant = [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }];
    const nine = makeClient(baseFx({ user_tool_entitlements: grant, scans: scans(9) }));
    await expect(assertFreeCheckAllowed(nine, { userId: U1, organizationId: ORG_A })).resolves.toBeUndefined();
    expect(await hasFreeChecksRemaining(nine, U1)).toBe(true);
    const ten = makeClient(baseFx({ user_tool_entitlements: grant, scans: scans(10) }));
    await expect(assertFreeCheckAllowed(ten, { userId: U1, organizationId: ORG_A })).rejects.toThrow(/10 free checks/);
    expect(await hasFreeChecksRemaining(ten, U1)).toBe(false);
  });

  it("failed + partial scans count; last-month scans do not", async () => {
    const { getFreeUsage } = await import("./sponsorship-limits");
    const oldMonth = new Date(Date.parse(monthStart) - 86400000).toISOString();
    const c = makeClient(
      baseFx({
        user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }],
        scans: [scan(ORG_A, "c1", new Date(Date.parse(monthStart) + 3600000).toISOString(), "failed"), scan(ORG_A, "c1", new Date(Date.parse(monthStart) + 7200000).toISOString(), "partial"), scan(ORG_A, "c1", oldMonth, "success")],
      }),
    );
    const u = await getFreeUsage(c, U1);
    expect(u.checksUsedThisMonth).toBe(2);
  });

  it("All Access org scans excluded from free budget (recommended behavior)", async () => {
    const { getFreeUsage } = await import("./sponsorship-limits");
    const c = makeClient(
      baseFx({
        organization_members: [member(U1, ORG_A), member(U1, ORG_B)],
        user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }],
        tool_entitlements: [{ organization_id: ORG_A, is_all_access: true, tool_id: null, expires_at: null }],
        scans: [...scans(10, ORG_A), ...scans(3, ORG_B)],
      }),
    );
    const u = await getFreeUsage(c, U1);
    expect(u.checksUsedThisMonth).toBe(3);
  });

  it("concurrent slot: two racers, one winner (in-process mutex)", async () => {
    const { withFreeCheckSlot, __resetFreeCheckSlotsForTests } = await import("./sponsorship-limits");
    __resetFreeCheckSlotsForTests();
    let inside = 0;
    let maxInside = 0;
    const racer = () =>
      withFreeCheckSlot(U1, async () => {
        inside++;
        maxInside = Math.max(maxInside, inside);
        await new Promise((r) => setTimeout(r, 5));
        inside--;
        return true;
      });
    const [a, b] = await Promise.all([racer(), racer()]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(maxInside).toBe(1);
  });

  it("quota error kinds are machine-readable for cron/webhook skips", async () => {
    const { assertFreeCheckAllowed, isFreeQuotaError } = await import("./sponsorship-limits");
    const c = makeClient(baseFx({ user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }], scans: scans(10) }));
    try {
      await assertFreeCheckAllowed(c, { userId: U1, organizationId: ORG_A });
      expect.unreachable();
    } catch (e) {
      expect(isFreeQuotaError(e)).toBe("checks");
    }
  });
});

describe("history window + export", () => {
  it("free window is 7 days; paid is null (full retained history)", async () => {
    const { resolveSponsorshipLimits, historyCutoffIso, FREE_HISTORY_WINDOW_DAYS } = await import("./sponsorship-limits");
    expect(FREE_HISTORY_WINDOW_DAYS).toBe(7);
    const free = makeClient(baseFx({ user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }] }));
    expect((await resolveSponsorshipLimits(free, { userId: U1, organizationId: ORG_A })).historyWindowDays).toBe(7);
    const cutoff = Date.parse(historyCutoffIso(7));
    expect(Date.now() - cutoff - 7 * 86400000).toBeLessThan(5000);
  });

  it("export blocked for free with exact upgrade message; allowed for paid", async () => {
    const { assertExportAllowed, freeLimits, paidLimits } = await import("./sponsorship-limits");
    expect(() => assertExportAllowed(freeLimits())).toThrow("Export is available on Sponsorship Tracking. Upgrade to download and share proof reports.");
    expect(() => assertExportAllowed(paidLimits())).not.toThrow();
  });
});

describe("issuance + billing display + copy", () => {
  it("ensureFreeSponsorshipGrant never downgrades paid; re-issues after expiry", async () => {
    const mod = await import("./user-sponsorship-service");
    const paidClient = makeClient(baseFx({ user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "manual", expires_at: null }] }));
    const kept = await mod.ensureFreeSponsorshipGrant(paidClient as never, U1);
    expect(kept.source).toBe("manual");
    expect(paidClient.__tables.user_tool_entitlements!.length).toBe(1);

    const freshClient = makeClient(baseFx({}));
    const created = await mod.ensureFreeSponsorshipGrant(freshClient as never, U1);
    expect(created.source).toBe("free");
    expect(created.expires_at).toBeNull();

    const expiredClient = makeClient(baseFx({ user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "subscription", expires_at: PAST }] }));
    const reissued = await mod.ensureFreeSponsorshipGrant(expiredClient as never, U1);
    expect(reissued.source).toBe("free");
    expect(reissued.expires_at).toBeNull();
  });

  it("billing card marks free grants (isFree) without affecting paid cards", async () => {
    const { buildBillingToolSections } = await import("./billing-service");
    const tools = [{ id: TOOL_ID, slug: "sponsor-sentinel", is_active: true }];
    const plans: never[] = [];
    const free = buildBillingToolSections({ entitlements: [], plans, tools, userSponsorshipGrant: { expires_at: null, source: "free" } });
    const sponsorFree = free.yourTools.find((t) => t.toolSlug === "sponsor-sentinel");
    expect(sponsorFree?.viaUserGrant).toBe(true);
    expect(sponsorFree?.isFree).toBe(true);
    const paid = buildBillingToolSections({ entitlements: [], plans, tools, userSponsorshipGrant: { expires_at: FUTURE, source: "subscription" } });
    expect(paid.yourTools.find((t) => t.toolSlug === "sponsor-sentinel")?.isFree).not.toBe(true);
  });

  it("customer copy never uses the word trial; quotas are exact", async () => {
    const limits = await import("./sponsorship-limits");
    const messages: string[] = [];
    const grant = [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }];
    const full = makeClient(
      baseFx({
        user_tool_entitlements: grant,
        sponsor_campaigns: [campaign(ORG_A, "active"), campaign(ORG_A, "draft")],
        connected_channels: [channel(ORG_A)],
        scans: Array.from({ length: 10 }, () => scan(ORG_A, "c", new Date().toISOString())),
      }),
    );
    for (const fn of [
      () => limits.assertFreeCampaignCreateAllowed(full, { userId: U1, organizationId: ORG_A }),
      () => limits.assertFreeCampaignActivateAllowed(full, { userId: U1, organizationId: ORG_A, campaignId: "other" }),
      () => limits.assertFreeChannelConnectAllowed(full, { userId: U1, organizationId: ORG_A }),
      () => limits.assertFreeCheckAllowed(full, { userId: U1, organizationId: ORG_A }),
    ]) {
      try {
        await fn();
      } catch (e) {
        messages.push(e instanceof Error ? e.message : String(e));
      }
    }
    expect(messages.length).toBeGreaterThan(0);
    for (const m of messages) expect(m.toLowerCase()).not.toContain("trial");
    expect(messages.join(" ")).toContain("10 free checks");
  });

  it("cross-org: slug swap to non-member org denied at level", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    const c = makeClient(
      baseFx({
        organization_members: [member(U1, ORG_A)],
        user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }],
      }),
    );
    expect(await resolveSponsorshipAccessLevel(c, { userId: U1, organizationId: ORG_B })).toBe("none");
  });

  it("no RLS bypass: resolver never grants data, only level", async () => {
    const { resolveSponsorshipAccessLevel } = await import("./sponsorship-limits");
    // Level free still requires membership per org — data access stays RLS-scoped.
    const c = makeClient(baseFx({ user_tool_entitlements: [{ user_id: U1, tool_id: TOOL_ID, source: "free", expires_at: null }] }));
    expect(await resolveSponsorshipAccessLevel(c, { userId: "intruder", organizationId: ORG_A })).toBe("none");
  });
});
