import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getToolFreePolicy } from "@/config/tools/policy";
import { resolveToolAccessLevel } from "./tool-access";
import {
  DRAFT_BAN_PAID_SOURCES,
  DRAFT_BAN_QUOTA_MESSAGE,
  DRAFT_BAN_TEMPLATE_LIMIT_MESSAGE,
  DRAFT_BAN_TOOL_SLUG,
  FREE_DRAFT_BAN_COMPLETED_MATCHES_PER_MONTH,
  FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX,
  FREE_DRAFT_BAN_HISTORY_LIMIT,
  draftBanQuotaError,
  draftBanResultLogoUrl,
  draftBanTemplateLimitError,
  ensureFreeDraftBanGrant,
  freeDraftBanCustomTemplatesMax,
  isDraftBanQuotaError,
  isDraftBanTemplateLimitError,
  mapConsumeDraftBanCompletionError,
  mapCreateDraftTemplateError,
  resolveDraftBanAccessLevel,
} from "./draft-ban-policy";

/**
 * Draft & Ban Free policy + claim foundation tests (IMPLEMENT-01).
 * Policy registration, idempotent org-grant issuance, and generic access
 * resolution. No quota, history, template, branding, or billing behavior
 * is asserted here — those belong to later phases.
 */

const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();
const TOOL_ID = "tool-draft-id";
const TOOL_ROW = { id: TOOL_ID, slug: "draft-ban", is_active: true };

