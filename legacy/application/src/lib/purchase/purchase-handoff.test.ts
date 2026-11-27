import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function src(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("purchase handoff + customer language — RCCF-PLATFORM-EDUCATION-03", () => {
  it("access-denied errors never interpolate internal tool slugs", () => {
    const content = src("src/lib/auth/require-entitlement.ts");
    expect(content).not.toMatch(/entitlementError\(`[^`]*\$\{toolSlug\}/);
    expect(content).not.toContain("Unknown tool:");
    expect(content).toContain("isn't active for your workspace");
  });

  it("dashboard error boundary offers plan and billing actions", () => {
    const content = src("src/app/(dashboard)/error.tsx");
    expect(content).toContain("View plans");
    expect(content).toContain("Open Billing");
    expect(content).not.toMatch(/prize-splitter|sponsor-sentinel|draft-ban|entitlement/i);
  });

  it("signup and login preserve validated plan context", () => {
    expect(src("src/app/(auth)/signup/page.tsx")).toContain("getPlanContext");
    expect(src("src/app/(auth)/signup/signup-form.tsx")).toContain("getting started with");
    expect(src("src/app/(auth)/login/page.tsx")).toContain("getPlanContext");
    expect(src("src/app/(dashboard)/dashboard/organizations/new/page.tsx")).toContain("?plan=");
  });

  it("post-payment success names the tool and links to it (no bare reload)", () => {
    const content = src("src/features/billing/components/billing-client.tsx");
    expect(content).toContain("access is ready.");
    expect(content).toContain("Back to Billing");
    expect(content).not.toContain("window.location.reload()");
  });

  it("draft-ban product fragment renders a static sample (never empty)", () => {
    const fragment = src("src/components/marketing/product-fragment.tsx");
    expect(fragment).toContain("draft-ban");
    expect(fragment).toContain("Record no. DB-2026-00042");
    const page = src("src/app/tools/[slug]/page.tsx");
    expect(page).toContain("Sample record — illustrative example");
    expect(page).toContain("What you need");
    expect(page).toContain("What you get");
  });

  it("customer UI avoids internal access-system wording", () => {
    expect(src("src/components/layout/dashboard-shell.tsx")).not.toContain("No tools entitled");
    expect(src("src/features/billing/components/billing-client.tsx")).not.toContain("No active entitlements.");
    expect(src("src/app/pricing/pricing-client.tsx")).not.toContain("workspace entitlement");
    expect(src("src/app/pricing/pricing-client.tsx")).not.toContain("Plan: {plan.slug}");
    expect(src("src/config/app/tools.ts")).not.toContain('name: "Sponsor Sentinel"');
  });

  it("record-number replaces reference-ID in customer UI", () => {
    expect(src("src/features/draft-ban/components/match-history-list.tsx")).toContain("Record no.");
    expect(src("src/features/draft-ban/services/share-text.ts")).toContain("Record no.:");
    expect(src("src/features/draft-ban/components/result-card.tsx")).toContain("Record no.:");
    expect(src("src/config/marketing/tools.ts")).not.toContain("reference IDs");
  });

  it("privacy heading avoids protocol jargon while keeping literal Google disclosure", () => {
    const content = src("src/app/privacy/page.tsx");
    expect(content).toContain("YouTube connection — permission requested");
    expect(content).not.toContain("YouTube OAuth — scope requested");
    // Literal endpoint/scope strings required for compliance stay exact
    expect(content).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(content).toContain("https://www.googleapis.com/auth/youtube.readonly");
  });

  it("all-access states the at-purchase-time policy without promising future tools", () => {
    const pricing = src("src/app/pricing/pricing-client.tsx");
    expect(pricing).toContain("All Access covers only the tools available at the time of purchase");
    expect(pricing).toContain("future tools are not automatically included");
    const billing = src("src/features/billing/components/billing-client.tsx");
    expect(billing).toContain("Covers only the tools available at the time of purchase");
    expect(billing).not.toContain("future tools are included");
  });
});
