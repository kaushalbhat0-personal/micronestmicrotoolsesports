import { Fragment } from "react";
import { ArrowRight } from "lucide-react";

const STEPS = [
  {
    n: "01",
    title: "Pick your tool",
    text: "Pick the microtool for tonight's job — prizes, drafts, standings, sponsors, payouts, rosters, or patch facts.",
  },
  {
    n: "02",
    title: "Make your move",
    text: "Each tool does one job with minimal setup. Two of them need no account at all; the rest start free.",
  },
  {
    n: "03",
    title: "Get your answer",
    text: "Copy, share, or save your result and get back to the event. No bloated suite to maintain.",
  },
] as const;

/**
 * HowItWorks — the microtool philosophy in three steps, framed as a
 * horizontal game loop: pick → move → answer. Large numerals with arrow
 * connectors carry the motion left to right; the header sits open and
 * left-aligned. Steps read as open typography with hairline rules —
 * no card chrome at this level.
 */
export function HowItWorks() {
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="how-it-works-heading">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">How it works</p>
        <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="how-it-works-heading" className="font-display text-2xl font-normal tracking-tight sm:text-3xl">
            Small tools, finished work.
          </h2>
          <p className="text-sm text-muted-foreground">No unnecessary setup. Just useful tools.</p>
        </div>
        <ol className="mt-10 grid items-start gap-8 sm:grid-cols-3 sm:gap-4">
          {STEPS.map((step, position) => (
            <Fragment key={step.n}>
              <li className="relative border-t border-border pt-5">
                <p className="font-display text-5xl font-normal tracking-tight text-primary" aria-hidden>
                  {step.n}
                </p>
                <h3 className="mt-3 text-base font-semibold leading-none tracking-[-0.01em]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                {position < STEPS.length - 1 ? (
                  <ArrowRight
                    className="absolute -right-4 top-8 hidden h-5 w-5 -translate-y-1/2 text-border-strong sm:block"
                    aria-hidden
                  />
                ) : null}
              </li>
            </Fragment>
          ))}
        </ol>
      </div>
    </section>
  );
}
