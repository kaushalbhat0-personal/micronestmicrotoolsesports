import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("/admin authorization — RCCF-ADMIN-03", () => {
  it("layout and page call requireSuperAdmin (defense-in-depth)", () => {
    const layout = readFileSync("src/app/(admin)/admin/layout.tsx", "utf8");
    const page = readFileSync("src/app/(admin)/admin/page.tsx", "utf8");
    expect(layout).toContain("requireSuperAdmin");
    expect(page).toContain("requireSuperAdmin");
    expect(layout).not.toContain("is_org_member");
    expect(page).not.toContain("orgSlug");
  });

  it("does not use email, env, localStorage, or organization membership", () => {
    const layout = readFileSync("src/app/(admin)/admin/layout.tsx", "utf8");
    const page = readFileSync("src/app/(admin)/admin/page.tsx", "utf8");
    const shell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
    [layout, page, shell].forEach((c) => {
      expect(c).not.toMatch(/NEXT_PUBLIC/);
      expect(c).not.toMatch(/localStorage/);
      expect(c).not.toMatch(/@micronest/i);
      expect(c).not.toMatch(/is_org_member/);
    });
  });

  it("AdminShell does not import createAdminClient (service_role isolation)", () => {
    const shell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
    const sidebar = readFileSync("src/components/admin/AdminSidebar.tsx", "utf8");
    const header = readFileSync("src/components/admin/AdminHeader.tsx", "utf8");
    const stat = readFileSync("src/components/admin/AdminStatCard.tsx", "utf8");
    [shell, sidebar, header, stat].forEach((c) => {
      expect(c).not.toContain("createAdminClient");
      expect(c).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    });
    // overview service is allowed to use createAdminClient after requireSuperAdmin
    const overview = readFileSync("src/server/admin/overview.ts", "utf8");
    expect(overview).toContain("createAdminClient");
    expect(overview).toContain("requireSuperAdmin");
  });

  it("no mutations in /admin this phase (read-only)", () => {
    const page = readFileSync("src/app/(admin)/admin/page.tsx", "utf8");
    const overview = readFileSync("src/server/admin/overview.ts", "utf8");
    // should not contain insert/update/delete on orders/payments/entitlements etc except audit read
    [page, overview].forEach((c) => {
      // page itself should have no insert/update/delete
      expect(c).not.toMatch(/\.insert\(/);
      expect(c).not.toMatch(/\.update\(/);
      expect(c).not.toMatch(/\.delete\(/);
    });
    // Shell/page should not contain words suspend/restore/grant/revoke/refund/delete
    expect(page).not.toMatch(/suspend/i);
    expect(page).not.toMatch(/revoke/i);
    expect(page).not.toMatch(/refund/i);
  });

  it("navigation Coming Soon items are disabled, not fake pages", () => {
    const sidebar = readFileSync("src/components/admin/AdminSidebar.tsx", "utf8");
    expect(sidebar).toContain('href: "/admin"');
    expect(sidebar).toContain('href: "/admin/organizations"');
    expect(sidebar).toContain('href: "/admin/users"');
    expect(sidebar).toContain('href: "/admin/entitlements"');
    expect(sidebar).toContain('href: "/admin/billing"');
    expect(sidebar).toContain('href: "/admin/sentinel"');
    expect(sidebar).toContain('href: "/admin/system"');
    expect(sidebar).toContain('href: "/admin/audit-log"');
  });

  it("layout is server-side protected (no use client) and page is force-dynamic", () => {
    const layout = readFileSync("src/app/(admin)/admin/layout.tsx", "utf8");
    expect(layout).not.toContain('"use client"');
    expect(layout).toContain('robots: { index: false');
    const page = readFileSync("src/app/(admin)/admin/page.tsx", "utf8");
    expect(page).toContain('dynamic = "force-dynamic"');
  });
});
