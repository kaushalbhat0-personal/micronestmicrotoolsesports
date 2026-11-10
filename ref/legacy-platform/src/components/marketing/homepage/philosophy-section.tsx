const PRINCIPLES = [
  {
    title: "Narrow by design",
    text: "Each tool solves one operational problem well. Use what you need, skip the rest.",
  },
  {
    title: "Fast to start",
    text: "No onboarding program, no enterprise rollout. Open a tool and do the work.",
  },
  {
    title: "Built to be shared",
    text: "Results are made to be copied, published, or handed to the other side — prizes, drafts, standings, payouts, and patch facts alike.",
  },
] as const;

/**
 * PhilosophySection — toolbox-level credibility as a statement, not a
 * card grid. One large claim with a short explanation on the left; the
 * three principles read as an open hairline list on the right. Principles
 * only: no customer counts, testimonials, revenue figures, or invented
 * statistics.
 */
export function PhilosophySection() {
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="philosophy-heading">
      <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Why microtools</p>
          <h2 id="philosophy-heading" className="font-display mt-3 max-w-xl text-4xl font-normal leading-[1.05] tracking-tight sm:text-5xl">
            Tools should get out of your way.
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
            MicroNest keeps every tool narrow by design and fast to start, so results are built to
            be shared — use what you need, skip the rest.
          </p>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Built in Pune for the Indian esports scene.
          </p>
        </div>
        <dl className="border-t border-border">
          {PRINCIPLES.map((item) => (
            <div key={item.title} className="border-b border-border py-5">
              <dt className="text-[15px] font-semibold leading-none tracking-[-0.01em]">{item.title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
