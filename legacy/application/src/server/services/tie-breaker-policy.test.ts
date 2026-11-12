import { describe, expect, it, vi } from "vitest";
import {
  FREE_TIE_BREAKER_HISTORY_LIMIT,
  FREE_TIE_BREAKER_LOCKS_PER_MONTH,
  TIE_BREAKER_QUOTA_MESSAGE,
  ensureFreeTieBreakerGrant,
  getTieBreakerFreeUsage,
  getWorkspaceMonthKey,
  isTieBreakerQuotaError,
  mapConsumeTieBreakerLockError,
  resolveTieBreakerAccessLevel,
  tieBreakerQuotaError,
} from "./tie-breaker-policy";

/**
 * Tie-Breaker Free policy unit tests (IMPLEMENT-07).
 * Supabase clients are mocked at the query boundary; timezone math and
 * the RPC error contract are asserted for real.
 */

const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();
const TIE_ID = "tool-tie-id";

function grantsClient(grants: unknown[], toolId: string | null = TIE_ID, timezone = "Asia/Kolkata") {
  const table = (name: string) => ({
    select: () => table(name),
    eq: () => table(name),
    single: async () => {
      if (name === "tools") return { data: toolId ? { id: toolId } : null, error: toolId ? null : { message: "none" } };
      return { data: null, error: null };
    },
    maybeSingle: async () => {
      if (name === "tool_entitlements") return { data: grants[0] ?? null, error: null };
      if (name === "organizations") return { data: { timezone }, error: null };
      return { data: null, error: null };
    },
    upsert: () => ({
      select: () => ({
        single: async () => ({
          data: { id: "g-new", is_all_access: false, tool_id: TIE_ID, source: "free", expires_at: null },
          error: null,
        }),
      }),
    }),
  });
  return {
    from: vi.fn((name: string) => table(name)),
    rpc: vi.fn(),
  };
}

function listClient(grants: unknown[], lockedRows: unknown[] = [], timezone = "Asia/Kolkata") {
  return {
    from: vi.fn((name: string) => {
      if (name === "tools") {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { id: TIE_ID }, error: null }) }) }),
        };
      }
      if (name === "organizations") {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { timezone }, error: null }) }) }),
        };
      }
      // tool_entitlements list + tie_breaker_competitions list share a shape here.
      // Every builder method returns the proxy so chained awaits keep the
      // `then` trap (awaiting the builder resolves the list).
      const terminal = async () => {
        if (name === "tool_entitlements") return { data: grants, error: null };
        return { data: lockedRows, error: null };
      };
      const chain: Record<string, unknown> = {};
      const proxy = new Proxy(chain, {
        get(target, prop: string | symbol) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) => resolve(terminal());
          }
          return (target as Record<string | symbol, unknown>)[prop];
        },
      });
      chain.select = () => proxy;
      chain.eq = () => proxy;
      chain.gte = () => proxy;
      chain.order = () => proxy;
      chain.limit = () => terminal();
      return proxy;
    }),
  };
}

describe("free constants", () => {
  it("3 locked records per month, 3 visible in history", () => {
    expect(FREE_TIE_BREAKER_LOCKS_PER_MONTH).toBe(3);
    expect(FREE_TIE_BREAKER_HISTORY_LIMIT).toBe(3);
  });
});

