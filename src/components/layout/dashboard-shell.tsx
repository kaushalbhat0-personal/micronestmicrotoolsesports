"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
          <nav className="space-y-1 p-3 pt-0">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted",
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
            ))}
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
