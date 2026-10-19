import Link from "next/link";

/**
 * FinalToolboxCTA — completely neutral close. Points at the toolbox and the
 * free Lab, never at a single tool's conversion flow. A small modular
 * motif (three pieces settling into a row) echoes the hero without
 * adding copy or a new conversion path.
 */
export function FinalToolboxCTA() {
  return (
    <section className="container-nest py-16 sm:py-20" aria-labelledby="final-cta-heading">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-5 flex items-center justify-center gap-1.5" aria-hidden>
          <span className="nest-reveal inline-block size-2 rounded-[3px] bg-primary/70" />
          <span className="nest-reveal nest-reveal-delay-1 inline-block size-2 rounded-[3px] bg-border-strong" />
          <span className="nest-reveal nest-reveal-delay-2 inline-block size-2 rounded-[3px] bg-primary" />
        </div>
        <h2 id="final-cta-heading" className="font-display text-2xl font-normal tracking-tight sm:text-3xl">
          Find your next tool.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Practice something. Understand something. Run something.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Explore the toolbox
          </Link>
          <Link
            href="/bgmi-lab"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-8 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Explore BGMI Lab
          </Link>
        </div>
      </div>
    </section>
  );
}
