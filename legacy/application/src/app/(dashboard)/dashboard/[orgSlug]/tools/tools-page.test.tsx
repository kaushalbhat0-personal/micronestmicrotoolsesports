import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("@/lib/auth/organization-context", () => ({
  requireOrganizationContext: vi.fn(async () => ({
    organization: { id: "org-1", name: "TAG Esports", slug: "tag-esports" },
    membership: { role: "owner" },
    user: { id: "user-1" },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));

vi.mock("@/lib/auth/get-user", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("@/server/services/billing-service", () => ({
  getBillingToolSections: vi.fn(),
}));

import WorkspaceToolsPage from "./page";
import { getBillingToolSections } from "@/server/services/billing-service";

const FREE = (badge: "Free forever" | "Free plan", allowance: string) => ({ badge, allowance, details: allowance });

async function renderPage() {
  const html = await WorkspaceToolsPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
  // React 19 SSR emits `<!-- -->` between adjacent text/expressions.
  return renderToString(html as React.ReactElement).replace(/<!-- -->/g, "");
}

describe("Workspace All Tools catalog (RCCF F4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBillingToolSections).mockResolvedValue({
      yourTools: [
        { toolSlug: "prize-splitter", displayName: "Prize Pool Splitter", description: "Split fast", icon: "Split", status: "permanent", expiresAt: null, viaAllAccess: false, viaUserGrant: false, accessKind: "free", hasPaidPlans: false, free: FREE("Free forever", "Unlimited calculations") },
      ],
      availableToAdd: [
        { toolSlug: "sponsor-sentinel", displayName: "Sponsorship Tracking", description: "Proof", icon: "ShieldCheck", monthly: null, yearly: null, free: FREE("Free plan", "1 campaign"), claimable: true },
        { toolSlug: "draft-ban", displayName: "Draft & Ban", description: "Drafts", icon: "Swords", monthly: null, yearly: null, free: FREE("Free plan", "1 completed match/month"), claimable: true },
        { toolSlug: "tie-breaker", displayName: "Tie-Breaker Resolver", description: "Settle ties", icon: "Scale", monthly: null, yearly: null, free: FREE("Free plan", "3 official results/month"), claimable: true },
        { toolSlug: "payout-tracker", displayName: "Prize Payout Tracker", description: "Payouts", icon: "ReceiptText", monthly: null, yearly: null, free: FREE("Free plan", "1 published tracker/month"), claimable: true },
        { toolSlug: "roster-builder", displayName: "Tournament Roster & Slot Builder", description: "Rosters", icon: "ClipboardList", monthly: null, yearly: null, free: FREE("Free forever", "Unlimited rosters"), claimable: true },
      ],
    } as never);
  });

  it("lists every released tool with canonical Free status — no Billing detour", async () => {
    const str = await renderPage();
    for (const name of ["Sponsorship Tracking", "Prize Pool Splitter", "Draft &amp; Ban", "Tie-Breaker Resolver", "Prize Payout Tracker", "Tournament Roster &amp; Slot Builder"]) {
      expect(str).toContain(name);
    }
    expect(str).toContain("Free forever");
    expect(str).toContain("Free plan");
    expect(str).toContain("Open Prize Pool Splitter");
    expect(str).toContain('href="/dashboard/tag-esports/prize-splitter"');
    expect(str).toContain("Start free");
    expect(str).toContain('href="/dashboard/tag-esports/draft-ban"');
  });

  it("keeps Billing as the upgrade path, not the discovery path", async () => {
    const str = await renderPage();
    expect(str).toContain("Need higher limits? View Billing");
    expect(str).toContain('href="/dashboard/tag-esports/settings/billing"');
    // No paid purchase controls on the catalog itself.
    expect(str).not.toContain("Add monthly");
    expect(str).not.toContain("Add yearly");
  });
});
