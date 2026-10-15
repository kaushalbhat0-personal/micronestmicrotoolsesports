import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const COVERAGE = ["Dota 2", "VALORANT", "League of Legends"] as const;

/**
 * IntelligenceSection — Meta-Parser discovery. A dedicated section because
 * public patch intelligence is a fundamentally different product from the
 * workspace tools — but never the hero, never a subscription pitch, and never
 * more than the production facts support (no predictions, no coaching).
 */
export function IntelligenceSection() {
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="intelligence-heading">
      <div className="mx-auto max-w-4xl rounded-[20px] border border-border bg-card p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[11px] tracking-widest text-primary">META-PARSER</p>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground">PATCH FACTS</p>
          <Badge variant="success">Public</Badge>
        </div>
        <h2 id="intelligence-heading" className="font-display mt-3 max-w-xl text-2xl font-normal tracking-tight sm:text-3xl">
          Understand the game, not just the bracket.
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          Meta-Parser turns competitive-game patch notes into structured, searchable public facts —
          every buff, nerf, and adjustment, attributable to its source. Facts first;
          interpretation later. Free to read, no account needed.
        </p>
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Current public coverage
          </p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Games with published patch facts">
            {COVERAGE.map((game) => (
              <li
                key={game}
                className="rounded-full border border-border bg-surface-muted/60 px-4 py-1.5 text-sm font-medium"
              >
                {game}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Coverage grows as catalogues are published — the live catalogue lists every available patch.
          </p>
        </div>
        <div className="mt-6">
          <Link
            href="/meta-parser"
            aria-label="Browse Meta-Parser public patch facts"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Browse patch facts
          </Link>
        </div>
      </div>
    </section>
  );
}
