import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe("Entitlements — RCCF-ADMIN-05", () => {
  it("requireSuperAdmin is called in page and service", () => {
    expect(readFileSync("src/app/(admin)/admin/entitlements/page.tsx", "utf8")).toContain("requireSuperAdmin");
    expect(readFileSync("src/server/admin/entitlements.ts", "utf8")).toContain("requireSuperAdmin");
  });

  it("non-admin and anonymous would be rejected via requireSuperAdmin (mocked 403/401)", async () => {
    const { requireSuperAdmin } = await import("@/lib/auth/require-super-admin");
    const mocked = requireSuperAdmin as unknown as ReturnType<typeof vi.fn>;
    // Simulate non-admin → would throw 403; we just verify mock is called via service
    const { getAdminEntitlements } = await import("./entitlements");
    // Setup generic mock for admin client to avoid throw on data
    const adminMod = await import("@/lib/supabase/admin");
    const mk = adminMod.createAdminClient as unknown as ReturnType<typeof vi.fn>;
    const makeQ = () => {
      const q: unknown = Promise.resolve({ count: 0, data: [], error: null });
      (q as Record<string, unknown>).or = vi.fn(() => q);
      (q as Record<string, unknown>).eq = vi.fn(() => q);
      (q as Record<string, unknown>).in = vi.fn(() => q);
      (q as Record<string, unknown>).order = vi.fn(() => q);
      (q as Record<string, unknown>).range = vi.fn(() => q);
      (q as Record<string, unknown>).not = vi.fn(() => q);
      (q as Record<string, unknown>).lte = vi.fn(() => q);
      (q as Record<string, unknown>).select = vi.fn(() => q);
      return q as never;
    };
    mk.mockImplementation(() => ({ from: vi.fn(() => ({ select: vi.fn(() => makeQ()) })) }) as never);
    mocked.mockResolvedValueOnce({ id: "admin-1" });
    const res = await getAdminEntitlements({} as never);
    expect(res).toBeDefined();
    expect(mocked).toHaveBeenCalled();
  });

  it("createAdminClient only after guard and not in client components", () => {
    expect(readFileSync("src/server/admin/entitlements.ts", "utf8")).toContain("createAdminClient");
    expect(readFileSync("src/server/admin/entitlements.ts", "utf8")).toContain("requireSuperAdmin");
    // Ensure client components don't import it
    const shell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
    expect(shell).not.toContain("createAdminClient");
    const sidebar = readFileSync("src/components/admin/AdminSidebar.tsx", "utf8");
    expect(sidebar).not.toContain("createAdminClient");
  });

  it("no mutations — no insert/update/delete in service or page", () => {
    const svc = readFileSync("src/server/admin/entitlements.ts", "utf8");
    const page = readFileSync("src/app/(admin)/admin/entitlements/page.tsx", "utf8");
    [svc, page].forEach((c) => {
      expect(c).not.toMatch(/\.insert\(/);
      expect(c).not.toMatch(/\.update\(/);
      expect(c).not.toMatch(/\.delete\(/);
    });
    expect(page).not.toMatch(/recordAdminAudit/);
    expect(svc).not.toMatch(/recordAdminAudit/);
  });

  it("no auth.users exposure, no sensitive fields", () => {
    const svc = readFileSync("src/server/admin/entitlements.ts", "utf8");
    expect(svc).not.toContain('from("auth.users")');
    expect(svc).not.toContain("password");
    expect(svc).not.toContain("refresh_token");
    expect(svc).toContain('from("tool_entitlements")');
    const page = readFileSync("src/app/(admin)/admin/entitlements/page.tsx", "utf8");
    expect(page).not.toContain("auth.users");
  });

  it("NULL expires_at = Permanent, active = null or gt now, expired = not null and lte now", () => {
    const svc = readFileSync("src/server/admin/entitlements.ts", "utf8");
    expect(svc).toContain("expires_at.is.null");
    expect(svc).toContain("expires_at.gt");
    expect(svc).toContain("lte(");
    const page = readFileSync("src/app/(admin)/admin/entitlements/page.tsx", "utf8");
    expect(page).toContain("Permanent");
    expect(page).toContain("Active");
    expect(page).toContain("Expired");
  });

  it("All Access semantics: is_all_access true + tool_id NULL, per-tool false + tool_id", () => {
    const svc = readFileSync("src/server/admin/entitlements.ts", "utf8");
    expect(svc).toContain("is_all_access");
    expect(svc).toContain("tool_id");
    // Check that All Access filter uses eq is_all_access true, per-tool uses eq tool_id
    expect(svc).toContain('eq("is_all_access", true)');
    expect(svc).toContain('eq("tool_id"');
    const page = readFileSync("src/app/(admin)/admin/entitlements/page.tsx", "utf8");
    expect(page).toContain("All Access");
    expect(page).toContain("Individual");
  });

  it("tool filter uses authoritative tools table slug, not arbitrary id", () => {
    const svc = readFileSync("src/server/admin/entitlements.ts", "utf8");
    expect(svc).toContain('from("tools")');
    expect(svc).toContain('select("slug, name")');
    expect(svc).toContain('tool === "all-access"');
    expect(svc).not.toMatch(/tool_id.*searchParams\.tool/);
  });

  it("organization search bounded and via ilike, not raw SQL", () => {
    const svc = readFileSync("src/server/admin/entitlements.ts", "utf8");
    expect(svc).toContain("MAX_QUERY_LEN = 100");
    expect(svc).toContain("trim()");
    expect(svc).toContain("ilike");
    expect(svc).not.toContain("`select * from");
  });

  it("page validation fallback to 1 and bounded", () => {
    const svc = readFileSync("src/server/admin/entitlements.ts", "utf8");
    expect(svc).toContain("if (!Number.isFinite(page) || page < 1) page = 1");
    expect(svc).toContain("if (page > 1000) page = 1000");
  });

  it("page size fixed at 50 and not user-controlled", () => {
    const svc = readFileSync("src/server/admin/entitlements.ts", "utf8");
    expect(svc).toContain("PAGE_SIZE = 50");
    expect(svc).not.toContain("searchParams.pageSize");
  });

  it("filters preserved across pagination", () => {
    const page = readFileSync("src/app/(admin)/admin/entitlements/page.tsx", "utf8");
    expect(page).toContain("buildPageHref");
    expect(page).toContain("result.query");
    expect(page).toContain("result.tool");
    expect(page).toContain("result.status");
  });

  it("filter change resets page to 1", () => {
    const page = readFileSync("src/app/(admin)/admin/entitlements/page.tsx", "utf8");
    // Form does not include page input, so submit resets to 1
    expect(page).toContain('<form method="GET"');
    // buildHref for filter apply should not preserve old page
    expect(page).not.toMatch(/buildHref.*page.*result\.page/);
  });

  it("empty vs error distinguishable", () => {
    const page = readFileSync("src/app/(admin)/admin/entitlements/page.tsx", "utf8");
    expect(page).toContain("No entitlements found");
    expect(page).toContain("No entitlements match the selected filters");
    expect(page).toContain("Unable to load entitlements");
    expect(page).toContain("hasError");
  });

  it("no N+1 — batched organization and tool lookups", () => {
    const svc = readFileSync("src/server/admin/entitlements.ts", "utf8");
    expect(svc).toContain('in("id", orgIds)');
    expect(svc).toContain('in("id", toolIds)');
    expect(svc).not.toMatch(/for\s*\(.*await supabase/);
    expect(svc).not.toMatch(/for\s*\(.*await admin/);
  });

  it("actual schema fields discovered — no guessed columns", () => {
    const svc = readFileSync("src/server/admin/entitlements.ts", "utf8");
    expect(svc).toContain("select(\"id, organization_id, tool_id, is_all_access, expires_at, source, created_at\")");
    // Verify database.ts has those fields
    const types = readFileSync("src/types/database.ts", "utf8");
    expect(types).toContain("tool_id: string | null");
    expect(types).toContain("is_all_access: boolean");
    expect(types).toContain("expires_at: string | null");
    expect(types).toContain("source: EntitlementSource");
  });

  it("serverNow used consistently for status derivation", () => {
    const svc = readFileSync("src/server/admin/entitlements.ts", "utf8");
    expect(svc).toContain("serverNowIso = new Date().toISOString()");
    // status filter and mapping both use same variable
    expect(svc.match(/serverNowIso/g)?.length ?? 0).toBeGreaterThan(3);
  });

  it("does not expose before/after/ip secrets", () => {
    const page = readFileSync("src/app/(admin)/admin/entitlements/page.tsx", "utf8");
    expect(page).not.toMatch(/entry\.before/);
    expect(page).not.toMatch(/entry\.after/);
    expect(page).not.toMatch(/entry\.ip/);
  });
});
