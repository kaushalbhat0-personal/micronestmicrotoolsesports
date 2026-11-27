import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  formatActivityDate,
  getWorkspaceRecentActivity,
  getWorkspaceSponsorshipStrip,
} from "./workspace-activity";

vi.mock("@/features/sponsor-sentinel/services/campaign-service", () => ({
  listCampaigns: vi.fn(),
}));
vi.mock("@/features/sponsor-sentinel/services/scan-history", () => ({
  getScanHistory: vi.fn(),
}));
vi.mock("@/server/repositories/connected-channels", () => ({
  listConnectedChannelsByOrg: vi.fn(),
}));
vi.mock("@/features/tie-breaker/services/history", () => ({
  getHistory: vi.fn(),
}));
vi.mock("@/features/draft-ban/services/match-service", () => ({
  getHistory: vi.fn(),
}));
vi.mock("@/features/payout-tracker/services/tracker-service", () => ({
  listTrackers: vi.fn(),
}));
vi.mock("@/server/services/tie-breaker-policy", () => ({
  resolveTieBreakerAccessLevel: vi.fn(async () => "free"),
}));
vi.mock("@/server/services/draft-ban-policy", () => ({
  resolveDraftBanAccessLevel: vi.fn(async () => "paid"),
}));

import { listCampaigns } from "@/features/sponsor-sentinel/services/campaign-service";
import { getScanHistory } from "@/features/sponsor-sentinel/services/scan-history";
import { listConnectedChannelsByOrg } from "@/server/repositories/connected-channels";
import { getHistory as getTieHistory } from "@/features/tie-breaker/services/history";
import { getHistory as getDraftHistory } from "@/features/draft-ban/services/match-service";
import { listTrackers } from "@/features/payout-tracker/services/tracker-service";

const SUPABASE = {} as never;

describe("workspace activity composer (RCCF F3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTieHistory).mockResolvedValue({
      competitions: [
        {
          id: "c1",
          name: "Group A",
          status: "locked",
          record_number: "TB-1",
          updated_at: "2026-10-12T10:00:00Z",
        },
      ],
      total: 1,
    } as never);
    vi.mocked(getDraftHistory).mockResolvedValue({
      matches: [
        {
          id: "m1",
          match_name: null,
          team_a: "Falcons",
          team_b: "Wolves",
          status: "in_progress",
          updated_at: "2026-10-13T10:00:00Z",
        },
      ],
      total: 1,
      completedTotal: 0,
    } as never);
    vi.mocked(listTrackers).mockResolvedValue({
      summaries: [
        {
          tracker: {
            id: "t1",
            event_name: "Cup",
            status: "published",
            updated_at: "2026-10-11T10:00:00Z",
          },
          paidCount: 1,
          totalCount: 3,
          totalMinor: 300,
          paidMinor: 100,
        },
      ],
      level: "free",
    } as never);
    vi.mocked(listCampaigns).mockResolvedValue([
      { id: "camp1", name: "Sponsor", status: "active" },
      { id: "camp2", name: "Old", status: "completed" },
    ] as never);
    vi.mocked(listConnectedChannelsByOrg).mockResolvedValue([
      { connection_status: "connected" },
      { connection_status: "expired" },
    ] as never);
    vi.mocked(getScanHistory).mockResolvedValue({
      scans: [{ scan: { started_at: "2026-10-13T08:00:00Z", platform: "twitch" } }],
      total: 1,
    } as never);
  });

  it("merges activity newest-first with workspace deep links", async () => {
    const items = await getWorkspaceRecentActivity(SUPABASE, "acme", "org-1");
    expect(items.map((i) => i.title)).toEqual(["Falcons vs Wolves", "Group A", "Cup"]);
    expect(items[0]).toMatchObject({ kind: "match", href: "/dashboard/acme/draft-ban/m1" });
    expect(items[1]).toMatchObject({
      kind: "competition",
      detail: "Locked · TB-1",
      href: "/dashboard/acme/tie-breaker/c1",
    });
    expect(items[2]).toMatchObject({ kind: "tracker", detail: "published · 1/3 paid" });
  });

  it("one broken source never breaks the feed", async () => {
    vi.mocked(getTieHistory).mockRejectedValue(new Error("db down"));
    vi.mocked(listTrackers).mockRejectedValue(new Error("db down"));
    const items = await getWorkspaceRecentActivity(SUPABASE, "acme", "org-1");
    expect(items.map((i) => i.title)).toEqual(["Falcons vs Wolves"]);
  });

  it("builds the compact sponsorship strip", async () => {
    const strip = await getWorkspaceSponsorshipStrip(SUPABASE, "org-1");
    expect(strip).toEqual({
      campaignsTotal: 2,
      activeCampaigns: 1,
      connectedChannels: 1,
      lastCheckAt: "2026-10-13T08:00:00Z",
      lastCheckPlatform: "twitch",
    });
  });

  it("formats activity dates in en-GB", () => {
    expect(formatActivityDate("2026-10-13T08:00:00Z")).toContain("2026");
  });
});
