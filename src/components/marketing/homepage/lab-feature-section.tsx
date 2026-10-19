import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Crosshair } from "lucide-react";
import { getLabTool } from "@/lib/marketing/public-tool-content";

/**
 * LabFeatureSection — acquisition teaser for the BGMI Lab exemplar.
 * Fully static: name/tagline/steps resolve from the Lab registry, CTAs
 * link to the drill page. The interactive drill itself is never imported
 * here, so the homepage bundle stays light.
 *
 * The game loop is told visually, not mechanically: a CSS/SVG-only
 * circle motif (your call → result) with a one-shot stroke draw.
 * No data fetching, no scoring, no duplicated mechanics.
 */
const STEPS = [
  { n: "01", title: "Make your call", text: "Study the zone snapshot and pick the rotation you would call." },
  { n: "02", title: "Reveal the result", text: "See the recommended call instantly — no account, no waiting." },
  { n: "03", title: "Learn the why", text: "Every answer explains itself, so the reasoning transfers to matches." },
] as const;

function CircleMotif() {
  return (
    <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center" aria-hidden>
      <figure className="flex flex-1 items-center gap-3 rounded-[12px] border border-border bg-surface-muted/40 p-4">
        <svg width="64" height="64" viewBox="0 0 64 64" role="presentation" className="shrink-0">
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--color-border)" strokeWidth="2" />
          <circle
            cx="32"
            cy="32"
            r="16"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            className="nest-draw"
            style={{ ["--draw-len" as string]: 101, animationDelay: "200ms" }}
          />
          <circle cx="24" cy="40" r="3.5" fill="var(--color-primary)" />
          <path d="M24 40 L32 32" stroke="var(--color-foreground-muted)" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
        <figcaption>
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground">YOUR CALL</p>
          <p className="mt-1 text-sm font-medium">You pick the rotation.</p>
        </figcaption>
      </figure>
      <span className="hidden shrink-0 items-center justify-center sm:flex" aria-hidden>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </span>
      <figure className="flex flex-1 items-center gap-3 rounded-[12px] border border-primary/20 bg-primary/[0.04] p-4">
        <svg width="64" height="64" viewBox="0 0 64 64" role="presentation" className="shrink-0">
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--color-border)" strokeWidth="2" />
          <circle cx="32" cy="32" r="16" fill="none" stroke="var(--color-primary)" strokeWidth="2" />
          <circle cx="24" cy="40" r="3.5" fill="var(--color-primary)" />
          <path
            d="M27 32.5 L31 36.5 L38 28.5"
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="nest-draw"
            style={{ ["--draw-len" as string]: 30, animationDelay: "600ms" }}
          />
        </svg>
        <figcaption>
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground">RESULT</p>
          <p className="mt-1 text-sm font-medium">See the call, learn the why.</p>
        </figcaption>
      </figure>
    </div>
  );
}

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
        <CircleMotif />
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
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
