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
  CalendarSearch,
  Split,
  Scissors,
  FileCheck,
  ChevronRight,
} from "lucide-react";
import type { Route } from "next";
import { NavigationProgress } from "@/components/ui/navigation-progress";
import type { WorkspaceTool } from "@/server/services/workspace-tools";
import { Logo } from "@/components/shared/logo";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ShieldCheck,
  History,
  Tv,
  Plug,
  Settings2,
  Building2,
  CalendarSearch,
  Split,
  Scissors,
  FileCheck,
};

function getBreadcrumbs(pathname: string, orgSlug?: string): BreadcrumbItem[] {
  if (!orgSlug) {
    if (pathname.startsWith("/dashboard/organizations")) return [{ label: "Workspaces", href: "/dashboard/organizations" as Route }];
    return [{ label: "Dashboard" }];
  }
  const base = `/dashboard/${orgSlug}` as Route;
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
    if (pathname.includes("integrations")) return [{ label: "Workspace", href: base }, { label: "Connections" }];
    return [{ label: "Workspace", href: base }, { label: "Settings" }];
  }
  return [{ label: "Workspace", href: base }];
}

interface DashboardShellProps {
  children: React.ReactNode;
  organizations?: { id: string; name: string; slug: string }[];
  workspaceToolsBySlug?: Record<string, { entitled: WorkspaceTool[]; available: WorkspaceTool[] }>;
}

