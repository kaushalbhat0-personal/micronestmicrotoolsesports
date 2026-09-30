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

vi.mock("@/features/sponsor-sentinel/services/campaign-service", () => ({
  listCampaigns: vi.fn(),
}));

vi.mock("@/server/repositories/connected-channels", () => ({
  listConnectedChannelsByOrg: vi.fn(),
}));

import OrgDashboardPage from "./page";
import { listCampaigns } from "@/features/sponsor-sentinel/services/campaign-service";
import { listConnectedChannelsByOrg } from "@/server/repositories/connected-channels";

describe("Organization dashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders page header Your sponsorship operations", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("Your sponsorship operations");
    expect(str).toContain("Manage sponsorship campaigns");
  });

  it("shows empty campaigns state with create campaign link", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("No sponsorship campaigns yet");
    expect(str).toContain("Create campaign");
    expect(str).toContain("/dashboard/tag-esports/sponsor-sentinel/campaigns/new");
  });

  it("shows campaign summary with StatusBadge when campaigns exist", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([
      { id: "c1", name: "Spring Sponsor 2026", description: "Desc", status: "draft", starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-30T00:00:00Z" },
    ] as never);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("Spring Sponsor 2026");
    // StatusBadge maps draft → Setup
    expect(str).toContain("Setup");
    expect(str).toContain("/dashboard/tag-esports/sponsor-sentinel/campaigns/c1");
  });

  it("shows no-channel state with connect link", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("No creator channels connected");
    expect(str).toContain("Connect a channel");
    expect(str).toContain("/dashboard/tag-esports/settings/integrations");
  });

  it("shows creator channels when connected", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([
      { id: "ch1", platform: "youtube", external_handle: "@Handle", display_name: "Handle", canonical_url: "https://youtube.com/channel/UC1", connection_status: "connected" },
    ] as never);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("Handle");
    expect(str).toContain("Manage channels");
    expect(str).toContain("youtube");
  });

  it("has correct links for view campaigns and create", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    expect(str).toContain("/dashboard/tag-esports/sponsor-sentinel/campaigns");
    expect(str).toContain("/dashboard/tag-esports/settings/integrations");
  });

  it("uses StatusBadge not raw status", async () => {
    vi.mocked(listCampaigns).mockResolvedValue([{ id: "c1", name: "Test", status: "active", starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-30T00:00:00Z" } as never]);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([]);
    const html = await OrgDashboardPage({ params: Promise.resolve({ orgSlug: "tag-esports" }) } as never);
    const str = renderToString(html as React.ReactElement);
    // active → Tracking
    expect(str).toContain("Tracking");
    expect(str).not.toContain(">active<");
  });
});
