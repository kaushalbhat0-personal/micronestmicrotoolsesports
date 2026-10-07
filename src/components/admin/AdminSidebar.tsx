"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  Building2,
  Users,
  KeyRound,
  CreditCard,
  ShieldCheck,
  Settings2,
  ScrollText,
} from "lucide-react";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
};

const NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Organizations", href: "/admin/organizations", icon: Building2 },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Entitlements", href: "/admin/entitlements", icon: KeyRound },
  { label: "Billing", href: "/admin/billing", icon: CreditCard },
  { label: "Sentinel", href: "/admin/sentinel", icon: ShieldCheck },
  { label: "System", href: "/admin/system", icon: Settings2 },
  { label: "Audit Log", href: "/admin/audit-log", icon: ScrollText },
];

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Platform admin navigation" className={cn("space-y-6", className)}>
      <div>
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Platform</p>
        <div className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = !item.comingSoon && item.href ? pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href)) : false;
            const content = (
              <>
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span className="flex-1 truncate">{item.label}</span>
                {item.comingSoon && (
                  <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Soon</span>
                )}
              </>
            );

            if (item.comingSoon || !item.href) {
              return (
                <div
                  key={item.label}
                  aria-disabled="true"
                  className="flex min-h-[44px] items-center gap-2.5 rounded-[12px] border border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground opacity-60"
                >
                  {content}
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href as never}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] items-center gap-2.5 rounded-[12px] border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-[hsl(24_85%_52%_/_0.08)] text-foreground border-[hsl(24_85%_52%_/_0.12)]"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground border-transparent",
                )}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="rounded-[12px] border border-border bg-surface-muted/40 p-3">
        <p className="text-xs font-medium text-foreground">Platform Admin</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Read-only overview. No organization context. Sensitive actions will require audit.</p>
      </div>
    </nav>
  );
}
