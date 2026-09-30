"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { dashboardNav, getDashboardNav } from "@/config/navigation";
import { Badge } from "@/components/ui/badge";
import { OrgSwitcher } from "@/components/shared/org-switcher";

interface DashboardShellProps {
  children: React.ReactNode;
  organizations?: { id: string; name: string; slug: string }[];
}

export function DashboardShell({ children, organizations = [] }: DashboardShellProps) {
  const params = useParams() as { orgSlug?: string } | null;
  const pathname = usePathname();
  const orgSlug = params?.orgSlug;
  const navItems = orgSlug ? getDashboardNav(orgSlug) : dashboardNav;
  const activeOrg = orgSlug ? organizations.find((o) => o.slug === orgSlug) : undefined;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r bg-muted/20 lg:block">
        <div className="sticky top-0">
          <div className="flex h-14 items-center border-b px-4 font-bold">MicroNest</div>
          <div className="p-3">
            {organizations.length > 0 && (
              <div className="mb-4">
                <OrgSwitcher organizations={organizations} activeOrgId={activeOrg?.id} />
              </div>
            )}
          </div>
          <nav className="space-y-1 p-3 pt-0" aria-label="Organization navigation">
            {navItems.map((item, idx) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const prevIsComingSoon = idx > 0 ? navItems[idx - 1]?.comingSoon : false;
              const showSoonDivider = item.comingSoon && !prevIsComingSoon;
              return (
                <React.Fragment key={item.href + item.label}>
                  {showSoonDivider ? (
                    <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Coming soon</p>
                  ) : null}
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive && "bg-muted font-semibold",
                      item.comingSoon && "opacity-60"
                    )}
                  >
                    <span>{item.label}</span>
                    {item.comingSoon && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Soon
                      </Badge>
                    )}
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6">
          <span className="text-sm text-muted-foreground">{orgSlug ? `Organization: ${orgSlug}` : "Dashboard"}</span>
          <div className="hidden lg:block text-sm">
            {organizations.length > 0 && <OrgSwitcher organizations={organizations} activeOrgId={activeOrg?.id} />}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
