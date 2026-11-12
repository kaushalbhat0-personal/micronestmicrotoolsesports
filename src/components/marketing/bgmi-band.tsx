// M2 BGMI-first positioning: editorial big-type band on paper.
// States the initial title focus without implying exclusivity or making
// competitive claims. Static only.

import { MarketingSection } from "./section";

const facts: Array<string> = [
  "One active title today: Battlegrounds Mobile India (BGMI)",
  "Per-game profiles keep every title's identity separate",
  "Directory filters are game-aware from day one",
  "New titles plug into the same projection — no rebuild",
];

export function BgmiBand() {
  return (
    <MarketingSection
      id="bgmi-first"
      eyebrow="Game focus"
      title="Starting with BGMI. Built for every title."
      lede="The ecosystem launches where the competition already is — Battlegrounds Mobile India. The architecture underneath is multi-title-ready, so expansion adds catalogues, not rewrites."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
        <p aria-hidden="true" className="font-display text-[clamp(3rem,9vw,5.5rem)] leading-[0.9] font-extrabold tracking-tight uppercase">
          BGMI
          <span className="text-accent-600"> first</span>
          <span className="mt-1 block text-ghost">— every title next.</span>
        </p>
        <ul className="border-l-2 border-accent-600 pl-6">
          {facts.map((fact) => (
            <li key={fact} className="py-2.5 text-sm font-medium sm:text-base">
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </MarketingSection>
  );
}