export function DashboardShell({ children, organizations = [], workspaceToolsBySlug }: DashboardShellProps) {
  const params = useParams() as { orgSlug?: string } | null;
  const pathname = usePathname();
  const orgSlug = params?.orgSlug;
  const activeOrg = orgSlug ? organizations.find((o) => o.slug === orgSlug) : undefined;
  const breadcrumbs = getBreadcrumbs(pathname, orgSlug);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Entitlement-aware groups — fallback to legacy if no data
  const entitlement = orgSlug && workspaceToolsBySlug?.[orgSlug];
  const hasEntitlementData = Boolean(entitlement);

  const legacyGroups = orgSlug ? getDashboardNavGroups(orgSlug) : [{ label: "", items: dashboardNav }];

  // Build entitlement-aware nav when data available
  const renderEntitledNav = () => {
    if (!entitlement) return null;
    const { entitled, available } = entitlement;
    return (
      <>
        {/* WORKSPACE */}
        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Workspace</p>
          <div className="space-y-1">
            <NavLink href={`/dashboard/${orgSlug}` as Route} icon="LayoutDashboard" label="Overview" pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>

        {/* YOUR TOOLS */}
        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Your Tools</p>
          <div className="space-y-3">
            {entitled.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No tools entitled — explore More Tools below.</p>
            ) : (
              entitled.map((tool) => {
                const ToolIcon = iconMap[tool.icon] ?? ShieldCheck;
                return (
                  <div key={tool.slug} className="space-y-1">
                    <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold text-foreground">
                      <ToolIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{tool.name}</span>
                    </div>
                    {tool.subItems && tool.subItems.length > 0 ? (
                      <div className="ml-2 space-y-1 border-l border-border/60 pl-2">
                        {tool.subItems.map((sub) => (
                          <NavLink key={sub.href} href={sub.href} icon={sub.icon} label={sub.label} pathname={pathname} onNavigate={() => setMobileOpen(false)} indent />
                        ))}
                      </div>
                    ) : (
                      <NavLink href={tool.href} icon={tool.icon} label={tool.name} pathname={pathname} onNavigate={() => setMobileOpen(false)} indent />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MORE TOOLS */}
        {available.length > 0 && (
          <div>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">More Tools</p>
            <div className="space-y-1">
              {available.map((tool) => {
                const Icon = iconMap[tool.icon] ?? FileCheck;
                const isComingSoon = tool.comingSoon;
                return (
                  <Link
                    key={tool.slug}
                    href={isComingSoon ? "#" : tool.href}
                    aria-disabled={isComingSoon}
                    onClick={(e) => {
                      if (isComingSoon) e.preventDefault();
                      else setMobileOpen(false);
                    }}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isComingSoon
                        ? "text-muted-foreground opacity-70 cursor-default"
                        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground border border-transparent"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-60" />
                    <span className="flex-1 truncate text-xs">{tool.name}</span>
                    {isComingSoon ? (
                      <span className="ml-auto text-[10px] rounded-full bg-secondary px-1.5 py-0.5">Soon</span>
                    ) : (
                      <ChevronRight className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* CREATORS */}
        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Creators</p>
          <div className="space-y-1">
            <NavLink href={`/dashboard/${orgSlug}/channels` as Route} icon="Tv" label="Channels" pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <NavLink href={`/dashboard/${orgSlug}/connections` as Route} icon="Plug" label="Connections" pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>

        {/* SETTINGS */}
        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Settings</p>
          <div className="space-y-1">
            <NavLink href={`/dashboard/${orgSlug}/settings` as Route} icon="Settings2" label="Settings" pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <Link
            href="/dashboard/organizations"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-sm border border-transparent min-h-[44px]",
              pathname === "/dashboard/organizations" ? "bg-[hsl(24_85%_52%_/_0.08)] text-foreground border-[hsl(24_85%_52%_/_0.12)]" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            )}
          >
            <Building2 className="h-4 w-4" />
            Workspaces
          </Link>
        </div>
      </>
    );
  };

  const navContent = hasEntitlementData ? (
    <nav aria-label="Workspace navigation" className="space-y-6">
      {renderEntitledNav()}
    </nav>
  ) : (
    <nav aria-label="Workspace navigation" className="space-y-6">
      {legacyGroups.map((group) => (
        <div key={group.label || "ungrouped"}>
          {group.label ? <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</p> : null}
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const isConnectionsLegacyActive = item.label === "Connections" && pathname.includes("/settings/integrations");
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
                    active ? "bg-[hsl(24_85%_52%_/_0.08)] text-foreground border border-[hsl(24_85%_52%_/_0.12)]" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground border border-transparent",
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
      <NavigationProgress />
      <aside className="hidden w-[272px] shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="sticky top-0 flex h-full flex-col">
          <div className="flex h-[56px] items-center border-b border-border px-4">
            <Logo height={26} priority />
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
        <header className="sticky top-0 z-30 flex h-[56px] items-center gap-3 border-b border-border bg-card px-4 md:px-6 lg:px-8">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="mobile-nav" className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-border bg-card text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent className="w-[300px] p-0" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>
                <Logo height={24} />
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

          <div className="hidden flex-1 lg:block" id="main-content">
            <Breadcrumb items={breadcrumbs} />
          </div>
          <div className="flex flex-1 items-center gap-2 lg:hidden min-w-0">
            <span className="truncate text-sm font-medium">{activeOrg?.name ?? orgSlug ?? "Workspace"}</span>
          </div>

          <div className="ml-auto hidden items-center gap-3 lg:flex">
            {organizations.length > 0 && <span className="text-xs text-muted-foreground">{activeOrg ? `Workspace: ${activeOrg.name}` : orgSlug ? `Workspace: ${orgSlug}` : null}</span>}
          </div>
        </header>

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

function NavLink({
  href,
  icon,
  label,
  pathname,
  onNavigate,
  indent,
}: {
  href: Route;
  icon: string;
  label: string;
  pathname: string;
  onNavigate: () => void;
  indent?: boolean;
}) {
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const Icon = iconMap[icon] ?? LayoutDashboard;
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-sm font-medium transition-colors duration-[180ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]",
        isActive ? "bg-[hsl(24_85%_52%_/_0.08)] text-foreground border border-[hsl(24_85%_52%_/_0.12)]" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground border border-transparent",
        indent && "ml-0 text-[13px]"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground", indent && "h-3.5 w-3.5")} />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}
