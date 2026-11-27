import Link from "next/link";
import type { Route } from "next";
import { MarketingSection } from "@/components/marketing/section";

const tools = [
  {
    href: "/tools/prize-pool-splitter" as Route,
    title: "Prize Pool Splitter",
    body: "Plan exact per-position amounts. Not payments.",
  },
  {
    href: "/tools/roster-slot-builder" as Route,
    title: "Roster & Slot Builder",
    body: "Map starters and substitutes for your squad chat.",
  },
  {
    href: "/tools/tiebreak-qualifier" as Route,
    title: "Tie-Break Simulator",
    body: "Model cutoffs with your own criteria — not official results.",
  },
] as const;

export function ToolsStrip() {
  return (
    <MarketingSection
      id="tools"
      eyebrow="Also useful"
      title="Season planning tools"
      lede="Secondary utilities for organizers and managers. Client-side only — no account required."
    >
      <ul className="grid gap-3 sm:grid-cols-3">
        {tools.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="flex min-h-[44px] flex-col border border-steel-200 bg-paper p-4 hover:border-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              <span className="font-display text-sm font-extrabold tracking-tight uppercase">
                {tool.title}
              </span>
              <span className="mt-1 text-xs leading-relaxed text-ink-600">{tool.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
