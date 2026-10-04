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
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
          in: () => Promise.resolve({ data: [], error: null }),
          gte: () => ({
            lt: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        in: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  })),
}));

vi.mock("@/features/sponsor-sentinel/services/campaign-service", () => ({
  listCampaigns: vi.fn(),
}));

vi.mock("@/server/repositories/connected-channels", () => ({
  listConnectedChannelsByOrg: vi.fn(),
}));

vi.mock("@/features/sponsor-sentinel/services/scan-history", () => ({
  getScanHistory: vi.fn(async () => ({ scans: [], total: 0 })),
}));

import OrgDashboardPage from "./page";
import { listCampaigns } from "@/features/sponsor-sentinel/services/campaign-service";
import { listConnectedChannelsByOrg } from "@/server/repositories/connected-channels";
import { getScanHistory } from "@/features/sponsor-sentinel/services/scan-history";

describe("Organization dashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders workspace greeting", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    vi.mocked(getScanHistory).mockResolvedValue({ scans: [], total: 0 } as never);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("TAG Esports");
    expect(str).toContain("Sponsorship tracking at a glance");
  });

  it("shows hero metrics", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    vi.mocked(getScanHistory).mockResolvedValue({ scans: [], total: 0 } as never);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("Campaigns tracking");
    expect(str).toContain("Connected channels");
    expect(str).toContain("Proof found today");
  });

  it("shows Needs Attention when empty", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    vi.mocked(getScanHistory).mockResolvedValue({ scans: [], total: 0 } as never);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("Needs Attention");
  });

  it("shows empty campaigns state with create campaign link", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    vi.mocked(getScanHistory).mockResolvedValue({ scans: [], total: 0 } as never);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("No campaigns yet");
    expect(str).toContain("/dashboard/tag-esports/sponsor-sentinel/campaigns/new");
  });

  it("shows campaign summary with StatusBadge when campaigns exist", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([
      { id: "c1", name: "Spring Sponsor 2026", description: "Desc", status: "draft", starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-30T00:00:00Z" },
    ] as never);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    vi.mocked(getScanHistory).mockResolvedValue({ scans: [], total: 0 } as never);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("Spring Sponsor 2026");
    expect(str).toContain("Setup");
    expect(str).toContain("/dashboard/tag-esports/sponsor-sentinel/campaigns/c1");
  });

  it("shows Recent Proof empty with sparkles", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    vi.mocked(getScanHistory).mockResolvedValue({ scans: [], total: 0 } as never);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("Recent Proof");
    // Recent Proof is now streamed via Suspense; initial render shows skeleton fallback
    expect(str).toMatch(/No proof yet|animate-pulse/);
  });

  it("shows Recent Checks section", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    vi.mocked(getScanHistory).mockResolvedValue({ scans: [], total: 0 } as never);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("Recent Checks");
  });

  it("uses StatusBadge not raw status", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([{ id: "c1", name: "Test", status: "active", starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-30T00:00:00Z" } as never]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    vi.mocked(getScanHistory).mockResolvedValue({ scans: [], total: 0 } as never);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("Tracking");
    expect(str).not.toContain(">active<");
  });
});
