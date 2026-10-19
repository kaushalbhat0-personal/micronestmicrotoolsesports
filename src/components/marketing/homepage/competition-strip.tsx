import Link from "next/link";
import { ArrowRight, Newspaper, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const COVERAGE = ["Dota 2", "VALORANT", "League of Legends"] as const;

/**
 * CompetitionStrip — public competitive context: the Tournament Hub
 * (standings, results, history) plus Meta-Parser patch facts. Discovery
 * only: no data fetching here, no subscription framing, no predictions.
 * Presented as a compact intelligence board: field-notes framing, match
 * and patch markers, and a quiet connector between the two halves.
 */
export function CompetitionStrip() {
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="competition-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Public context</p>
        <h2 id="competition-heading" className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">
          Follow the competition. Understand the game.
        </h2>
        <p className="mt-2 text-muted-foreground">
          MicroNest publishes the context around the work — who stands where, and how the game itself changed.
        </p>
      </div>
      <p className="mx-auto mt-6 flex max-w-4xl items-center gap-3 font-mono text-[11px] tracking-widest text-muted-foreground">
        <span className="inline-block size-1.5 rounded-[2px] bg-primary" aria-hidden />
        FIELD NOTES
        <span className="h-px flex-1 bg-border" aria-hidden />
      </p>
      <div className="relative mx-auto mt-4 grid max-w-4xl gap-5 sm:grid-cols-2">
        <span className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 sm:block" aria-hidden>
          <span className="flex size-8 items-center justify-center rounded-full border border-border bg-card text-[10px] font-bold text-muted-foreground">
            +
          </span>
        </span>
        <div className="group flex flex-col rounded-[16px] border border-border bg-card p-6 transition-[transform,border-color,box-shadow] duration-[180ms] ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm focus-within:-translate-y-0.5 focus-within:border-border-strong focus-within:shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-border bg-surface-muted transition-transform duration-[180ms] ease-out group-hover:-translate-y-0.5 group-focus-within:-translate-y-0.5">
              <Swords className="h-4 w-4 text-muted-foreground" aria-hidden />
            </span>
            <p className="font-mono text-[11px] tracking-widest text-primary">TOURNAMENT HUB</p>
            <Badge variant="success">Public</Badge>
          </div>
          <h3 className="mt-3 text-[15px] font-semibold leading-none tracking-[-0.01em]">BGMI standings &amp; results</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            Tournament standings, match results and history — updated after completed matches. Free to read, no account needed.
          </p>
          <div className="mt-4">
            <Link
              href="/bgmi-tournaments"
              aria-label="Browse BGMI tournament standings and results"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Browse standings
              <ArrowRight className="h-4 w-4 transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 group-focus-within:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
        <div className="group flex flex-col rounded-[16px] border border-border bg-card p-6 transition-[transform,border-color,box-shadow] duration-[180ms] ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm focus-within:-translate-y-0.5 focus-within:border-border-strong focus-within:shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-border bg-surface-muted transition-transform duration-[180ms] ease-out group-hover:-translate-y-0.5 group-focus-within:-translate-y-0.5">
              <Newspaper className="h-4 w-4 text-muted-foreground" aria-hidden />
            </span>
            <p className="font-mono text-[11px] tracking-widest text-primary">META-PARSER</p>
            <Badge variant="success">Public</Badge>
          </div>
          <h3 className="mt-3 text-[15px] font-semibold leading-none tracking-[-0.01em]">Patch facts, structured</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Competitive-game patch notes as structured public facts — attributable to source. Facts first, interpretation later.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Games with published patch facts">
            {COVERAGE.map((game) => (
              <li
                key={game}
                className="rounded-full border border-border bg-surface-muted/60 px-4 py-1.5 text-sm font-medium"
              >
                {game}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Link
              href="/meta-parser"
              aria-label="Browse Meta-Parser public patch facts"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Browse patch facts
              <ArrowRight className="h-4 w-4 transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 group-focus-within:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
