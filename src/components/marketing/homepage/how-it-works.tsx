const STEPS = [
  {
    n: "01",
    title: "Choose a tool",
    text: "Pick the microtool for tonight's job — prizes, drafts, standings, sponsors, payouts, rosters, or patch facts.",
  },
  {
    n: "02",
    title: "Do the work",
    text: "Each tool does one job with minimal setup. Two of them need no account at all; the rest start free.",
  },
  {
    n: "03",
    title: "Move on",
    text: "Copy, share, or save your result and get back to the event. No bloated suite to maintain.",
  },
] as const;

/**
 * HowItWorks — the microtool philosophy in three steps. Deliberately narrow
 * and fast: never an all-in-one platform, never enterprise software.
 */
export function HowItWorks() {
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="how-it-works-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">How it works</p>
        <h2 id="how-it-works-heading" className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">
          Small tools, finished work.
        </h2>
      </div>
      <ol className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.n} className="rounded-[16px] border border-border bg-card p-5">
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
