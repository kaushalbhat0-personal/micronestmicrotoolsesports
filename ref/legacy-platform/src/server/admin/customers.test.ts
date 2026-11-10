import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe("Customer 360 — RCCF-SUPERADMIN-V1-02", () => {
  it("page and service are super-admin gated", () => {
    expect(readFileSync("src/app/(admin)/admin/customers/page.tsx", "utf8")).toContain("requireSuperAdmin");
    expect(readFileSync("src/server/admin/customers.ts", "utf8")).toContain("requireSuperAdmin");
    const svc = readFileSync("src/server/admin/customers.ts", "utf8");
    expect(svc.indexOf("requireSuperAdmin") < svc.indexOf("createAdminClient")).toBe(true);
  });

  it("search covers email + org name + org slug, bounded", () => {
    const svc = readFileSync("src/server/admin/customers.ts", "utf8");
    expect(svc).toContain("searchCustomers");
    expect(svc).toContain("MAX_QUERY_LEN = 100");
    expect(svc).toContain("SEARCH_PAGE_SIZE = 20");
    expect(svc).toContain('ilike("email"');
    expect(svc).toContain("name.ilike");
    expect(svc).toContain("slug.ilike");
  });

  it("never exposes auth.users or secrets", () => {
    const svc = readFileSync("src/server/admin/customers.ts", "utf8");
    const page = readFileSync("src/app/(admin)/admin/customers/page.tsx", "utf8");
    for (const c of [svc, page]) {
      expect(c).not.toContain('from("auth.users")');
      expect(c).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(c).not.toContain("webhook_secret");
      expect(c).not.toContain("encrypted_");
    }
    // no secret-bearing columns in any select projection (structural check)
    const selects = [...svc.matchAll(/\.select\("([^"]+)"\)/g)].map((m) => m[1] ?? "");
    expect(selects.length).toBeGreaterThan(0);
    for (const sel of selects) {
      expect(sel).not.toMatch(/payload/i);
      expect(sel).not.toMatch(/signature/i);
      expect(sel).not.toMatch(/secret/i);
      expect(sel).not.toMatch(/encrypted_/i);
    }
    expect(svc).toContain('from("profiles")');
  });

  it("six released tools are explicitly represented", () => {
    const svc = readFileSync("src/server/admin/customers.ts", "utf8");
    for (const slug of ["sponsor-sentinel", "prize-splitter", "draft-ban", "tie-breaker", "payout-tracker", "roster-builder"]) {
      expect(svc).toContain(slug);
    }
    // removed tools must remain absent
    for (const slug of ["scrim-matchmaker", "vod-clipper", "roster-sentinel"]) {
      expect(svc).not.toContain(slug);
    }
    // marketing aliases map to canonical slugs
    expect(svc).toContain("prize-pool-splitter");
    expect(svc).toContain("tournament-roster-builder");
  });

  it("customer view covers identity/orgs/entitlements/billing/webhooks/audit", () => {
    const svc = readFileSync("src/server/admin/customers.ts", "utf8");
    expect(svc).toContain("getCustomerByUser");
    expect(svc).toContain("getCustomerByOrg");
    expect(svc).toContain("memberships");
    expect(svc).toContain("entitlements");
    expect(svc).toContain("from(\"orders\")");
    expect(svc).toContain("from(\"payments\")");
    expect(svc).toContain("from(\"webhook_events\")");
    expect(svc).toContain("safeAuditProjection");
    expect(svc).toContain("user_tool_entitlements");
  });

  it("read-only — no mutations in customer service or page", () => {
    const svc = readFileSync("src/server/admin/customers.ts", "utf8");
    const page = readFileSync("src/app/(admin)/admin/customers/page.tsx", "utf8");
    for (const c of [svc, page]) {
      expect(c).not.toMatch(/\.insert\(/);
      expect(c).not.toMatch(/\.update\(/);
      expect(c).not.toMatch(/\.delete\(/);
      expect(c).not.toContain("recordAdminAudit");
    }
  });

  it("no N+1 — batched lookups", () => {
    const svc = readFileSync("src/server/admin/customers.ts", "utf8");
    expect(svc).toContain('.in("id"');
    expect(svc).toContain('.in("organization_id"');
    expect(svc).not.toMatch(/for\s*\(.*await admin/);
  });

  it("canonical slug mapping resolves marketing aliases", async () => {
    const { canonicalToolSlug } = await import("./customers");
    expect(canonicalToolSlug("prize-pool-splitter")).toBe("prize-splitter");
    expect(canonicalToolSlug("tournament-roster-builder")).toBe("roster-builder");
    expect(canonicalToolSlug("draft-ban")).toBe("draft-ban");
  });
});
