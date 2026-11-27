// Homepage tools showcase (Stitch-approved composition).
// Descriptions match the implemented static catalogue exactly
// (src/features/tools/catalog.ts): client-side planning calculators, no
// accounts, no payments, no custody. Slugs are the real registry slugs —
// never the Stitch draft names.

import Link from "next/link";
import { TOOL_REGISTRY } from "@/features/tools/catalog";
import { MarketingCTA } from "./cta-button";
import { MarketingSection } from "./section";

const toolOrder = ["prize-pool-splitter", "roster-slot-builder", "tiebreak-qualifier"] as const;

const toolTags: Record<string, string> = {
  "prize-pool-splitter": "Tool 01 — Financial discipline",
  "roster-slot-builder": "Tool 02 — Roster management",
  "tiebreak-qualifier": "Tool 03 — Lobby scoring",
};

export function ToolsShowcase() {
  const tools = toolOrder
    .map((slug) => TOOL_REGISTRY.find((tool) => tool.slug === slug))
    .filter((tool): tool is NonNullable<typeof tool> => tool !== undefined);

  return (
    <MarketingSection
      id="tools"
      eyebrow="Workbench suite"
      title="Client-side esports utilities"
      lede="Zero-telemetry, browser-based calculators for players, coaches, and grassroots organizers. No accounts required — everything runs in this browser session."
    >
      <ul className="grid gap-px overflow-hidden border border-slate-light bg-slate-light lg:grid-cols-3">
        {tools.map((tool) => (
          <li key={tool.slug} className="flex flex-col bg-paper p-6">
            <p className="text-[11px] font-bold tracking-[0.16em] text-ink-600 uppercase">
              {toolTags[tool.slug] ?? "Esports utility"}
            </p>
            <h3 className="font-display mt-2 text-xl font-extrabold tracking-tight uppercase">
              <Link
                href={`/tools/${tool.slug}`}
                className="inline-flex min-h-[44px] items-center rounded-none underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              >
                {tool.name}
              </Link>
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{tool.tagline}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-mid">{tool.description}</p>
            <div className="mt-4 flex flex-1 flex-col justify-end">
              <Link
                href={`/tools/${tool.slug}`}
                className="inline-flex min-h-[44px] items-center text-sm font-bold text-accent-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              >
                Open {tool.name}
                <span aria-hidden="true" className="ml-1">
                  →
                </span>
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <MarketingCTA href="/tools" variant="dark">
          Browse all tools
        </MarketingCTA>
      </div>
    </MarketingSection>
  );
}