describe("draft-ban policy registration", () => {
  it("is org-scoped, not user-grantable, Free-enabled and claimable", () => {
    const policy = getToolFreePolicy("draft-ban");
    expect(policy?.toolSlug).toBe("draft-ban");
    expect(policy?.scope).toBe("org");
    expect(policy?.userGrantable).toBe(false);
    expect(policy?.freeEnabled).toBe(true);
    expect(policy?.claimable).toBe(true);
  });

  it("registers the Free limits descriptively (no enforcement in this phase)", () => {
    expect(getToolFreePolicy("draft-ban")?.limits).toMatchObject({
      completedMatchesPerMonth: 1,
      freeHistoryLimit: 5,
      customTemplatesMax: 3,
    });
    expect(FREE_DRAFT_BAN_COMPLETED_MATCHES_PER_MONTH).toBe(1);
    expect(FREE_DRAFT_BAN_HISTORY_LIMIT).toBe(5);
    expect(FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX).toBe(3);
    expect(DRAFT_BAN_TOOL_SLUG).toBe("draft-ban");
    expect(DRAFT_BAN_PAID_SOURCES.has("subscription")).toBe(true);
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
    // Awaiting the builder directly resolves the covering-grants list query.
    // Every builder method returns the proxy so chained awaits keep the
    // `then` trap (awaiting the builder resolves the list).
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

describe("ensureFreeDraftBanGrant (idempotent, never downgrades)", () => {
  it("creates the org Free grant when none exists", async () => {
    const row = (await ensureFreeDraftBanGrant(grantsClient([]) as never, "org-a")) as { source: string; expires_at: null };
    expect(row.source).toBe("free");
    expect(row.expires_at).toBeNull();
  });

  it("returns the existing Free grant untouched (duplicate claim)", async () => {
    const existing = { id: "g1", is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: null };
    const row = await ensureFreeDraftBanGrant(grantsClient([existing]) as never, "org-a");
    expect(row).toMatchObject({ id: "g1", source: "free" });
  });

  it("never downgrades an existing paid grant", async () => {
    const paid = { id: "g9", is_all_access: false, tool_id: TOOL_ID, source: "subscription", expires_at: FUTURE };
    const row = await ensureFreeDraftBanGrant(grantsClient([paid]) as never, "org-a");
    expect(row).toMatchObject({ id: "g9", source: "subscription" });
  });

  it("never downgrades All Access coverage", async () => {
    const allAccess = { id: "g8", is_all_access: true, tool_id: null, source: "manual", expires_at: FUTURE };
    const row = await ensureFreeDraftBanGrant(grantsClient([allAccess]) as never, "org-a");
    expect(row).toMatchObject({ id: "g8", source: "manual" });
  });

  it("leaves an expired per-tool row alone when paid All Access covers the org", async () => {
    const expiredPaid = { id: "g2", is_all_access: false, tool_id: TOOL_ID, source: "subscription", expires_at: PAST };
    const allAccess = { id: "g8", is_all_access: true, tool_id: null, source: "manual", expires_at: FUTURE };
    const row = await ensureFreeDraftBanGrant(grantsClient([expiredPaid, allAccess]) as never, "org-a");
    expect(row).toMatchObject({ id: "g2", source: "subscription" });
  });

  it("reissues when the existing grant expired", async () => {
    const expired = { id: "g2", is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: PAST };
    const row = (await ensureFreeDraftBanGrant(grantsClient([expired]) as never, "org-a")) as unknown as { id: string };
    expect(row.id).toBe("g-new");
  });

  it("fails closed when the tool is not registered", async () => {
    await expect(ensureFreeDraftBanGrant(grantsClient([], null) as never, "org-a")).rejects.toThrow();
  });
});

interface Fixture {
  member?: boolean;
  rpcAccess?: boolean | null;
  orgGrantRows?: Array<Record<string, unknown>>;
  userGrant?: Record<string, unknown> | null;
}

function accessClient(fx: Fixture) {
  const rpc = vi.fn(async () => ({ data: fx.rpcAccess ?? null, error: null }));
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {
      select: () => proxy,
      eq: () => proxy,
      or: () => proxy,
      single: async () => {
        if (table === "tools") return { data: TOOL_ROW, error: null };
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
            return (resolve: (v: unknown) => void) => resolve({ data: fx.orgGrantRows ?? [], error: null });
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

function paidUserGrant(source = "subscription") {
  return { id: "g1", user_id: "u1", tool_id: TOOL_ID, source, expires_at: FUTURE };
}

describe("draft-ban access precedence (Paid > Free > None)", () => {
  it("member + Free org grant → free (never paid)", async () => {
    const client = accessClient({
      member: true,
      rpcAccess: true,
      orgGrantRows: [{ id: "e1", is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: null }],
    });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "draft-ban" }),
    ).resolves.toBe("free");
  });

  it("member + paid org grant → paid", async () => {
    const client = accessClient({
      member: true,
      rpcAccess: true,
      orgGrantRows: [{ id: "e1", is_all_access: false, tool_id: TOOL_ID, source: "subscription", expires_at: null }],
    });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "draft-ban" }),
    ).resolves.toBe("paid");
  });

  it("member + All Access paid → paid", async () => {
    const client = accessClient({
      member: true,
      rpcAccess: true,
      orgGrantRows: [{ id: "e1", is_all_access: true, tool_id: null, source: "manual", expires_at: null }],
    });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "draft-ban" }),
    ).resolves.toBe("paid");
  });

  it("paid wins over Free when both exist", async () => {
    const client = accessClient({
      member: true,
      rpcAccess: true,
      orgGrantRows: [
        { id: "e1", is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: null },
        { id: "e2", is_all_access: false, tool_id: TOOL_ID, source: "promo", expires_at: FUTURE },
      ],
    });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "draft-ban" }),
    ).resolves.toBe("paid");
  });

  it("expired paid without Free → none (must claim Free)", async () => {
    const client = accessClient({
      member: true,
      rpcAccess: false,
      orgGrantRows: [{ id: "e1", is_all_access: false, tool_id: TOOL_ID, source: "subscription", expires_at: PAST }],
    });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "draft-ban" }),
    ).resolves.toBe("none");
  });

  it("expired paid + valid Free → free", async () => {
    const client = accessClient({
      member: true,
      rpcAccess: true,
      orgGrantRows: [
        { id: "e1", is_all_access: false, tool_id: TOOL_ID, source: "subscription", expires_at: PAST },
        { id: "e2", is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: null },
      ],
    });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "draft-ban" }),
    ).resolves.toBe("free");
  });

  it("sponsorship user grant cannot unlock draft-ban", async () => {    const client = accessClient({ member: true, rpcAccess: false, orgGrantRows: [], userGrant: paidUserGrant("free") });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "draft-ban" }),
    ).resolves.toBe("none");
  });

  it("non-member + Free org grant → none", async () => {
    const client = accessClient({
      member: false,
      rpcAccess: true,
      orgGrantRows: [{ id: "e1", is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: null }],
    });
    await expect(
      resolveToolAccessLevel(client, { userId: "u1", organizationId: "org-a", toolSlug: "draft-ban" }),
    ).resolves.toBe("none");
  });
});

