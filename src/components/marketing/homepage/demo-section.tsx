import Link from "next/link";
import { Split, ClipboardList } from "lucide-react";

const DEMOS = [
  {
    icon: Split,
    name: "Prize Pool Splitter",
    text: "Split a real prize pool — percentages, ranked, or custom — and copy the result.",
    cta: "Try Prize Pool Splitter",
    href: "/tools/prize-pool-splitter",
  },
  {
    icon: ClipboardList,
    name: "Tournament Roster & Slot Builder",
    text: "Paste messy registrations and get a clean, copy-ready slot list.",
    cta: "Build a roster",
    href: "/tools/tournament-roster-builder",
  },
] as const;

/**
 * DemoSection — anonymous hands-on value. Destinations reuse the existing
 * public tool pages that already host the client-side demos. Demos are
 * ephemeral (browser-only): nothing is saved, so copy says so.
 */
export function DemoSection() {
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="demo-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">No signup needed</p>
        <h2 id="demo-heading" className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">
          Try the toolbox before creating an account.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Selected tools run entirely in your browser. Nothing is saved — copy, share, or export
          your result, and create a workspace when you want to keep work.
        </p>
      </div>
      <div className="mx-auto mt-8 grid max-w-4xl gap-5 sm:grid-cols-2">
        {DEMOS.map((demo) => (
          <div key={demo.href} className="flex flex-col rounded-[16px] border border-border bg-card p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-muted">
              <demo.icon className="h-5 w-5 text-muted-foreground" aria-hidden />
            </span>
            <h3 className="mt-3 text-[15px] font-semibold leading-none tracking-[-0.01em]">{demo.name}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{demo.text}</p>
            <div className="mt-4">
              <Link
                href={demo.href}
                aria-label={`${demo.cta} now — no signup needed`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {demo.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
