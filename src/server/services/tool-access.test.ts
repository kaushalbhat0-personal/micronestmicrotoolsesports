import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getToolFreePolicy } from "@/config/tools/policy";
import { resolveToolAccessLevel } from "./tool-access";

/**
 * Phase A freemium architecture tests (registry + generic resolver).
 * Pure unit tests with a mocked Supabase client at the query boundary.
 * No production caller uses the skeleton yet; Sponsorship behavior is
 * asserted here only to pin parity, never modified.
 */

const TOOL_ID = "tool-id";
const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

type Row = Record<string, unknown>;

interface Fixture {
  member?: boolean;
  rpcAccess?: boolean | null;
  toolRow?: Row | null;
  orgGrantRows?: Row[];
  userGrant?: Row | null;
  throwOnRpc?: boolean;
}

function mockSupabase(fx: Fixture) {
  const rpc = vi.fn(async () => {
    if (fx.throwOnRpc) throw new Error("db down");
    return { data: fx.rpcAccess ?? null, error: null };
  });
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {
      select: () => proxy,
      eq: () => proxy,
      or: () => proxy,
      single: async () => {
        if (table === "tools") return { data: fx.toolRow ?? null, error: null };
        return { data: null, error: null };
      },
      maybeSingle: async () => {
        if (table === "organization_members")
          return fx.member ? { data: { id: "m1" }, error: null } : { data: null, error: null };
        if (table === "user_tool_entitlements") return { data: fx.userGrant ?? null, error: null };
        return { data: null, error: null };
      },
    };
    // Awaiting the builder directly resolves the list query (only the
    // tool_entitlements fallback leg awaits without a terminal).
    const proxy = new Proxy(chain, {
      get(target, prop: string | symbol) {
        if (prop === "then") {
          if (table === "tool_entitlements") {
            return (resolve: (v: unknown) => void) =>
              resolve({ data: fx.orgGrantRows ?? [], error: null });
          }
          return undefined;
        }
        return (target as Record<string | symbol, unknown>)[prop];
      },
    });
    return proxy;
  });
  // Minimal client: only the touched surface, cast once at the boundary.
  return { rpc, from } as unknown as SupabaseClient;
}

function paidGrant(source = "subscription", expires_at: string | null = FUTURE) {
  return { id: "g1", user_id: "u1", tool_id: TOOL_ID, source, expires_at };
}

