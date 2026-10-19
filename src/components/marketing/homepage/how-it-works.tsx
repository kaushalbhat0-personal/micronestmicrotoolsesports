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
 * quiet game loop: pick, move, answer. Deliberately narrow and fast:
 * never an all-in-one platform, never enterprise software. Steps read as
 * open typography with hairline rules — no card chrome at this level.
 */
export function HowItWorks() {
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="how-it-works-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">How it works</p>
        <h2 id="how-it-works-heading" className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">
          Small tools, finished work.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">No unnecessary setup. Just useful tools.</p>
      </div>
      <ol className="mx-auto mt-8 grid max-w-4xl gap-8 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((step) => (
          <li key={step.n} className="border-t border-border pt-4">
            <p className="font-mono text-[11px] tracking-widest text-primary" aria-hidden>
              {step.n}
            </p>
            <h3 className="mt-2 text-[15px] font-semibold leading-none tracking-[-0.01em]">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
