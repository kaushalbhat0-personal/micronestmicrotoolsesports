import Link from "next/link";
import type { Route } from "next";
import { ArrowDown, ArrowRight, Crosshair } from "lucide-react";
import { getLabTool } from "@/lib/marketing/public-tool-content";

/**
 * LabFeatureSection — the homepage's first play moment. Fully static:
 * name/tagline/steps resolve from the Lab registry, CTAs link to the
 * drill page. The interactive drill itself is never imported here, so
 * the homepage bundle stays light.
 *
 * Two-stage visual hierarchy: ROUND 01 framing with an invitation
 * headline on one side, and two large YOUR CALL → RESULT stage panels
 * (CSS/SVG only, one-shot stroke draw) on the other. The steps read as
 * an open editorial list, not cards. No data fetching, no scoring,
 * no duplicated mechanics — the visitor simply sees something playable.
 */
const STEPS = [
  { n: "01", title: "Make your call", text: "Study the zone snapshot and pick the rotation you would call." },
  { n: "02", title: "Reveal the result", text: "See the recommended call instantly — no account, no waiting." },
  { n: "03", title: "Learn the why", text: "Every answer explains itself, so the reasoning transfers to matches." },
] as const;

function PlayStages() {
  return (
    <div className="grid gap-3" aria-hidden>
      <figure className="rounded-[16px] border border-border bg-surface-muted/50 p-5 sm:p-6">
        <p className="font-mono text-[11px] tracking-widest text-muted-foreground">YOUR CALL</p>
        <div className="mt-3 flex items-center gap-4">
          <svg width="112" height="112" viewBox="0 0 64 64" role="presentation" className="shrink-0">
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
          <p className="font-display text-xl font-normal tracking-tight sm:text-2xl">You pick the rotation.</p>
        </div>
      </figure>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span className="flex size-8 items-center justify-center rounded-full border border-primary/30 bg-primary/5">
          <ArrowDown className="h-4 w-4 text-primary" aria-hidden />
        </span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
      <figure className="rounded-[16px] border border-primary/25 bg-primary/[0.05] p-5 sm:p-6">
        <p className="font-mono text-[11px] tracking-widest text-primary">RESULT</p>
        <div className="mt-3 flex items-center gap-4">
          <svg width="112" height="112" viewBox="0 0 64 64" role="presentation" className="shrink-0">
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
          <p className="font-display text-xl font-normal tracking-tight sm:text-2xl">See the call, learn the why.</p>
        </div>
      </figure>
    </div>
  );
}

export function LabFeatureSection() {
  const drill = getLabTool("circle-iq");
  if (!drill) return null;
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="lab-feature-heading">
      <div className="mx-auto max-w-5xl rounded-[20px] border border-primary/15 bg-card p-6 sm:p-10">
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
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
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
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
          <div className="order-1 lg:order-2">
            <PlayStages />
          </div>
        </div>
      </div>
    </section>
  );
}
