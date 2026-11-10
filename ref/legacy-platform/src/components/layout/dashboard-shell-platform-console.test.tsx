import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DashboardShell } from "./dashboard-shell";

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useParams: () => ({}),
    usePathname: () => "/dashboard",
  };
});

const shellSource = readFileSync(join(process.cwd(), "src/components/layout/dashboard-shell.tsx"), "utf8");
const layoutSource = readFileSync(join(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");

function shellHtml(props: Partial<React.ComponentProps<typeof DashboardShell>> = {}): string {
  return renderToString(
    <DashboardShell organizations={[]} primaryOrgId={null} {...props}>
      {null}
    </DashboardShell>
  );
}

describe("Platform Console discovery — RCCF-SUPERADMIN-UX-IMPLEMENT-03", () => {
  it("A. Superadmin (isPlatformAdmin=true) renders Platform Console → /admin", () => {
    const html = shellHtml({ isPlatformAdmin: true });
    expect(html).toContain("Platform Console");
    expect(html).toContain('href="/admin"');
    expect(html).toContain("Open Platform Console");
  });

  it("B. Normal user (isPlatformAdmin=false) does not render Platform Console", () => {
    expect(shellHtml({ isPlatformAdmin: false })).not.toContain("Platform Console");
  });

  it("B2. Flag omitted defaults to hidden", () => {
    expect(shellHtml()).not.toContain("Platform Console");
  });

  it("C. Zero organizations: Superadmin still receives Platform Console", () => {
    const html = shellHtml({ isPlatformAdmin: true, organizations: [] });
    expect(html).toContain("Platform Console");
    expect(html).toContain('href="/admin"');
  });

  it("D. Existing organization navigation remains unchanged", () => {
    const withOrgs = renderToString(
      <DashboardShell
        organizations={[{ id: "org-1", name: "Acme", slug: "acme" }]}
        primaryOrgId={null}
        isPlatformAdmin={true}
      >
        {null}
      </DashboardShell>
    );
    expect(withOrgs).toContain("Workspaces");
    expect(withOrgs).toContain("Home");
    expect(withOrgs).toContain("Log out");
    expect(withOrgs).toContain("Platform Console");

    const withoutFlag = renderToString(
      <DashboardShell
        organizations={[{ id: "org-1", name: "Acme", slug: "acme" }]}
        primaryOrgId={null}
        isPlatformAdmin={false}
      >
        {null}
      </DashboardShell>
    );
    expect(withoutFlag).toContain("Workspaces");
    expect(withoutFlag).toContain("Home");
    expect(withoutFlag).not.toContain("Platform Console");
  });

  it("E. Mobile navigation also exposes the entry when isPlatformAdmin=true", () => {
    // Desktop footer and mobile sheet footer each render the entry; both
    // share the same prop gate so neither viewport loses discoverability.
    const occurrences = shellSource.split("Platform Console").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    const mobileBlock = shellSource.slice(shellSource.indexOf("mobile-nav"));
    expect(mobileBlock).toContain("Platform Console");
    expect(mobileBlock).toContain('href={"/admin"');
    expect(mobileBlock).toContain("setMobileOpen(false)");
  });

  it("F. No client-side/email-based Superadmin detection is introduced", () => {
    // Shell stays a pure presentational gate on a server-computed boolean:
    // no auth imports, no RPC, no browser/client signals, no email checks.
    expect(shellSource).not.toMatch(/from "@\/lib\/auth\/require-super-admin"/);
    expect(shellSource).not.toMatch(/isSuperAdmin\s*\(/);
    expect(shellSource).not.toContain("requireSuperAdmin");
    expect(shellSource).not.toMatch(/localStorage/);
    expect(shellSource).not.toMatch(/@gmail|@micronest/i);
    expect(shellSource).not.toMatch(/is_super_admin/);
    expect(shellSource).not.toMatch(/\.rpc\(/);
    expect(shellSource).toContain("isPlatformAdmin");
    // Layout computes the flag server-side via the existing helper.
    expect(layoutSource).toContain("isSuperAdmin");
    expect(layoutSource).toContain("isPlatformAdmin");
    expect(layoutSource).not.toMatch(/localStorage/);
    expect(layoutSource).not.toMatch(/@gmail/i);
  });

  it("G. Entry meets target-size, focus, and non-color semantics", () => {
    const idx = shellSource.indexOf('aria-label="Open Platform Console"');
    expect(idx).toBeGreaterThan(-1);
    const entryBlock = shellSource.slice(idx, idx + 1200);
    expect(entryBlock).toContain("min-h-[44px]");
    expect(entryBlock).toContain("focus-visible:ring-2");
    // Text label + icon (ShieldCheck), not color/badge-only.
    expect(shellSource).toContain("ShieldCheck");
    expect(shellSource).toContain('aria-label="Open Platform Console"');
  });
});
