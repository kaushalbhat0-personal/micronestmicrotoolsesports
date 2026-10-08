import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { BillingClient } from "./billing-client";

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) };
});

describe("BillingClient", () => {
  it("renders Your Tools with permanent and finite access", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[
          { toolSlug: "sponsor-sentinel", displayName: "Sponsorship Tracking", description: "Test", isAllAccess: false, source: "manual", expiresAt: null, status: "permanent" },
          { toolSlug: "prize-splitter", displayName: "Prize Pool Splitter", description: "Test", isAllAccess: false, source: "subscription", expiresAt: new Date(Date.now() + 86400000 * 10).toISOString(), status: "active" },
        ]}
        yourTools={[
          { toolSlug: "sponsor-sentinel", displayName: "Sponsorship Tracking", description: "Test", icon: "ShieldCheck", status: "permanent", expiresAt: null, viaAllAccess: false, viaUserGrant: false },
          { toolSlug: "prize-splitter", displayName: "Prize Pool Splitter", description: "Test", icon: "Split", status: "active", expiresAt: new Date(Date.now() + 86400000 * 10).toISOString(), viaAllAccess: false, viaUserGrant: false },
        ]}
        availableToAdd={[]}
        plans={[
          { id: "plan-1", name: "Sponsorship Tracking — Monthly", slug: "sponsorship-tracking-monthly", billing_period: "monthly", amount_minor: 149900, currency: "INR", tool_id: "tool-1" } as never,
        ]}
        history={[
          { id: "order-1", date: "2026-10-05T00:00:00Z", planName: "Sponsorship Tracking — Monthly", planSlug: "sponsorship-tracking-monthly", billingPeriod: "monthly", amountMinor: 149900, currency: "INR", status: "paid", razorpayPaymentId: "pay_123" },
        ]}
        currentPlan={{ id: "plan-1", name: "Sponsorship Tracking — Monthly", slug: "sponsorship-tracking-monthly", billing_period: "monthly", amount_minor: 149900, currency: "INR", tool_id: "tool-1" } as never}
      />
    );
    expect(html).toContain("Your Tools");
    expect(html).toContain("Sponsorship Tracking");
    expect(html).toContain("Permanent access");
    expect(html).toContain("Active until");
    expect(html).toContain("Billing History");
    expect(html.toLowerCase()).toContain("paid");
  });

  it("renders Available to Add with catalog prices and purchase CTA", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[]}
        yourTools={[]}
        availableToAdd={[
          { toolSlug: "draft-ban", displayName: "Draft & Ban", description: "Test desc", icon: "Swords", monthly: { planId: "plan-m", amountMinor: 9900, currency: "INR" }, yearly: { planId: "plan-y", amountMinor: 99000, currency: "INR" } },
        ]}
        plans={[]}
        history={[]}
        currentPlan={null}
      />
    );
    expect(html).toContain("Available to Add");
    expect(html).toContain("Draft &amp; Ban");
    expect(html).toContain("Add another tool to this workspace.");
    // Prices from catalog data, CTA per period reusing checkout.
    // (React SSR inserts comments between text nodes, so assert fragments.)
    expect(html).toContain("Add ");
    expect(html).toContain("monthly");
    expect(html).toContain("yearly");
    expect(html).toContain("₹99");
    expect(html).not.toContain("249900");
    expect(html).not.toContain("₹2,499");
  });

  it("shows no paid plan state", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[]}
        yourTools={[]}
        availableToAdd={[]}
        plans={[]}
        history={[]}
        currentPlan={null}
      />
    );
    expect(html).toContain("No paid plan");
  });

  it("billing history does not expose secrets", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[]}
        yourTools={[]}
        availableToAdd={[]}
        plans={[]}
        history={[
          { id: "order-1", date: "2026-10-05T00:00:00Z", planName: "Test", planSlug: "test", billingPeriod: "monthly", amountMinor: 100, currency: "INR", status: "paid", razorpayPaymentId: "pay_123" },
        ]}
        currentPlan={null}
      />
    );
    expect(html).not.toContain("RAZORPAY");
    expect(html).not.toContain("signature");
    expect(html).not.toContain("webhook");
  });

  it("mobile rendering — no horizontal overflow", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[
          { toolSlug: "sponsor-sentinel", displayName: "Sponsorship Tracking", description: "", isAllAccess: false, source: "manual", expiresAt: null, status: "permanent" },
        ]}
        yourTools={[
          { toolSlug: "sponsor-sentinel", displayName: "Sponsorship Tracking", description: "", icon: "ShieldCheck", status: "permanent", expiresAt: null, viaAllAccess: false, viaUserGrant: false },
        ]}
        availableToAdd={[]}
        plans={[
          { id: "plan-1", name: "Test", slug: "test-monthly", billing_period: "monthly", amount_minor: 100, currency: "INR", tool_id: "tool-1" } as never,
          { id: "plan-2", name: "Test Yearly", slug: "test-yearly", billing_period: "yearly", amount_minor: 1000, currency: "INR", tool_id: "tool-1" } as never,
        ]}
        history={[]}
        currentPlan={null}
      />
    );
    // Should contain responsive grid classes
    expect(html).toContain("sm:grid-cols-2");
  });

  it("All Access-derived tools indicate inclusion without a fake standalone card", () => {    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[]}
        yourTools={[
          { toolSlug: "sponsor-sentinel", displayName: "Sponsorship Tracking", description: "Test", icon: "ShieldCheck", status: "active", expiresAt: new Date(Date.now() + 86400000 * 10).toISOString(), viaAllAccess: true, viaUserGrant: false },
        ]}
        availableToAdd={[]}
        plans={[]}
        history={[]}
        currentPlan={null}
      />
    );
    expect(html).toContain("Included with All Access");
    expect(html).toContain("Active until");
  });

  it("user-grant Sponsorship card renders under Your Tools with provenance and no CTA", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[]}
        yourTools={[
          { toolSlug: "sponsor-sentinel", displayName: "Sponsorship Tracking", description: "Test", icon: "ShieldCheck", status: "active", expiresAt: new Date(Date.now() + 86400000 * 10).toISOString(), viaAllAccess: false, viaUserGrant: true },
        ]}
        availableToAdd={[]}
        plans={[]}
        history={[]}
        currentPlan={null}
      />
    );
    expect(html).toContain("Your Tools");
    expect(html).toContain("Sponsorship Tracking");
    expect(html).toContain("Included with your Sponsorship access");
    // No purchase CTA for the covered tool (SSR inserts comments between text nodes).
    expect(html).not.toMatch(/Add(\s|<!-- -->|&nbsp;)*monthly/);
    expect(html).not.toMatch(/Add(\s|<!-- -->|&nbsp;)*yearly/);
  });

  it("uncovered Sponsorship still renders purchase CTA", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[]}
        yourTools={[]}
        availableToAdd={[
          { toolSlug: "sponsor-sentinel", displayName: "Sponsorship Tracking", description: "Test", icon: "ShieldCheck", monthly: { planId: "p1", amountMinor: 149900, currency: "INR" }, yearly: null },
        ]}
        plans={[]}
        history={[]}
        currentPlan={null}
      />
    );
    expect(html).toContain("Available to Add");
    expect(html).toContain("Sponsorship Tracking");
  });

  it("purchase targets the current workspace org and reuses a single checkout path", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/features/billing/components/billing-client.tsx"), "utf8");
    // Single checkout path posting the trusted workspace org prop.
    expect(src).toMatch(/body: JSON\.stringify\(\{ planId, organizationId \}\)/);
    expect(src.match(/handleCheckout\(/g)!.length).toBeGreaterThan(0);
    // No hardcoded prices anywhere in the client.
    expect(src).not.toMatch(/₹2,499|₹24,990/);
    expect(src).not.toMatch(/249900|149900|69900/);
  });
});
