"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { getDashboardNavGroups } from "@/config/navigation";
import { dashboardNav } from "@/config/navigation";
import { OrgSwitcher } from "@/components/shared/org-switcher";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  ShieldCheck,
  History,
  Tv,
  Plug,
  Settings2,
  Building2,
  Menu,
  Sparkles,
} from "lucide-react";
import type { Route } from "next";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ShieldCheck,
  History,
  Tv,
  Plug,
  Settings2,
  Building2,
};

function getBreadcrumbs(pathname: string, orgSlug?: string): BreadcrumbItem[] {
  if (!orgSlug) {
    if (pathname.startsWith("/dashboard/organizations")) return [{ label: "Organizations", href: "/dashboard/organizations" as Route }];
    return [{ label: "Dashboard" }];
  }
  const base = `/dashboard/${orgSlug}` as Route;
  // Exact and prefix checks — customer-facing labels, no internal sponsor-sentinel/scans exposure
  if (pathname === `/dashboard/${orgSlug}`) return [{ label: "Workspace", href: base }, { label: "Overview" }];
  if (pathname.startsWith(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new`)) {
    return [{ label: "Workspace", href: base }, { label: "Campaigns", href: `/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route }, { label: "New" }];
  }
  if (pathname.startsWith(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/`)) {
    return [{ label: "Workspace", href: base }, { label: "Campaigns", href: `/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route }, { label: "Campaign" }];
  }
  if (pathname.startsWith(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`)) {
    return [{ label: "Workspace", href: base }, { label: "Campaigns" }];
  }
  if (pathname.startsWith(`/dashboard/${orgSlug}/sponsor-sentinel/scans/`)) {
    return [{ label: "Workspace", href: base }, { label: "Checks", href: `/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route }, { label: "Check" }];
  }
  if (pathname.startsWith(`/dashboard/${orgSlug}/sponsor-sentinel/scans`)) {
    return [{ label: "Workspace", href: base }, { label: "Checks" }];
  }
  if (pathname.startsWith(`/dashboard/${orgSlug}/channels`)) return [{ label: "Workspace", href: base }, { label: "Channels" }];
  if (pathname.startsWith(`/dashboard/${orgSlug}/connections`)) return [{ label: "Workspace", href: base }, { label: "Connections" }];
  if (pathname.startsWith(`/dashboard/${orgSlug}/settings`)) {
    // legacy /settings/integrations maps to Connections breadcrumb
    if (pathname.includes("integrations")) return [{ label: "Workspace", href: base }, { label: "Connections" }];
    return [{ label: "Workspace", href: base }, { label: "Settings" }];
  }
  return [{ label: "Workspace", href: base }];
}

interface DashboardShellProps {
  children: React.ReactNode;
  organizations?: { id: string; name: string; slug: string }[];
}

export function DashboardShell({ children, organizations = [] }: DashboardShellProps) {
  const params = useParams() as { orgSlug?: string } | null;
  const pathname = usePathname();
  const orgSlug = params?.orgSlug;
  const navGroups = orgSlug ? getDashboardNavGroups(orgSlug) : [{ label: "", items: dashboardNav }];
  const activeOrg = orgSlug ? organizations.find((o) => o.slug === orgSlug) : undefined;
  const breadcrumbs = getBreadcrumbs(pathname, orgSlug);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // close drawer on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navContent = (
    <nav aria-label="Workspace navigation" className="space-y-6">
      {navGroups.map((group) => (
        <div key={group.label || "ungrouped"}>
          {group.label ? (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</p>
          ) : null}
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              // legacy integrations route should highlight Connections
              const isConnectionsLegacyActive =
                item.label === "Connections" && pathname.includes("/settings/integrations");
              const active = isActive || isConnectionsLegacyActive;
              const Icon = iconMap[item.icon] ?? LayoutDashboard;
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-sm font-medium transition-colors duration-[180ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-[hsl(24_85%_52%_/_0.08)] text-foreground border border-[hsl(24_85%_52%_/_0.12)]"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground border border-transparent",
                    item.comingSoon && "opacity-60"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.comingSoon && <span className="ml-auto text-[10px] rounded-full bg-secondary px-1.5 py-0.5">Soon</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-[272px] shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="sticky top-0 flex h-full flex-col">
          <div className="flex h-[56px] items-center gap-2 border-b border-border px-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display text-[16px] tracking-[-0.015em] font-normal">MicroNest</span>
          </div>
          <div className="p-3">
            {organizations.length > 0 && <OrgSwitcher organizations={organizations} activeOrgId={activeOrg?.id} variant="sidebar" />}
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4">{navContent}</div>
          <div className="border-t border-border p-3">
            <p className="px-3 text-xs text-muted-foreground">© {new Date().getFullYear()} MicroNest</p>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-[56px] items-center gap-3 border-b border-border bg-card px-4 md:px-6 lg:px-8">
          {/* Mobile trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open navigation"
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-border bg-card text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent className="w-[300px] p-0" aria-describedby={undefined}>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-primary text-primary-foreground">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  MicroNest
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-3">
                {organizations.length > 0 && (
                  <div className="mb-4">
                    <OrgSwitcher organizations={organizations} activeOrgId={activeOrg?.id} variant="sidebar" />
                  </div>
                )}
                <div id="mobile-nav">{navContent}</div>
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden flex-1 lg:block">
            <Breadcrumb items={breadcrumbs} />
          </div>
          <div className="flex flex-1 items-center gap-2 lg:hidden min-w-0">
            <span className="truncate text-sm font-medium">{activeOrg?.name ?? orgSlug ?? "Workspace"}</span>
          </div>

          <div className="ml-auto hidden items-center gap-3 lg:flex">
            {organizations.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {activeOrg ? `Workspace: ${activeOrg.name}` : orgSlug ? `Workspace: ${orgSlug}` : null}
              </span>
            )}
          </div>
        </header>

        {/* Mobile breadcrumb bar */}
        <div className="border-b border-border bg-surface-muted/40 px-4 py-2 md:px-6 lg:hidden">
          <Breadcrumb items={breadcrumbs} />
        </div>

        <main className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-[80rem] px-5 py-6 md:px-6 md:py-8 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
