import { DashboardShell } from "@/components/layout/dashboard-shell";

const mockOrgs = [{ id: "9790375e-5ebb-4bab-b8a4-e36e8f7f7381", name: "TAG Esports", slug: "tag-esports" }];

// Mock entitlement-aware data — mirrors real getWorkspaceTools for TAG Esports (sponsor-sentinel entitled)
const workspaceToolsBySlug = {
  "tag-esports": {
    entitled: [
      {
        slug: "sponsor-sentinel",
        name: "Sponsorship Tracking",
        internalSlug: "sponsor-sentinel",
        description: "Proof-of-performance for sponsors",
        icon: "ShieldCheck",
        href: "/dashboard/tag-esports/sponsor-sentinel/campaigns",
        entitled: true,
        comingSoon: false,
        subItems: [
          { label: "Campaigns", href: "/dashboard/tag-esports/sponsor-sentinel/campaigns", icon: "ShieldCheck" },
          { label: "Checks", href: "/dashboard/tag-esports/sponsor-sentinel/scans", icon: "History" },
        ],
      },
    ],
    available: [
      { slug: "scrim-matchmaker", name: "Scrim Matchmaker", internalSlug: "scrim-matchmaker", description: "Cross-timezone scrim", icon: "CalendarSearch", href: "/dashboard/tag-esports/scrim-matchmaker", entitled: false, comingSoon: true },
      { slug: "prize-splitter", name: "Prize Pool Splitter", internalSlug: "prize-splitter", description: "Prize pool", icon: "Split", href: "/dashboard/tag-esports/prize-splitter", entitled: false, comingSoon: false },
      { slug: "vod-clipper", name: "VOD Clipper", internalSlug: "vod-clipper", description: "Clip VODs", icon: "Scissors", href: "/dashboard/tag-esports/vod-clipper", entitled: false, comingSoon: true },
      { slug: "roster-sentinel", name: "Roster Sentinel", internalSlug: "roster-sentinel", description: "Visa & contracts", icon: "FileCheck", href: "/dashboard/tag-esports/roster-sentinel", entitled: false, comingSoon: true },
    ],
  },
} as never;

export default function EntitlementPreview() {
  return (
    <DashboardShell organizations={mockOrgs} workspaceToolsBySlug={workspaceToolsBySlug}>
      <div className="space-y-4">
        <h1 className="font-display text-[24px]">Entitlement-aware preview — TAG Esports</h1>
        <p className="text-sm text-muted-foreground">YOUR TOOLS shows Sponsorship Tracking (entitled) with Campaigns/Checks subnav. MORE TOOLS shows 4 discovery items muted with Soon.</p>
        <p className="text-xs text-muted-foreground">Resize to 390 to verify drawer preserves groups and active state.</p>
      </div>
    </DashboardShell>
  );
}
