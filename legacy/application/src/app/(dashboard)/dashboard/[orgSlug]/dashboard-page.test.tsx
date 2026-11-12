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

vi.mock("@/server/billing/plan-context", () => ({
  getPlanContext: vi.fn(async () => null),
}));

vi.mock("@/lib/auth/require-entitlement", () => ({
  getAccessibleToolSlugs: vi.fn(async () => [] as string[]),
}));

vi.mock("@/server/services/billing-service", () => ({
  getBillingToolSections: vi.fn(),
}));

vi.mock("@/server/services/workspace-activity", () => ({
  formatActivityDate: (iso: string) => iso,
  getWorkspaceRecentActivity: vi.fn(),
  getWorkspaceSponsorshipStrip: vi.fn(),
}));

import OrgDashboardPage from "./page";
import { getBillingToolSections } from "@/server/services/billing-service";
import { getWorkspaceRecentActivity, getWorkspaceSponsorshipStrip } from "@/server/services/workspace-activity";

async function renderPage() {
  const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
  // React 19 SSR emits `<!-- -->` between adjacent text/expressions.
  return renderToString(html as React.ReactElement).replace(/<!-- -->/g, "");
}

const FREE = (badge: "Free forever" | "Free plan", allowance: string) => ({ badge, allowance, details: allowance });

function sections() {
  return {
    yourTools: [
      { toolSlug: "prize-splitter", displayName: "Prize Pool Splitter", description: "Split fast", icon: "Split", status: "permanent", expiresAt: null, viaAllAccess: false, viaUserGrant: false, accessKind: "free", hasPaidPlans: false, free: FREE("Free forever", "Unlimited calculations") },
      { toolSlug: "tie-breaker", displayName: "Tie-Breaker Resolver", description: "Settle ties", icon: "Scale", status: "permanent", expiresAt: null, viaAllAccess: false, viaUserGrant: false, accessKind: "free", hasPaidPlans: true, free: FREE("Free plan", "3 official results/month") },
    ],
    availableToAdd: [
      { toolSlug: "sponsor-sentinel", displayName: "Sponsorship Tracking", description: "Proof", icon: "ShieldCheck", monthly: null, yearly: null, free: FREE("Free plan", "1 campaign"), claimable: true },
      { toolSlug: "draft-ban", displayName: "Draft & Ban", description: "Drafts", icon: "Swords", monthly: null, yearly: null, free: FREE("Free plan", "1 completed match/month"), claimable: true },
      { toolSlug: "payout-tracker", displayName: "Prize Payout Tracker", description: "Payouts", icon: "ReceiptText", monthly: null, yearly: null, free: FREE("Free plan", "1 published tracker/month"), claimable: true },
      { toolSlug: "roster-builder", displayName: "Tournament Roster & Slot Builder", description: "Rosters", icon: "ClipboardList", monthly: null, yearly: null, free: FREE("Free forever", "Unlimited rosters"), claimable: true },
    ],
  };
}

const STRIP = {
  campaignsTotal: 2,
  activeCampaigns: 1,
  connectedChannels: 1,
  lastCheckAt: "2026-10-12T00:00:00Z",
  lastCheckPlatform: "twitch",
};

describe("Toolbox workspace home (RCCF F3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBillingToolSections).mockResolvedValue(sections() as never);
    vi.mocked(getWorkspaceRecentActivity).mockResolvedValue([]);
    vi.mocked(getWorkspaceSponsorshipStrip).mockResolvedValue({ ...STRIP });
  });

  it("answers what the user can use here — no sponsorship-dominated headline", async () => {
    const str = await renderPage();
    expect(str).toContain("TAG Esports");
    expect(str).toContain("What can you use here?");
    expect(str).not.toContain("Sponsorship tracking at a glance");
    expect(str).not.toContain("Needs Attention");
  });

  it("shows all six released tools with canonical Free status", async () => {
    const str = await renderPage();
    for (const name of ["Prize Pool Splitter", "Tie-Breaker Resolver", "Sponsorship Tracking", "Draft &amp; Ban", "Prize Payout Tracker", "Tournament Roster &amp; Slot Builder"]) {
      expect(str).toContain(name);
    }
    expect(str).toContain("Free forever");
    expect(str).toContain("Free plan");
    expect(str).toContain("Unlimited calculations");
    expect(str).toContain("3 official results/month");
  });

  it("routes entitled tools to Open and claimable tools to Start free", async () => {
    const str = await renderPage();
    expect(str).toContain("/dashboard/tag-esports/prize-splitter");
    expect(str).toContain("Open Prize Pool Splitter");
    expect(str).toContain("/dashboard/tag-esports/roster-builder");
    expect(str).toContain("Start free");
  });

  it("shows empty activity guidance when no recent work exists", async () => {
    const str = await renderPage();
    expect(str).toContain("Recent activity");
    expect(str).toContain("Nothing here yet");
  });

  it("renders recent activity items with deep links", async () => {
    vi.mocked(getWorkspaceRecentActivity).mockResolvedValue([
      { kind: "competition", title: "Group A Final", detail: "Locked · TB-2026-1", href: "/dashboard/tag-esports/tie-breaker/c1", at: "2026-10-12T00:00:00Z" },
      { kind: "tracker", title: "Cup Payouts", detail: "published · 1/3 paid", href: "/dashboard/tag-esports/payout-tracker/t1", at: "2026-10-11T00:00:00Z" },
    ] as never);
    const str = await renderPage();
    expect(str).toContain("Group A Final");
    expect(str).toContain("Cup Payouts");
    expect(str).toContain("/dashboard/tag-esports/tie-breaker/c1");
    expect(str).not.toContain("Nothing here yet");
  });

  it("keeps a compact sponsorship presence linking into Sponsorship Tracking", async () => {
    const str = await renderPage();
    expect(str).toContain("1 of 2 campaigns active");
    expect(str).toContain("1 channels connected");
    expect(str).toContain("/dashboard/tag-esports/sponsor-sentinel/campaigns");
  });
});
