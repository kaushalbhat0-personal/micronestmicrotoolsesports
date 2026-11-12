// Marketing call-to-action link (anchor styled as a button).
// Stitch-approved Competitive Arena: sharp geometry (0px radius), 44px min
// touch target, uppercase Oswald labels. Static only: destinations are real
// routes typed as `Route` so dead routes fail typecheck.

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type MarketingCTAVariant = "accent" | "dark" | "ghost-on-dark" | "ghost-on-light";

const variantClass: Record<MarketingCTAVariant, string> = {
  // Crimson solid: white text on #C8102E (5.88), hover deep crimson #9B0014.
  accent:
    "bg-accent-600 text-white hover:bg-accent-700 focus-visible:outline-accent-600 border border-accent-600 hover:border-accent-700",
  // Carbon solid: white text on #0A0E14, hover crimson.
  dark: "bg-arena-950 text-white hover:bg-accent-600 hover:border-accent-600 border border-arena-950 focus-visible:outline-accent-600",
  // Paper text + border on arena; never accent text on dark (3.29, fails AA).
  "ghost-on-dark":
    "border border-white/40 text-white hover:border-white hover:bg-white/10 focus-visible:outline-white",
  "ghost-on-light":
    "border border-slate-deep/30 text-ink-900 hover:border-ink-900 hover:bg-steel-100 focus-visible:outline-ink-900",
};

export function MarketingCTA({
  href,
  variant = "accent",
  children,
  className,
}: {
  href: Route;
  variant?: MarketingCTAVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-[44px] w-full items-center justify-center rounded-none px-6 text-sm font-bold tracking-wide uppercase",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        variantClass[variant],
        className
      )}
    >
      {children}
    </Link>
  );
}
