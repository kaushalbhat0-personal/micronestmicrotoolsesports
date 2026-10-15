import Link from "next/link";
import { LogoMark } from "@/components/shared/logo";

/**
 * ToolboxHero — MicroNest itself is the hero. No single tool dominates:
 * headline is the tagline, CTAs point at the toolbox and the anonymous demo.
 */
export function ToolboxHero() {
  return (
    <section className="container-nest py-16 sm:py-20 lg:py-24" aria-labelledby="homepage-hero-heading">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-6 flex justify-center">
          <LogoMark size={80} priority className="!size-14 sm:!size-[72px] lg:!size-[80px]" />
        </div>
        <h1 id="homepage-hero-heading" className="font-display text-balance text-4xl font-normal tracking-tight sm:text-5xl">
          The toolbox behind esports.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          MicroNest is a collection of small, focused tools for esports operations — tournaments,
          sponsors, payouts, rosters, and public patch intelligence. Choose the tool for the job
          and get it done.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Explore the toolbox
          </Link>
          <Link
            href="/tools/prize-pool-splitter"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-8 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try a tool without signup
          </Link>
        </div>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground" aria-label="Toolbox at a glance">
          <li>7 focused tools</li>
          <li aria-hidden>·</li>
          <li>2 work without signup</li>
          <li aria-hidden>·</li>
          <li>Patch facts free to read</li>
        </ul>
      </div>
    </section>
  );
}
