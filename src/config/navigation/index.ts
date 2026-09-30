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
 * Tools are org-scoped (/dashboard/[orgSlug]/<tool>), global items remain /dashboard/...
 */
export function getDashboardNav(orgSlug: string): NavItem[] {
  return [
    { label: "Overview", href: `/dashboard/${orgSlug}` as Route, icon: "LayoutDashboard" },
    ...TOOLS.map((t): NavItem => ({
      label: t.name,
      href: `/dashboard/${orgSlug}/${t.slug}` as Route,
      icon: t.icon,
      ...(t.comingSoon !== undefined ? { comingSoon: t.comingSoon } : {}),
    })),
    { label: "Organizations", href: "/dashboard/organizations" as Route, icon: "Building2" },
  ];
}