describe("quota error contract", () => {
  it("carries the customer-safe upgrade message and a machine-readable kind", () => {
    const err = draftBanQuotaError();
    expect(err.safeMessage).toBe(DRAFT_BAN_QUOTA_MESSAGE);
    expect(DRAFT_BAN_QUOTA_MESSAGE).toMatch(/free Draft & Ban completion for this month/);
    expect(DRAFT_BAN_QUOTA_MESSAGE).not.toMatch(/quota|RPC|entitlement|UTC|SQLSTATE/i);
    expect(isDraftBanQuotaError(err)).toBe(true);
    expect(isDraftBanQuotaError(new Error("nope"))).toBe(false);
  });

  it("maps DBQ01 to the quota error", () => {
    const mapped = mapConsumeDraftBanCompletionError({ code: "DBQ01", message: "quota_exceeded" });
    expect(isDraftBanQuotaError(mapped)).toBe(true);
  });

  it("maps DBN01 membership failures to forbidden, other no-access to entitlement", () => {
    expect(mapConsumeDraftBanCompletionError({ code: "DBN01", message: "no_access: user is not a member" })).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mapConsumeDraftBanCompletionError({ code: "DBN01", message: "no_access: other" })).toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
    });
  });

  it("maps DBD01 to a safe validation message", () => {
    const mapped = mapConsumeDraftBanCompletionError({ code: "DBD01", message: "invalid: only in-progress" });
    expect(mapped).toMatchObject({ code: "VALIDATION_ERROR" });
    expect((mapped as Error).message).not.toMatch(/DBD01|invalid:/);
  });

  it("passes unknown errors through untouched", () => {
    const original = new Error("connection reset");
    expect(mapConsumeDraftBanCompletionError(original)).toBe(original);
  });
});

describe("template-limit error contract (custom caps: free 3, paid 20)", () => {
  it("sources the free cap from the policy registry (never hardcoded)", () => {
    expect(freeDraftBanCustomTemplatesMax()).toBe(3);
    expect(freeDraftBanCustomTemplatesMax()).toBe(getToolFreePolicy("draft-ban")?.limits.customTemplatesMax);
    expect(FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX).toBe(3);
  });

  it("carries a customer-safe upgrade message and a machine-readable kind", () => {
    const err = draftBanTemplateLimitError(3);
    expect(err.safeMessage).toBe(DRAFT_BAN_TEMPLATE_LIMIT_MESSAGE);
    expect(DRAFT_BAN_TEMPLATE_LIMIT_MESSAGE).not.toMatch(/DBT01|SQLSTATE|RPC|entitlement/i);
    expect(isDraftBanTemplateLimitError(err)).toBe(true);
    expect(isDraftBanTemplateLimitError(draftBanQuotaError())).toBe(false);
    expect(isDraftBanTemplateLimitError(new Error("nope"))).toBe(false);
  });

  it("maps DBT01 to the template-limit error (distinguishable from quota/validation)", () => {
    const mapped = mapCreateDraftTemplateError({ code: "DBT01", message: "template_limit_exceeded" }, 3);
    expect(isDraftBanTemplateLimitError(mapped)).toBe(true);
    expect(isDraftBanQuotaError(mapped)).toBe(false);
  });

  it("maps DBT02 and unique violations to duplicate-name validation", () => {
    expect(mapCreateDraftTemplateError({ code: "DBT02", message: "duplicate_template" }, 3)).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(
      mapCreateDraftTemplateError({ code: "23505", message: "draft_templates_org_name_unique" }, 20),
    ).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("maps DBN01 membership failures to forbidden, other no-access to entitlement", () => {
    expect(mapCreateDraftTemplateError({ code: "DBN01", message: "no_access: user is not a member" }, 3)).toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mapCreateDraftTemplateError({ code: "DBN01", message: "no_access: no coverage" }, 3)).toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
    });
  });

  it("passes unknown errors through untouched", () => {
    const original = new Error("connection reset");
    expect(mapCreateDraftTemplateError(original, 3)).toBe(original);
  });
});

