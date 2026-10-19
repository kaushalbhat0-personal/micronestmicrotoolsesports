import { ListChecks, Eye, UserX } from "lucide-react";

const POINTS = [
  {
    icon: ListChecks,
    title: "Clear inputs, clear outputs",
    text: "Every tool states what it needs and what it produces. Methods are explained on the page — rotation heuristics, qualification rulebooks, payout reconciliation.",
  },
  {
    icon: Eye,
    title: "Public data stays public",
    text: "Tournament standings cite their sources, patch facts link to theirs, and public drills run without accounts or tracking.",
  },
  {
    icon: UserX,
    title: "No account where none is needed",
    text: "BGMI Lab drills, the Qualification Simulator and public standings never ask for signup. Workspaces exist only where work must be kept.",
  },
] as const;

/**
 * TrustSection — restrained credibility. Only claims the product already
 * supports: explained methods, sourced public data, and honest boundaries.
 * No customers, counts, testimonials, revenue, or ratings — ever. Open
 * typographic columns keep this supporting section quiet.
 */
export function TrustSection() {
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="trust-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Why trust it</p>
        <h2 id="trust-heading" className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">
          Built to be useful first.
        </h2>
      </div>
      <div className="mx-auto mt-8 grid max-w-4xl gap-8 sm:grid-cols-3 sm:gap-6">
        {POINTS.map((item) => (
          <div key={item.title} className="border-t border-border pt-4">
            <item.icon className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="mt-3 text-[15px] font-semibold leading-none tracking-[-0.01em]">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
