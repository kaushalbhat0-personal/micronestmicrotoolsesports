import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  ShieldCheck,
  Split,
  Swords,
  Scale,
  ReceiptText,
  ClipboardList,
  Newspaper,
  Target,
  Trophy,
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
  Trophy,
};

/**
 * ToolboxGroups — the nine released tools in four neutral editorial groups.
 * Groups are organizational only (never ranked, never featured): identical card
 * chrome, no dominant group. All display data resolves from the canonical
 * registry via `resolveToolboxGroups()` — no duplicated catalog.
 *
 * Shelf rhythm: each group opens like a toolbox drawer — an editorial
 * separator with a modular tick — so the page reads as a toolbox being
 * opened rather than a database listing. Cards lift slightly on hover,
 * icons shift, CTA arrows nudge; focus-within mirrors hover for keyboard.
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
            <div className="flex items-center gap-3">
              <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
                <span className="inline-block size-1.5 rounded-[2px] bg-primary" />
                <span className="inline-block size-1.5 rounded-[2px] bg-border-strong" />
              </span>
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{group.blurb}</p>
              </div>
              <span className="h-px min-w-6 flex-1 bg-border" aria-hidden />
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {group.cards.map((card) => {
                const Icon = iconMap[card.icon] ?? ShieldCheck;
                return (
                  <Card
                    key={card.url}
                    className="group flex flex-col border-border/60 transition-[transform,border-color,box-shadow] duration-[180ms] ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm focus-within:-translate-y-0.5 focus-within:border-border-strong focus-within:shadow-sm"
                  >
                    <CardHeader className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-muted transition-transform duration-[180ms] ease-out group-hover:-translate-y-0.5 group-focus-within:-translate-y-0.5">
                          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                        </span>
                        <span className="rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {card.accessNote}
                        </span>
                      </div>
                      <CardTitle className="mt-3 text-base">{card.name}</CardTitle>
                      <CardDescription>{card.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link
                        href={card.url as Route}
                        aria-label={card.ctaAriaLabel}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-5 text-sm font-medium transition-colors duration-[180ms] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {card.ctaLabel}
                        <ArrowRight
                          className="h-4 w-4 text-muted-foreground transition-transform duration-[180ms] ease-out group-hover:translate-x-1 group-focus-within:translate-x-1"
                          aria-hidden
                        />
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
