import Link from "next/link";

/**
 * PricingReassurance — neutral pricing discovery. No per-tool pricing table,
 * no sponsorship pricing story, no invented prices, and Meta-Parser is never
 * framed as a subscription (patch facts are public and free to read).
 */
export function PricingReassurance() {
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="pricing-reassurance-heading">
      <div className="mx-auto max-w-4xl rounded-[20px] border border-border bg-card p-6 text-center sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Start free. Upgrade when you need more.
        </p>
        <h2 id="pricing-reassurance-heading" className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">
          Every workspace tool starts free.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Try the real workflow before paying. No credit card required — Free never expires. Paid
          plans unlock more capacity per tool, and All Access covers every paid tool. Renewal is
          manual — no automatic charges.
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Patch facts are public — reading them never needs a plan. BGMI Lab drills are free with no signup.
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
