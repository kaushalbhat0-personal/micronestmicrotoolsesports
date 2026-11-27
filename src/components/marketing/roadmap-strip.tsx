// M2 Coming-soon roadmap strip on arena: every unshipped domain in one
// clearly labelled place. No links, no CTAs, no dates, no promises —
// "Planned" only. Static only.

import { MarketingSection } from "./section";

const planned: Array<{ name: string; scope: string }> = [
  { name: "Teams", scope: "Rosters and team discovery" },
  { name: "Organizations", scope: "Org structure and operations" },
  { name: "Brands", scope: "Partnership discovery" },
  { name: "Opportunities", scope: "Tryouts, roles and applications" },
  { name: "Tournaments", scope: "Competitive operations" },
  { name: "News & mini games", scope: "Supporting sections" },
];

export function RoadmapStrip() {
  return (
    <MarketingSection
      id="roadmap"
      tone="arena"
      eyebrow="Coming soon"
      title="On the roadmap — not sold as shipped"
      lede="These domains are planned and will be announced when they exist. Until then they live here, labelled, with nothing to join."
    >
      <ul className="grid gap-px overflow-hidden rounded-sm border border-white/15 bg-white/15 sm:grid-cols-2 lg:grid-cols-3">
        {planned.map((item) => (
          <li key={item.name} className="bg-arena-950 p-6">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-display text-lg font-extrabold tracking-tight uppercase">
                {item.name}
              </span>
              <span className="inline-block rounded-sm border border-white/30 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-slate-300 uppercase">
                Planned
              </span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.scope}</p>
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
