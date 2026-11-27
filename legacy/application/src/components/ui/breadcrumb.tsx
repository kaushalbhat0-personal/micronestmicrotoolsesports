import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Route } from "next";

export interface BreadcrumbItem {
  label: string;
  href?: Route;
}

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center text-sm", className)}>
      <ol className="flex items-center gap-1.5">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className="text-muted-foreground hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className={cn(isLast ? "font-medium text-foreground" : "text-muted-foreground")} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
