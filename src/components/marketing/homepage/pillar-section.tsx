import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Target, Trophy, Wrench } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAvailableLabTools, getLabTools } from "@/lib/marketing/public-tool-content";
import { getPaidProductEntries } from "@/lib/marketing/paid-products";

/**
 * PillarSection — the three ways to use MicroNest: Practice (BGMI Lab),
 * Understand (Tournament Hub), Run (Paid Tools). Counts derive from the
 * canonical registries (Lab registry, paid-products presentation source);
 * all other copy is presentational. No billing logic, no prices.
 *
 * Mission framing: each pillar reads as a choice, not a category —
 * a mission line, a tiny motif icon, and CTAs whose arrows nudge on
 * hover. Keyboard focus (focus-within) mirrors the hover state.
 */
export function PillarSection() {
  const labAvailable = getAvailableLabTools();
  const labPlannedCount = getLabTools().filter((t) => t.status === "planned").length;
  const paidCount = getPaidProductEntries().length;
  const drill = labAvailable[0];

  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="pillars-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Three ways in</p>
        <h2 id="pillars-heading" className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">
          Pick your lane.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Practice free, follow the competition, or run your operations — one toolbox, no bloat.
        </p>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl gap-5 lg:grid-cols-3">
        <Card className="group flex flex-col border-primary/15 transition-[transform,border-color,box-shadow] duration-[180ms] ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus-within:-translate-y-0.5 focus-within:border-primary/30 focus-within:shadow-sm">
          <CardHeader className="flex-1">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-muted transition-transform duration-[180ms] ease-out group-hover:-translate-y-0.5 group-hover:rotate-[4deg] group-focus-within:-translate-y-0.5 group-focus-within:rotate-[4deg]">
                <Target className="h-5 w-5 text-muted-foreground" aria-hidden />
              </span>
              <Badge variant="outline">Practice</Badge>
            </div>
            <CardTitle className="mt-3 text-base">BGMI Lab</CardTitle>
            <p className="text-sm font-medium text-primary">Sharpen your reads.</p>
            <CardDescription>
              Free interactive drills for players, IGLs and teams — practice rotations, decisions and endgames. No signup.
            </CardDescription>
            <p className="mt-2 text-sm text-muted-foreground">
              {drill ? `Live now: ${drill.name}` : "Drills opening soon"}
              {labPlannedCount > 0 ? ` · ${labPlannedCount} more on the way` : ""}
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link
              href="/bgmi-lab"
              aria-label="Explore the free BGMI Lab practice drills"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Explore BGMI Lab
              <ArrowRight className="h-4 w-4 transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 group-focus-within:translate-x-0.5" aria-hidden />
            </Link>
            {drill ? (
              <Link
                href={`/bgmi-lab/${drill.slug}` as Route}
                aria-label={`Try ${drill.name} now — no signup needed`}
                className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try {drill.name}
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card className="group flex flex-col border-border/60 transition-[transform,border-color,box-shadow] duration-[180ms] ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm focus-within:-translate-y-0.5 focus-within:border-border-strong focus-within:shadow-sm">
          <CardHeader className="flex-1">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-muted transition-transform duration-[180ms] ease-out group-hover:-translate-y-0.5 group-hover:rotate-[4deg] group-focus-within:-translate-y-0.5 group-focus-within:rotate-[4deg]">
                <Trophy className="h-5 w-5 text-muted-foreground" aria-hidden />
              </span>
              <Badge variant="outline">Understand</Badge>
            </div>
            <CardTitle className="mt-3 text-base">Tournament Hub</CardTitle>
            <p className="text-sm font-medium text-primary">Follow the competition.</p>
            <CardDescription>
              Public standings, match results and event context — follow the competition, free to read.
            </CardDescription>
            <p className="mt-2 text-sm text-muted-foreground">BGMI tournaments, updated after completed matches.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link
              href="/bgmi-tournaments"
              aria-label="Explore the BGMI Tournament Hub standings and results"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Explore Tournament Hub
              <ArrowRight className="h-4 w-4 transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 group-focus-within:translate-x-0.5" aria-hidden />
            </Link>
          </CardContent>
        </Card>

        <Card className="group flex flex-col border-border/60 transition-[transform,border-color,box-shadow] duration-[180ms] ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm focus-within:-translate-y-0.5 focus-within:border-border-strong focus-within:shadow-sm">
          <CardHeader className="flex-1">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-muted transition-transform duration-[180ms] ease-out group-hover:-translate-y-0.5 group-hover:rotate-[4deg] group-focus-within:-translate-y-0.5 group-focus-within:rotate-[4deg]">
                <Wrench className="h-5 w-5 text-muted-foreground" aria-hidden />
              </span>
              <Badge variant="outline">Run</Badge>
            </div>
            <CardTitle className="mt-3 text-base">Paid Tools</CardTitle>
            <p className="text-sm font-medium text-primary">Get the work done.</p>
            <CardDescription>
              Focused operator tools for sponsorships, prize pools, drafts, standings and payouts. Every tool starts free.
            </CardDescription>
            <p className="mt-2 text-sm text-muted-foreground">{paidCount} focused tools + All Access bundle.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link
              href="/paid-tools"
              aria-label="Explore MicroNest paid operator tools"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Explore Paid Tools
              <ArrowRight className="h-4 w-4 transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 group-focus-within:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/pricing"
              aria-label="View MicroNest tool pricing"
              className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View Pricing
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
