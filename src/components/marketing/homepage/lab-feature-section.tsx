import Link from "next/link";
import type { Route } from "next";
import { Crosshair } from "lucide-react";
import { getLabTool } from "@/lib/marketing/public-tool-content";

/**
 * LabFeatureSection — acquisition teaser for the BGMI Lab exemplar.
 * Fully static: name/tagline/steps resolve from the Lab registry, CTAs
 * link to the drill page. The interactive drill itself is never imported
 * here, so the homepage bundle stays light.
 */
const STEPS = [
  { n: "01", title: "Make your call", text: "Study the zone snapshot and pick the rotation you would call." },
  { n: "02", title: "Reveal the result", text: "See the recommended call instantly — no account, no waiting." },
  { n: "03", title: "Learn the why", text: "Every answer explains itself, so the reasoning transfers to matches." },
] as const;

export function LabFeatureSection() {
  const drill = getLabTool("circle-iq");
  if (!drill) return null;
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="lab-feature-heading">
      <div className="mx-auto max-w-4xl rounded-[20px] border border-primary/15 bg-card p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[11px] tracking-widest text-primary">BGMI LAB</p>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground">FREE DRILL</p>
        </div>
        <div className="mt-3 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] border border-border bg-surface-muted">
            <Crosshair className="h-6 w-6 text-muted-foreground" aria-hidden />
          </span>
          <div>
            <h2 id="lab-feature-heading" className="font-display text-2xl font-normal tracking-tight sm:text-3xl">
              {drill.name}
            </h2>
            <p className="mt-1 text-muted-foreground">{drill.tagline} Can you read the circle?</p>
          </div>
        </div>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="rounded-[12px] border border-border bg-surface-muted/40 p-4">
              <p className="font-mono text-[11px] tracking-widest text-primary" aria-hidden>
                {step.n}
              </p>
              <h3 className="mt-2 text-[15px] font-semibold leading-none tracking-[-0.01em]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/bgmi-lab/${drill.slug}` as Route}
            aria-label={`Try ${drill.name} now — no signup needed`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try {drill.name}
          </Link>
          <Link
            href="/bgmi-lab"
            aria-label="Explore all BGMI Lab practice drills"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-8 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Explore BGMI Lab
          </Link>
        </div>
      </div>
    </section>
  );
}