describe("resolveTieBreakerAccessLevel (org scope only)", () => {
  it("member + Free grant → free", async () => {
    const level = await resolveTieBreakerAccessLevel(
      listClient([{ is_all_access: false, tool_id: TIE_ID, source: "free", expires_at: null }]) as never,
      { organizationId: "org-a" },
    );
    expect(level).toBe("free");
  });

  it("member + paid grant → paid", async () => {
    const level = await resolveTieBreakerAccessLevel(
      listClient([{ is_all_access: false, tool_id: TIE_ID, source: "subscription", expires_at: null }]) as never,
      { organizationId: "org-a" },
    );
    expect(level).toBe("paid");
  });

  it("member + All Access paid → paid", async () => {
    const level = await resolveTieBreakerAccessLevel(
      listClient([{ is_all_access: true, tool_id: null, source: "manual", expires_at: FUTURE }]) as never,
      { organizationId: "org-a" },
    );
    expect(level).toBe("paid");
  });

  it("paid wins over Free when both exist", async () => {
    const level = await resolveTieBreakerAccessLevel(
      listClient([
        { is_all_access: false, tool_id: TIE_ID, source: "free", expires_at: null },
        { is_all_access: false, tool_id: TIE_ID, source: "promo", expires_at: FUTURE },
      ]) as never,
      { organizationId: "org-a" },
    );
    expect(level).toBe("paid");
  });

  it("expired paid without Free → none (claim required)", async () => {
    const level = await resolveTieBreakerAccessLevel(
      listClient([{ is_all_access: false, tool_id: TIE_ID, source: "subscription", expires_at: PAST }]) as never,
      { organizationId: "org-a" },
    );
    expect(level).toBe("none");
  });

  it("expired paid + valid Free → free", async () => {
    const level = await resolveTieBreakerAccessLevel(
      listClient([
        { is_all_access: false, tool_id: TIE_ID, source: "subscription", expires_at: PAST },
        { is_all_access: false, tool_id: TIE_ID, source: "free", expires_at: null },
      ]) as never,
      { organizationId: "org-a" },
    );
    expect(level).toBe("free");
  });

  it("grant for another tool → none", async () => {
    const level = await resolveTieBreakerAccessLevel(
      listClient([{ is_all_access: false, tool_id: "other-tool", source: "subscription", expires_at: null }]) as never,
      { organizationId: "org-a" },
    );
    expect(level).toBe("none");
  });

  it("no grants → none", async () => {
    const level = await resolveTieBreakerAccessLevel(listClient([]) as never, { organizationId: "org-a" });
    expect(level).toBe("none");
  });

  it("database failure fails closed to none", async () => {
    const broken = { from: vi.fn(() => { throw new Error("db down"); }) };
    const level = await resolveTieBreakerAccessLevel(broken as never, { organizationId: "org-a" });
    expect(level).toBe("none");
  });
});

describe("ensureFreeTieBreakerGrant (idempotent, never downgrades)", () => {
  it("creates the org Free grant when none exists", async () => {
    const client = grantsClient([]);
    const row = (await ensureFreeTieBreakerGrant(client as never, "org-a")) as { source: string; expires_at: null };
    expect(row.source).toBe("free");
    expect(row.expires_at).toBeNull();
  });

  it("returns the existing Free grant untouched (duplicate claim)", async () => {
    const existing = { id: "g1", is_all_access: false, tool_id: TIE_ID, source: "free", expires_at: null };
    const row = await ensureFreeTieBreakerGrant(grantsClient([existing]) as never, "org-a");
    expect(row).toMatchObject({ id: "g1", source: "free" });
  });

  it("never downgrades an existing paid grant", async () => {
    const paid = { id: "g9", is_all_access: false, tool_id: TIE_ID, source: "subscription", expires_at: FUTURE };
    const row = await ensureFreeTieBreakerGrant(grantsClient([paid]) as never, "org-a");
    expect(row).toMatchObject({ id: "g9", source: "subscription" });
  });

  it("reissues when the existing Free grant expired", async () => {
    const expired = { id: "g2", is_all_access: false, tool_id: TIE_ID, source: "free", expires_at: PAST };
    const row = (await ensureFreeTieBreakerGrant(grantsClient([expired]) as never, "org-a")) as unknown as { id: string };
    expect(row.id).toBe("g-new");
  });
});

