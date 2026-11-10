const POINTS = [
  {
    label: "PUBLIC DATA",
    text: "Tournament standings cite their sources; patch facts link to theirs.",
  },
  {
    label: "NO ACCOUNT",
    text: "Drills and public standings run without accounts or tracking.",
  },
  {
    label: "CLEAR METHODS",
    text: "Every tool states what it needs and what it produces.",
  },
] as const;

/**
 * TrustSection — restrained credibility as a compact editorial strip, not
 * three cards. One connected panel with dividers; each proof point is a
 * factual label with a single line sourced from existing product copy.
 * Only claims the product already supports: sourced public data, honest
 * boundaries, explained methods. No customers, counts, testimonials,
 * revenue, or ratings — ever.
 */
export function TrustSection() {
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="trust-heading">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Why trust it</p>
            <h2 id="trust-heading" className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">
              Built to be useful first.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Only what the product already does — explained methods, sourced public data, honest boundaries.
          </p>
        </div>
        <dl className="mt-8 grid gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-3">
          {POINTS.map((item) => (
            <div key={item.label} className="bg-card p-5 sm:p-6">
              <dt className="font-mono text-[11px] tracking-widest text-primary">{item.label}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
