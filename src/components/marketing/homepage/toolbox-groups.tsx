import Link from "next/link";
import type { Route } from "next";
import {
  ShieldCheck,
  Split,
  Swords,
  Scale,
  ReceiptText,
  ClipboardList,
  Newspaper,
  Target,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { resolveToolboxGroups } from "@/lib/marketing/homepage-seo";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  Split,
  Swords,
  Scale,
  ReceiptText,
  ClipboardList,
  Newspaper,
  Target,
};

/**
 * ToolboxGroups — the eight released tools in four neutral editorial groups.
 * Groups are organizational only (never ranked, never featured): identical card
 * chrome, no dominant group. All display data resolves from the canonical
 * registry via `resolveToolboxGroups()` — no duplicated catalog.
 */
export function ToolboxGroups() {
  const groups = resolveToolboxGroups();
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="toolbox-groups-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">The toolbox</p>
        <h2 id="toolbox-groups-heading" className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">
          Tools for the work behind esports.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Focused tools, not an all-in-one platform. Pick one for tonight&apos;s job — use what you
          need, skip the rest.
        </p>
      </div>
      <div className="mx-auto mt-10 max-w-4xl space-y-10">
        {groups.map((group) => (
          <div key={group.label} role="group" aria-label={group.label}>
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{group.blurb}</p>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {group.cards.map((card) => {
                const Icon = iconMap[card.icon] ?? ShieldCheck;
                return (
                  <Card key={card.url} className="flex flex-col border-border/60">
                    <CardHeader className="flex-1">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                      </span>
                      <CardTitle className="mt-3 text-base">{card.name}</CardTitle>
                      <CardDescription>{card.description}</CardDescription>
                      <p className="mt-2 text-sm">
                        <span className="sr-only">Access: </span>
                        <span className="text-muted-foreground">{card.accessNote}</span>
                      </p>
                    </CardHeader>
                    <CardContent>
                      <Link
                        href={card.url as Route}
                        aria-label={card.ctaAriaLabel}
                        className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-5 text-sm font-medium transition-colors duration-[180ms] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {card.ctaLabel}
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