describe("workspace month math (pure, DST-safe, no fixed offsets)", () => {
  it("Asia/Kolkata: 2026-10-31T18:45Z belongs to November", () => {
    expect(getWorkspaceMonthKey(new Date("2026-10-31T18:45:00Z"), "Asia/Kolkata")).toBe("2026-11");
  });

  it("UTC control: same instant belongs to October in UTC", () => {
    expect(getWorkspaceMonthKey(new Date("2026-10-31T18:45:00Z"), "UTC")).toBe("2026-10");
  });

  it("America/New_York: local Nov 1 00:05 (UTC Nov 1 04:05) belongs to November", () => {
    expect(getWorkspaceMonthKey(new Date("2026-11-01T04:05:00Z"), "America/New_York")).toBe("2026-11");
  });

  it("America/New_York: local Oct 31 23:30 (UTC Nov 1 03:30) belongs to October", () => {
    expect(getWorkspaceMonthKey(new Date("2026-10-31T23:30:00-04:00"), "America/New_York")).toBe("2026-10");
  });

  it("Europe/London across the Oct DST boundary", () => {
    // BST (UTC+1) ends Oct 26 2026: 2026-10-31T23:30Z is Oct 31 23:30 GMT.
    expect(getWorkspaceMonthKey(new Date("2026-10-31T23:30:00Z"), "Europe/London")).toBe("2026-10");
    // 2026-10-31T23:30Z is Nov 1 05:00 IST.
    expect(getWorkspaceMonthKey(new Date("2026-10-31T23:30:00Z"), "Asia/Kolkata")).toBe("2026-11");
  });

  it("America/New_York DST spring-forward (Mar 8 2026) stays in March", () => {
    expect(getWorkspaceMonthKey(new Date("2026-03-08T07:30:00Z"), "America/New_York")).toBe("2026-03");
  });

  it("rejects non-IANA values without a static list", () => {
    expect(() => getWorkspaceMonthKey(new Date(), "IST")).toThrow();
    expect(() => getWorkspaceMonthKey(new Date(), "+05:30")).toThrow();
  });
});

describe("free usage counting (server-derived month)", () => {
  it("counts only locked rows in the current workspace month", async () => {
    const rows = [
      { locked_at: "2026-11-05T10:00:00Z" },
      { locked_at: "2026-11-20T10:00:00Z" },
      { locked_at: "2026-10-15T10:00:00Z" },
    ];
    const usage = await getTieBreakerFreeUsage(
      listClient([], rows, "Asia/Kolkata") as never,
      "org-a",
      new Date("2026-11-10T00:00:00Z"),
    );
    expect(usage).toMatchObject({ used: 2, limit: 3, remaining: 1, monthKey: "2026-11" });
  });

  it("a record in one local month does not consume the next", async () => {
    const rows = [{ locked_at: "2026-10-31T18:00:00Z" }]; // Nov 1 23:30 IST... wait: 18:00Z = 23:30 IST Oct 31 → October
    const usage = await getTieBreakerFreeUsage(
      listClient([], rows, "Asia/Kolkata") as never,
      "org-a",
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(usage.used).toBe(0);
  });
});

describe("quota error contract", () => {
  it("carries the customer-safe upgrade message and a machine-readable kind", () => {
    const err = tieBreakerQuotaError();
    expect(err.safeMessage).toBe(TIE_BREAKER_QUOTA_MESSAGE);
    expect(TIE_BREAKER_QUOTA_MESSAGE).toMatch(/3 free Tie-Breaker records/);
    expect(TIE_BREAKER_QUOTA_MESSAGE).not.toMatch(/quota|RPC|entitlement|UTC|SQLSTATE/i);
    expect(isTieBreakerQuotaError(err)).toBe(true);
    expect(isTieBreakerQuotaError(new Error("nope"))).toBe(false);
  });

  it("maps TBF01 to the quota error", () => {
    const mapped = mapConsumeTieBreakerLockError({ code: "TBF01", message: "quota_exceeded" });
    expect(isTieBreakerQuotaError(mapped)).toBe(true);
  });

  it("maps TBN01 membership failures to forbidden, other no-access to entitlement", () => {
    expect(mapConsumeTieBreakerLockError({ code: "TBN01", message: "no_access: user is not a member" })).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mapConsumeTieBreakerLockError({ code: "TBN01", message: "no_access: other" })).toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
    });
  });

  it("maps TBD01 to a safe validation message", () => {
    const mapped = mapConsumeTieBreakerLockError({ code: "TBD01", message: "invalid: only active" });
    expect(mapped).toMatchObject({ code: "VALIDATION_ERROR" });
    expect((mapped as Error).message).not.toMatch(/TBD01|invalid:/);
  });

  it("passes unknown errors through untouched", () => {
    const original = new Error("connection reset");
    expect(mapConsumeTieBreakerLockError(original)).toBe(original);
  });
});