const TOOL_ROW = { id: TOOL_ID, slug: "sponsor-sentinel", is_active: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("policy registry", () => {
  it("1. known sponsor-sentinel resolves", () => {
    expect(getToolFreePolicy("sponsor-sentinel")?.toolSlug).toBe("sponsor-sentinel");
  });

  it("2. tie-breaker resolves", () => {
    expect(getToolFreePolicy("tie-breaker")?.toolSlug).toBe("tie-breaker");
  });

  it("3. draft-ban resolves", () => {
    expect(getToolFreePolicy("draft-ban")?.toolSlug).toBe("draft-ban");
  });

  it("4. prize-splitter resolves", () => {
    expect(getToolFreePolicy("prize-splitter")?.toolSlug).toBe("prize-splitter");
  });

  it("5. unknown slug returns null (deny)", () => {
    expect(getToolFreePolicy("nope-not-a-tool")).toBeNull();
    expect(getToolFreePolicy("all-access")).toBeNull();
    expect(getToolFreePolicy("")).toBeNull();
  });

  it("6. sponsorship is user-scoped", () => {
    expect(getToolFreePolicy("sponsor-sentinel")?.scope).toBe("user");
  });

  it("7. tie-breaker is org-scoped", () => {
    expect(getToolFreePolicy("tie-breaker")?.scope).toBe("org");
  });

  it("8. draft-ban is org-scoped", () => {
    expect(getToolFreePolicy("draft-ban")?.scope).toBe("org");
  });

  it("9. prize-splitter is org-scoped", () => {
    expect(getToolFreePolicy("prize-splitter")?.scope).toBe("org");
  });

  it("10. only sponsorship is currently userGrantable", () => {
    expect(getToolFreePolicy("sponsor-sentinel")?.userGrantable).toBe(true);
    for (const slug of ["tie-breaker", "draft-ban", "prize-splitter"]) {
      expect(getToolFreePolicy(slug)?.userGrantable).toBe(false);
    }
  });

  it("11. sponsorship, tie-breaker, and draft-ban are freeEnabled", () => {
    expect(getToolFreePolicy("sponsor-sentinel")?.freeEnabled).toBe(true);
    expect(getToolFreePolicy("tie-breaker")?.freeEnabled).toBe(true);
    expect(getToolFreePolicy("draft-ban")?.freeEnabled).toBe(true);
    for (const slug of ["prize-splitter"]) {
      expect(getToolFreePolicy(slug)?.freeEnabled).toBe(false);
    }
  });

  it("12. sponsorship, tie-breaker, and draft-ban are claimable", () => {
    expect(getToolFreePolicy("sponsor-sentinel")?.claimable).toBe(true);
    expect(getToolFreePolicy("tie-breaker")?.claimable).toBe(true);
    expect(getToolFreePolicy("draft-ban")?.claimable).toBe(true);
    for (const slug of ["prize-splitter"]) {
      expect(getToolFreePolicy(slug)?.claimable).toBe(false);
    }
  });

  it("12b. tie-breaker Free expresses 3 locked records per workspace month", () => {
    expect(getToolFreePolicy("tie-breaker")?.limits).toMatchObject({
      lockedOfficialRecordsPerMonth: 3,
      freeHistoryLimit: 3,
    });
  });

  it("12c. draft-ban Free expresses 1 completed match, 5 visible records, 3 templates (descriptive)", () => {
    expect(getToolFreePolicy("draft-ban")?.limits).toMatchObject({
      completedMatchesPerMonth: 1,
      freeHistoryLimit: 5,
      customTemplatesMax: 3,
    });
  });
});

describe("generic access resolution", () => {
  it("13. non-member → none (even with an otherwise-valid grant)", async () => {
    const client = mockSupabase({ member: false, userGrant: paidGrant() });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "sponsor-sentinel" })
    ).resolves.toBe("none");
  });

  it("14. org paid entitlement → paid (no user grant needed)", async () => {
    const client = mockSupabase({
      member: true,
      toolRow: { id: "tool-tie", slug: "tie-breaker", is_active: true },
      orgGrantRows: [{ id: "e1", is_all_access: false, tool_id: "tool-tie", source: "subscription", expires_at: null }],
    });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "tie-breaker" })
    ).resolves.toBe("paid");
  });

  it("15. org All Access → paid (fallback query leg)", async () => {
    const client = mockSupabase({
      member: true,
      // rpcAccess left null (non-boolean) so the manual query fallback leg runs.
      toolRow: { id: "tool-tie", slug: "tie-breaker", is_active: true },
      orgGrantRows: [{ id: "e1", is_all_access: true, tool_id: null, source: "subscription", expires_at: null }],
    });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "tie-breaker" })
    ).resolves.toBe("paid");
  });

  it("16. CRITICAL: org-scoped tool with valid user grant → none (no cross-org user-grant leakage)", async () => {
    // A member holding a valid paid user-level grant must NOT gain access
    // to an org-scoped tool through it. User grants stay sponsorship-only.
    const client = mockSupabase({ member: true, rpcAccess: false, toolRow: TOOL_ROW, userGrant: paidGrant() });
    for (const slug of ["tie-breaker", "draft-ban", "prize-splitter"]) {
      await expect(
        resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: slug })
      ).resolves.toBe("none");
    }
  });

  it("17. sponsorship with valid paid user grant + membership → paid", async () => {
    const client = mockSupabase({ member: true, rpcAccess: false, toolRow: TOOL_ROW, userGrant: paidGrant() });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "sponsor-sentinel" })
    ).resolves.toBe("paid");
  });

  it("18. sponsorship with valid Free user grant + membership → free", async () => {
    const client = mockSupabase({
      member: true,
      rpcAccess: false,
      toolRow: TOOL_ROW,
      userGrant: paidGrant("free", null),
    });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "sponsor-sentinel" })
    ).resolves.toBe("free");
  });

  it.each(["subscription", "manual", "promo"])(
    "19. sponsorship with expired paid user grant (%s) → free (frozen fallback)",
    async (source) => {
      const client = mockSupabase({
        member: true,
        rpcAccess: false,
        toolRow: TOOL_ROW,
        userGrant: paidGrant(source, PAST),
      });
      await expect(
        resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "sponsor-sentinel" })
      ).resolves.toBe("free");
    }
  );

  it("20. sponsorship with no grant → none", async () => {
    const client = mockSupabase({ member: true, rpcAccess: false, toolRow: TOOL_ROW, userGrant: null });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "sponsor-sentinel" })
    ).resolves.toBe("none");
  });

  it("21. unexpected dependency error → none (fail closed)", async () => {
    const client = mockSupabase({ member: true, throwOnRpc: true });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "sponsor-sentinel" })
    ).resolves.toBe("none");
  });

  it("22. unknown tool slug → none", async () => {
    const client = mockSupabase({ member: true, rpcAccess: false, toolRow: TOOL_ROW, userGrant: paidGrant() });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "nope-not-a-tool" })
    ).resolves.toBe("none");
  });
});

