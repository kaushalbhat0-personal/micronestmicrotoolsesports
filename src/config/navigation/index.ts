import { TOOLS } from "@/config/app/tools";
import type { Route } from "next";

export interface NavItem {
  label: string;
  href: Route;
  icon: string;
  comingSoon?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const marketingNav: { label: string; href: string; icon: string }[] = [
  { label: "Tools", href: "/tools", icon: "Grid3x3" },
  { label: "Pricing", href: "/pricing", icon: "CreditCard" },
  { label: "Docs", href: "/docs", icon: "BookOpen" },
];

export const dashboardNav: NavItem[] = [
  { label: "Overview", href: "/dashboard" as Route, icon: "LayoutDashboard" },
  { label: "Workspaces", href: "/dashboard/organizations" as Route, icon: "Building2" },
];

/**
 * Workspace IA — RCCF-UIUX-03
 * Workspace (Overview/Campaigns/Checks) / Creators (Channels/Connections) / Settings
 * Proof is NOT top-level — lives under Campaign → Proof.
 * Channels vs Connections are distinct: channels = creator identities, connections = platform auth.
 */
export function getDashboardNav(orgSlug: string): NavItem[] {
  const comingSoonTools = TOOLS.filter((t) => t.comingSoon).map(
    (t): NavItem => ({
      label: t.name,
      // Coming-Soon items must never expose a live route href (RCCF-SPONSOR-FINAL-02).
      // "#" is the repository's safe non-navigation target (see dashboard-shell).
      href: "#" as Route,
      icon: t.icon,
      comingSoon: true,
    })
  );

  return [
    { label: "Overview", href: `/dashboard/${orgSlug}` as Route, icon: "LayoutDashboard" },
    { label: "Campaigns", href: `/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route, icon: "ShieldCheck" },
    { label: "Checks", href: `/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route, icon: "History" },
    { label: "Channels", href: `/dashboard/${orgSlug}/channels` as Route, icon: "Tv" },
    { label: "Connections", href: `/dashboard/${orgSlug}/connections` as Route, icon: "Plug" },
    { label: "Settings", href: `/dashboard/${orgSlug}/settings` as Route, icon: "Settings2" },
    ...comingSoonTools,
    { label: "Workspaces", href: "/dashboard/organizations" as Route, icon: "Building2" },
  ];
}

export function getDashboardNavGroups(orgSlug: string): NavGroup[] {
  const nav = getDashboardNav(orgSlug);
  const byLabel = new Map<string, NavItem | undefined>(nav.map((n) => [n.label, n] as const));
  const coming = nav.filter((n) => n.comingSoon);
  return [
    {
      label: "Workspace",
      items: [byLabel.get("Overview"), byLabel.get("Campaigns"), byLabel.get("Checks")].filter(Boolean) as NavItem[],
    },
    {
      label: "Creators",
      items: [byLabel.get("Channels"), byLabel.get("Connections")].filter(Boolean) as NavItem[],
    },
    {
      label: "Settings",
      items: [byLabel.get("Settings")].filter(Boolean) as NavItem[],
    },
    ...(coming.length > 0 ? [{ label: "Coming soon", items: coming }] : []),
    {
      label: "",
      items: [byLabel.get("Workspaces")].filter(Boolean) as NavItem[],
    },
  ];
}

/**
 * Legacy Coming-Soon link behavior (RCCF-SPONSOR-FINAL-02).
 * Mirrors the newer disabled implementation in dashboard-shell:
 * safe non-navigation target, aria-disabled semantics, and activation
 * must be suppressed (preventDefault). Pure helper so it is unit-testable.
 */
export function getLegacyNavLinkProps(item: NavItem): {
  href: Route;
  ariaDisabled: true | undefined;
  shouldPreventDefault: boolean;
} {
  if (item.comingSoon) {
    return { href: "#" as Route, ariaDisabled: true, shouldPreventDefault: true };
  }
  return { href: item.href, ariaDisabled: undefined, shouldPreventDefault: false };
}
