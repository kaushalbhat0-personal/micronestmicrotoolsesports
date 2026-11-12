import { describe, expect, it, vi } from "vitest";
import { getToolFreePolicy } from "@/config/tools/policy";
import {
  PRIZE_SPLITTER_PAID_SOURCES,
  PRIZE_SPLITTER_TOOL_SLUG,
  ensureFreePrizeSplitterGrant,
} from "./prize-splitter-policy";

/**
 * Prize Pool Splitter Free issuance tests.
 * Org-scoped lifetime grant only — no quotas, ledgers, orders, payments,
 * or user grants exist for this stateless tool. Access resolution itself
 * stays in the generic resolver + requireEntitlement (already covered).
 */

const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();
const TOOL_ID = "tool-prize-id";

describe("prize-splitter policy registration", () => {
  it("is org-scoped, not user-grantable, Free-enabled and claimable with no limits", () => {
    const policy = getToolFreePolicy("prize-splitter");
    expect(policy?.toolSlug).toBe("prize-splitter");
    expect(policy?.scope).toBe("org");
    expect(policy?.userGrantable).toBe(false);
    expect(policy?.freeEnabled).toBe(true);
    expect(policy?.claimable).toBe(true);
    expect(policy?.limits).toEqual({});
    expect(PRIZE_SPLITTER_TOOL_SLUG).toBe("prize-splitter");
    expect(PRIZE_SPLITTER_PAID_SOURCES.has("subscription")).toBe(true);
  });
});

function grantsClient(grants: Array<Record<string, unknown>>, toolId: string | null = TOOL_ID) {
  const perTool = grants.filter((g) => g.is_all_access === false && g.tool_id === toolId);
  const table = (name: string) => {
    const chain: Record<string, unknown> = {
      select: () => proxy,
      eq: () => proxy,
      single: async () => {
        if (name === "tools") return { data: toolId ? { id: toolId } : null, error: toolId ? null : { message: "none" } };
        return { data: null, error: null };
      },
      maybeSingle: async () => {
        if (name === "tool_entitlements") return { data: perTool[0] ?? null, error: null };
        return { data: null, error: null };
      },
      upsert: () => ({
        select: () => ({
          single: async () => ({
            data: { id: "g-new", is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: null },
            error: null,
          }),
        }),
      }),
    };
    const proxy = new Proxy(chain, {
      get(target, prop: string | symbol) {
        if (prop === "then" && name === "tool_entitlements") {
          return (resolve: (v: unknown) => void) => resolve({ data: grants, error: null });
        }
        return (target as Record<string | symbol, unknown>)[prop];
      },
    });
    return proxy;
  };
  return { from: vi.fn((name: string) => table(name)), rpc: vi.fn() };
}

describe("ensureFreePrizeSplitterGrant (idempotent, never downgrades)", () => {
  it("creates the org Free grant when none exists (source=free, lifetime)", async () => {
    const row = (await ensureFreePrizeSplitterGrant(grantsClient([]) as never, "org-a")) as {
      source: string;
      expires_at: null;
      is_all_access: boolean;
    };
    expect(row.source).toBe("free");
    expect(row.expires_at).toBeNull();
    expect(row.is_all_access).toBe(false);
  });

  it("returns the existing Free grant untouched (duplicate claim)", async () => {
    const existing = { id: "g1", is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: null };
    const row = await ensureFreePrizeSplitterGrant(grantsClient([existing]) as never, "org-a");
    expect(row).toMatchObject({ id: "g1", source: "free" });
  });

  it("never downgrades an existing paid grant", async () => {
    const paid = { id: "g9", is_all_access: false, tool_id: TOOL_ID, source: "subscription", expires_at: FUTURE };
    const row = await ensureFreePrizeSplitterGrant(grantsClient([paid]) as never, "org-a");
    expect(row).toMatchObject({ id: "g9", source: "subscription" });
  });

  it("never downgrades All Access coverage", async () => {
    const allAccess = { id: "g8", is_all_access: true, tool_id: null, source: "manual", expires_at: FUTURE };
    const row = await ensureFreePrizeSplitterGrant(grantsClient([allAccess]) as never, "org-a");
    expect(row).toMatchObject({ id: "g8", source: "manual" });
  });

  it("reissues when the existing grant expired", async () => {
    const expired = { id: "g2", is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: PAST };
    const row = (await ensureFreePrizeSplitterGrant(grantsClient([expired]) as never, "org-a")) as unknown as { id: string };
    expect(row.id).toBe("g-new");
  });

  it("fails closed when the tool is not registered", async () => {
    await expect(ensureFreePrizeSplitterGrant(grantsClient([], null) as never, "org-a")).rejects.toThrow();
  });
});
