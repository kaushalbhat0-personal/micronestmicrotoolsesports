import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { BillingClient } from "./billing-client";

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) };
});

describe("BillingClient", () => {
  it("renders current access with permanent and finite", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[
          { toolSlug: "sponsor-sentinel", displayName: "Sponsorship Tracking", description: "Test", isAllAccess: false, source: "manual", expiresAt: null, status: "permanent" },
          { toolSlug: "prize-splitter", displayName: "Prize Pool Splitter", description: "Test", isAllAccess: false, source: "subscription", expiresAt: new Date(Date.now() + 86400000 * 10).toISOString(), status: "active" },
        ]}
        plans={[
          { id: "plan-1", name: "Sponsorship Tracking — Monthly", slug: "sponsorship-tracking-monthly", billing_period: "monthly", amount_minor: 149900, currency: "INR", tool_id: "tool-1" } as never,
        ]}
        history={[
          { id: "order-1", date: "2026-10-05T00:00:00Z", planName: "Sponsorship Tracking — Monthly", planSlug: "sponsorship-tracking-monthly", billingPeriod: "monthly", amountMinor: 149900, currency: "INR", status: "paid", razorpayPaymentId: "pay_123" },
        ]}
        currentPlan={{ id: "plan-1", name: "Sponsorship Tracking — Monthly", slug: "sponsorship-tracking-monthly", billing_period: "monthly", amount_minor: 149900, currency: "INR", tool_id: "tool-1" } as never}
      />
    );
    expect(html).toContain("Sponsorship Tracking");
    expect(html).toContain("Permanent access");
    expect(html).toContain("Active until");
    expect(html).toContain("Billing History");
    expect(html.toLowerCase()).toContain("paid");
  });

  it("shows no paid plan state", () => {
    const html = renderToString(
      <BillingClient
        organizationId="org-a"
        organizationSlug="test-org"
        entitlements={[]}
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
});
