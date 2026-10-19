import { Puzzle, Zap, Share2 } from "lucide-react";

const PRINCIPLES = [
  {
    icon: Puzzle,
    title: "Narrow by design",
    text: "Each tool solves one operational problem well. Use what you need, skip the rest.",
  },
  {
    icon: Zap,
    title: "Fast to start",
    text: "No onboarding program, no enterprise rollout. Open a tool and do the work.",
  },
  {
    icon: Share2,
    title: "Built to be shared",
    text: "Results are made to be copied, published, or handed to the other side — prizes, drafts, standings, payouts, and patch facts alike.",
  },
] as const;

/**
 * PhilosophySection — toolbox-level credibility. Principles only: no customer
 * counts, testimonials, revenue figures, or invented statistics. Open
 * typographic columns with hairline rules keep this supporting section
 * quiet — no card chrome.
 */
export function PhilosophySection() {
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="philosophy-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Why microtools</p>
        <h2 id="philosophy-heading" className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">
          Less software between you and the work.
        </h2>
      </div>
      <div className="mx-auto mt-8 grid max-w-4xl gap-8 sm:grid-cols-3 sm:gap-6">
        {PRINCIPLES.map((item) => (
          <div key={item.title} className="border-t border-border pt-4">
            <item.icon className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="mt-3 text-[15px] font-semibold leading-none tracking-[-0.01em]">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
        Built in Pune for the Indian esports scene.
      </p>
    </section>
  );
}
