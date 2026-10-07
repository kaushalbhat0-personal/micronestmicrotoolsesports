import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { BillingClient } from "./billing-client";

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) };
});

const basePlans = [
  { id: "plan-monthly", name: "Sponsorship Tracking — Monthly", slug: "sponsorship-tracking-monthly", billing_period: "monthly", amount_minor: 149900, currency: "INR", tool_id: "tool-1" },
  { id: "plan-yearly", name: "Sponsorship Tracking — Yearly", slug: "sponsorship-tracking-yearly", billing_period: "yearly", amount_minor: 1499000, currency: "INR", tool_id: "tool-1" },
  { id: "plan-all-monthly", name: "All Access — Monthly", slug: "all-access-monthly", billing_period: "monthly", amount_minor: 249900, currency: "INR", tool_id: null },
] as never[];

describe("BillingClient pre-checkout disclosure", () => {
  it("displays plan, billing period, amount, currency, workspace, manual renewal and legal links before payment", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        organizationName="TAG Esports"
        entitlements={[]}
        plans={basePlans}
        history={[]}
        currentPlan={null}
        hintedPlanSlug="sponsorship-tracking-monthly"
      />
    );
    // Workspace visible
    expect(html).toContain("TAG Esports");
    // Plan name, billing period, amount, currency
    expect(html).toContain("Sponsorship Tracking");
    expect(html).toContain("Monthly");
    expect(html).toContain("1,499");
    expect(html).toContain("INR");
    // Billing period clarity
    expect(html).toContain("/ month");
    // Workspace label
    expect(html).toContain("Workspace");
    // Manual renewal
    expect(html).toContain("Manual renewal only");
    expect(html).toContain("No automatic renewal");
    // Refund disclosure
    expect(html).toContain("non-refundable");
    // Legal links
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/refund"');
    // Payment CTA with amount
    expect(html).toContain("Pay");
    expect(html).toContain("Continue to payment");
  });

  it("does not contain auto-renew language", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[]}
        plans={basePlans}
        history={[]}
        currentPlan={null}
        hintedPlanSlug="sponsorship-tracking-monthly"
      />
    );
    expect(html).not.toContain("Renews until cancelled");
    expect(html).not.toContain("renews until cancelled");
    expect(html.toLowerCase()).not.toContain("auto-renew");
    expect(html.toLowerCase()).not.toContain("recurring mandate");
  });

  it("shows purchase summary when plan selected via hint", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[]}
        plans={basePlans}
        history={[]}
        currentPlan={null}
        hintedPlanSlug="all-access-monthly"
      />
    );
    expect(html).toContain("Purchase summary");
    expect(html).toContain("All Access");
  });

  it("hinted plan resolves authoritatively — unknown slug yields no summary", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[]}
        plans={basePlans}
        history={[]}
        currentPlan={null}
        hintedPlanSlug="nonexistent-plan"
      />
    );
    expect(html).not.toContain("Purchase summary");
  });

  it("checkout button shows pay amount when plan selected", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[]}
        plans={basePlans}
        history={[]}
        currentPlan={null}
        hintedPlanSlug="sponsorship-tracking-yearly"
      />
    );
    expect(html).toContain("14,990");
  });
});
