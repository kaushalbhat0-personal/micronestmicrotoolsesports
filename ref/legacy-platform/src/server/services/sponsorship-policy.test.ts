import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateSponsorshipUserGrant,
  resolveSponsorshipPolicyLevel,
  type SponsorshipPolicyGrant,
} from "./sponsorship-policy";
import { resolveSponsorshipAccessLevel } from "./sponsorship-limits";
import { resolveToolAccessLevel } from "./tool-access";

/**
 * Sponsorship policy module tests (Phase 3 migration proofs).
 *
 * - Pure grant-table matrix for the frozen expiry semantics.
 * - Parity: policy evaluation and both resolvers agree on every row.
 * - Regression matrix + org-scoped denial (tie-breaker/draft-ban/prize).
 * Frozen suites remain untouched; this file only adds migration proofs.
 */

const TOOL_ID = "tool-sponsor-id";
const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

type Row = Record<string, unknown>;

interface Fixture {
  member?: boolean;
  rpcAccess?: boolean | null;
  toolRow?: Row | null;
  orgGrantRows?: Row[];
  userGrant?: Row | null;
}

function mockSupabase(fx: Fixture) {
  const rpc = vi.fn(async () => ({ data: fx.rpcAccess ?? null, error: null }));
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
  return { rpc, from } as unknown as SupabaseClient;
}

const TOOL_ROW = { id: TOOL_ID, slug: "sponsor-sentinel", is_active: true };
const grant = (source: string, expires_at: string | null): SponsorshipPolicyGrant => ({ source, expires_at });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("evaluateSponsorshipUserGrant — frozen table", () => {
  it.each(["subscription", "manual", "promo"])("valid paid grant (%s) → paid", (source) => {
    expect(evaluateSponsorshipUserGrant(grant(source, FUTURE))).toBe("paid");
  });

  it("valid free grant → free", () => {
    expect(evaluateSponsorshipUserGrant(grant("free", FUTURE))).toBe("free");
    expect(evaluateSponsorshipUserGrant(grant("free", null))).toBe("free");
  });

  it.each(["subscription", "manual", "promo"])("expired paid grant (%s) → free", (source) => {
    expect(evaluateSponsorshipUserGrant(grant(source, PAST))).toBe("free");
  });

  it("no grant → none; expired free → none; unknown source → none", () => {
    expect(evaluateSponsorshipUserGrant(null)).toBe("none");
    expect(evaluateSponsorshipUserGrant(grant("free", PAST))).toBe("none");
    expect(evaluateSponsorshipUserGrant(grant("legacy", FUTURE))).toBe("none");
    expect(evaluateSponsorshipUserGrant(grant("legacy", PAST))).toBe("none");
  });
});

describe("parity: policy evaluation matches legacy resolver", () => {
  const cases: Array<{ name: string; userGrant: SponsorshipPolicyGrant | null; expected: "paid" | "free" | "none" }> = [
    { name: "valid paid", userGrant: grant("subscription", FUTURE), expected: "paid" },
    { name: "valid free", userGrant: grant("free", FUTURE), expected: "free" },
    { name: "expired paid", userGrant: grant("manual", PAST), expected: "free" },
    { name: "no grant", userGrant: null, expected: "none" },
    { name: "expired free", userGrant: grant("free", PAST), expected: "none" },
    { name: "unknown source", userGrant: grant("legacy", FUTURE), expected: "none" },
  ];

  it.each(cases)("$name agrees across all three paths", async ({ userGrant, expected }) => {
    // Spread into a fresh row: interfaces lack implicit index signatures.
    const client = mockSupabase({ member: true, rpcAccess: false, toolRow: TOOL_ROW, userGrant: userGrant ? { ...userGrant } : null });
    const input = { userId: "u1", organizationId: "org-a" };
    expect(evaluateSponsorshipUserGrant(userGrant)).toBe(expected);
    await expect(resolveSponsorshipAccessLevel(client, input)).resolves.toBe(expected);
    await expect(resolveSponsorshipPolicyLevel(client, input)).resolves.toBe(expected);
    await expect(
      resolveToolAccessLevel(client, { ...input, toolSlug: "sponsor-sentinel" })
    ).resolves.toBe(expected);
  });
});

describe("regression matrix (generic vs legacy stay identical)", () => {
  it("member + org paid → paid on both", async () => {
    const client = mockSupabase({ member: true, rpcAccess: true });
    const input = { userId: "u1", organizationId: "org-a" };
    await expect(resolveSponsorshipAccessLevel(client, input)).resolves.toBe("paid");
    await expect(
      resolveToolAccessLevel(client, { ...input, toolSlug: "sponsor-sentinel" })
    ).resolves.toBe("paid");
  });

  it("member + All Access org row → paid on both", async () => {
    const client = mockSupabase({
      member: true,
      toolRow: TOOL_ROW,
      orgGrantRows: [{ id: "e1", is_all_access: true, tool_id: null, expires_at: null }],
    });
    const input = { userId: "u1", organizationId: "org-a" };
    await expect(resolveSponsorshipAccessLevel(client, input)).resolves.toBe("paid");
    await expect(
      resolveToolAccessLevel(client, { ...input, toolSlug: "sponsor-sentinel" })
    ).resolves.toBe("paid");
  });

  it("non-member + valid grant → none on both", async () => {
    const client = mockSupabase({ member: false, userGrant: { ...grant("subscription", FUTURE) } });
    const input = { userId: "u1", organizationId: "org-a" };
    await expect(resolveSponsorshipAccessLevel(client, input)).resolves.toBe("none");
    await expect(
      resolveToolAccessLevel(client, { ...input, toolSlug: "sponsor-sentinel" })
    ).resolves.toBe("none");
  });
});

describe("org-scoped tools ignore user grants (explicit per-tool regression)", () => {
  it("E. valid user grant + tie-breaker → none", async () => {
    const client = mockSupabase({ member: true, userGrant: { ...grant("subscription", FUTURE) } });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "tie-breaker" })
    ).resolves.toBe("none");
  });

  it("F. valid user grant + draft-ban → none", async () => {
    const client = mockSupabase({ member: true, userGrant: { ...grant("free", FUTURE) } });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "draft-ban" })
    ).resolves.toBe("none");
  });

  it("G. valid user grant + prize-splitter → none", async () => {
    const client = mockSupabase({ member: true, userGrant: { ...grant("promo", FUTURE) } });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "prize-splitter" })
    ).resolves.toBe("none");
  });
});
