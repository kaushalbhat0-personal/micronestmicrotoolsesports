import { TOOLS } from "@/config/app/tools";
import type { Route } from "next";

export interface NavItem {
  label: string;
  href: Route;
  icon: string;
  comingSoon?: boolean;
}

export const marketingNav: { label: string; href: string; icon: string }[] = [
  { label: "Tools", href: "/#tools", icon: "Grid3x3" },
  { label: "Pricing", href: "/#pricing", icon: "CreditCard" },
  { label: "Docs", href: "/docs", icon: "BookOpen" },
];

export const dashboardNav: NavItem[] = [
  { label: "Overview", href: "/dashboard" as Route, icon: "LayoutDashboard" },
  { label: "Organizations", href: "/dashboard/organizations" as Route, icon: "Building2" },
];

/**
 * Get dashboard nav scoped to an organization slug.
 * Operations-first: Campaigns + Check History are primary workflow,
 * Creator Channels + Integrations are workspace management,
 * future tools are subordinate.
 */
export function getDashboardNav(orgSlug: string): NavItem[] {
  const comingSoonTools = TOOLS.filter((t) => t.comingSoon).map(
    (t): NavItem => ({
      label: t.name,
      href: `/dashboard/${orgSlug}/${t.slug}` as Route,
      icon: t.icon,
      comingSoon: true,
    })
  );

  return [
    { label: "Overview", href: `/dashboard/${orgSlug}` as Route, icon: "LayoutDashboard" },
    // Operations — primary
    { label: "Campaigns", href: `/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route, icon: "ShieldCheck" },
    { label: "Check History", href: `/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route, icon: "History" },
    // Workspace — channels & credentials (same route for now, distinct labels for job clarity)
    { label: "Creator Channels", href: `/dashboard/${orgSlug}/settings/integrations` as Route, icon: "Tv" },
    { label: "Integrations", href: `/dashboard/${orgSlug}/settings/integrations` as Route, icon: "Plug" },
    // Future tools — subordinate
    ...comingSoonTools,
    { label: "Organizations", href: "/dashboard/organizations" as Route, icon: "Building2" },
  ];
}
