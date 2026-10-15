import Link from "next/link";

/**
 * FinalToolboxCTA — completely neutral close. Points at the toolbox, never at
 * a single tool's conversion flow.
 */
export function FinalToolboxCTA() {
  return (
    <section className="container-nest py-16 sm:py-20" aria-labelledby="final-cta-heading">
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="final-cta-heading" className="font-display text-2xl font-normal tracking-tight sm:text-3xl">
          Find the tool for the job.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Seven focused tools. One toolbox. Start with whichever job is in front of you tonight.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Explore the toolbox
          </Link>
          <Link
            href="/pricing"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-8 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