describe("paid-only branding gate (live logo, no snapshot)", () => {
  const LOGO = "https://cdn.example/logo.png";

  it("paid exposes the current logo; free/expired/none resolve to null", () => {
    expect(draftBanResultLogoUrl("paid", LOGO)).toBe(LOGO);
    expect(draftBanResultLogoUrl("free", LOGO)).toBeNull();
    expect(draftBanResultLogoUrl("none", LOGO)).toBeNull();
  });

  it("paid without a stored logo stays null (never a broken image)", () => {
    expect(draftBanResultLogoUrl("paid", null)).toBeNull();
    expect(draftBanResultLogoUrl("paid", undefined)).toBeNull();
    expect(draftBanResultLogoUrl("free", null)).toBeNull();
  });
});

describe("resolveDraftBanAccessLevel (org scope only, never user grants)", () => {
  function orgClient(grants: Array<Record<string, unknown>>) {
    return {
      from: vi.fn((table: string) => {
        if (table === "tools") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { id: TOOL_ID }, error: null }) }) }) };
        }
        return {
          select: () => ({ eq: () => ({ data: grants, error: null }) }),
        };
      }),
    };
  }

  it("paid grant → paid, Free grant → free, paid wins over Free", async () => {
    const paid = await resolveDraftBanAccessLevel(
      orgClient([{ is_all_access: false, tool_id: TOOL_ID, source: "subscription", expires_at: null }]) as never,
      { organizationId: "org-a" },
    );
    expect(paid).toBe("paid");
    const free = await resolveDraftBanAccessLevel(
      orgClient([{ is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: null }]) as never,
      { organizationId: "org-a" },
    );
    expect(free).toBe("free");
    const both = await resolveDraftBanAccessLevel(
      orgClient([
        { is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: null },
        { is_all_access: true, tool_id: null, source: "manual", expires_at: FUTURE },
      ]) as never,
      { organizationId: "org-a" },
    );
    expect(both).toBe("paid");
  });

  it("expired paid without Free → none; expired paid + Free → free", async () => {
    const none = await resolveDraftBanAccessLevel(
      orgClient([{ is_all_access: false, tool_id: TOOL_ID, source: "subscription", expires_at: PAST }]) as never,
      { organizationId: "org-a" },
    );
    expect(none).toBe("none");
    const free = await resolveDraftBanAccessLevel(
      orgClient([
        { is_all_access: false, tool_id: TOOL_ID, source: "subscription", expires_at: PAST },
        { is_all_access: false, tool_id: TOOL_ID, source: "free", expires_at: null },
      ]) as never,
      { organizationId: "org-a" },
    );
    expect(free).toBe("free");
  });

  it("grant for another tool → none; no grants → none; failure → none", async () => {
    const other = await resolveDraftBanAccessLevel(
      orgClient([{ is_all_access: false, tool_id: "other-tool", source: "subscription", expires_at: null }]) as never,
      { organizationId: "org-a" },
    );
    expect(other).toBe("none");
    const empty = await resolveDraftBanAccessLevel(orgClient([]) as never, { organizationId: "org-a" });
    expect(empty).toBe("none");
    const broken = await resolveDraftBanAccessLevel({ from: vi.fn(() => { throw new Error("db down"); }) } as never, {
      organizationId: "org-a",
    });
    expect(broken).toBe("none");
  });
});