describe("tie-breaker org Free resolution", () => {
  const TIE_TOOL = { id: "tool-tie", slug: "tie-breaker", is_active: true };

  function tieClient(orgGrantRows: unknown[], userGrant: unknown = null) {
    return mockSupabase({ member: true, toolRow: TIE_TOOL, orgGrantRows: orgGrantRows as never[], userGrant: userGrant as never });
  }

  it("23. member + Free org grant → free (never paid)", async () => {
    const client = tieClient([{ id: "e1", is_all_access: false, tool_id: "tool-tie", source: "free", expires_at: null }]);
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "tie-breaker" })
    ).resolves.toBe("free");
  });

  it("24. member + paid org grant → paid even when a Free grant also exists (paid wins)", async () => {
    const client = tieClient([
      { id: "e1", is_all_access: false, tool_id: "tool-tie", source: "free", expires_at: null },
      { id: "e2", is_all_access: false, tool_id: "tool-tie", source: "subscription", expires_at: null },
    ]);
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "tie-breaker" })
    ).resolves.toBe("paid");
  });

  it("25. member + All Access paid → paid", async () => {
    const client = tieClient([{ id: "e1", is_all_access: true, tool_id: null, source: "manual", expires_at: null }]);
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "tie-breaker" })
    ).resolves.toBe("paid");
  });

  it("26. expired paid org grant without Free grant → none (must claim Free)", async () => {
    const client = tieClient([{ id: "e1", is_all_access: false, tool_id: "tool-tie", source: "subscription", expires_at: PAST }]);
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "tie-breaker" })
    ).resolves.toBe("none");
  });

  it("27. expired paid org grant + valid Free grant → free", async () => {
    const client = tieClient([
      { id: "e1", is_all_access: false, tool_id: "tool-tie", source: "subscription", expires_at: PAST },
      { id: "e2", is_all_access: false, tool_id: "tool-tie", source: "free", expires_at: null },
    ]);
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "tie-breaker" })
    ).resolves.toBe("free");
  });

  it("28. sponsorship Free user grant cannot unlock tie-breaker (org scope enforced)", async () => {
    const client = mockSupabase({ member: true, toolRow: TIE_TOOL, orgGrantRows: [], userGrant: paidGrant("free", null) });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "tie-breaker" })
    ).resolves.toBe("none");
  });

  it("29. non-member + Free org grant → none", async () => {
    const client = mockSupabase({
      member: false,
      toolRow: TIE_TOOL,
      orgGrantRows: [{ id: "e1", is_all_access: false, tool_id: "tool-tie", source: "free", expires_at: null }],
    });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "tie-breaker" })
    ).resolves.toBe("none");
  });
});
