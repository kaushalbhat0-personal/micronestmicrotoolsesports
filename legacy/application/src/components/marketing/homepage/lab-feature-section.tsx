import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Crosshair } from "lucide-react";
import { getLabTool } from "@/lib/marketing/public-tool-content";
import { CircleIqMicroChallenge } from "@/components/marketing/homepage/circle-iq-micro-challenge";

/**
 * LabFeatureSection — the homepage's first play moment and visual
 * centerpiece. Fully static except for one tiny client island
 * (CircleIqMicroChallenge, local state only): name/tagline resolve from
 * the Lab registry, CTAs link to the drill page. No data fetching, no
 * scoring, no persistence — the visitor sees something playable.
 *
 * Wide two-part composition: the invitation (headline, open step list,
 * CTAs) beside the live training prompt.
 */
const STEPS = [
  { n: "01", title: "Make your call", text: "Study the zone snapshot and pick the rotation you would call." },
  { n: "02", title: "Reveal the result", text: "See the safer call instantly — no account, no waiting." },
  { n: "03", title: "Learn the why", text: "Every answer explains itself, so the reasoning transfers to matches." },
] as const;

export function LabFeatureSection() {
  const drill = getLabTool("circle-iq");
  if (!drill) return null;
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="lab-feature-heading">
      <div className="mx-auto max-w-6xl rounded-[20px] border border-primary/15 bg-card p-6 sm:p-10 lg:p-12">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[11px] tracking-widest text-primary">BGMI LAB</p>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground">FREE DRILL</p>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground">ROUND 01</p>
        </div>
        <div className="mt-3 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] border border-border bg-surface-muted">
            <Crosshair className="h-6 w-6 text-muted-foreground" aria-hidden />
          </span>
          <div>
            <h2 id="lab-feature-heading" className="font-display text-2xl font-normal tracking-tight sm:text-4xl">
              {drill.name}
            </h2>
            <p className="font-display mt-2 text-lg font-normal text-muted-foreground sm:text-xl">
              {drill.tagline} Can you read the circle?
            </p>
          </div>
        </div>
        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
          <div>
            <ol className="divide-y divide-border border-y border-border">
              {STEPS.map((step) => (
                <li key={step.n} className="flex gap-4 py-4">
                  <p className="font-mono text-[11px] tracking-widest text-primary" aria-hidden>
                    {step.n}
                  </p>
                  <div>
                    <h3 className="text-[15px] font-semibold leading-none tracking-[-0.01em]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Link
                href={`/bgmi-lab/${drill.slug}` as Route}
                aria-label={`Try ${drill.name} now — no signup needed`}
                className="group inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try {drill.name}
                <ArrowRight className="h-4 w-4 transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 group-focus-within:translate-x-0.5" aria-hidden />
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
          <CircleIqMicroChallenge />
        </div>
      </div>
    </section>
  );
}
