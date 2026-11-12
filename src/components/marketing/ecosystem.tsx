// M2 ecosystem introduction: how the four audiences connect.
// Consent-first and honest: step 4 (teams/orgs/brands discovering) is
// labelled Coming soon because those discovery surfaces do not ship yet.
// No signup CTA anywhere (G1-8B pending). Static only.

import { MarketingSection } from "./section";

const steps: Array<{
  seed: string;
  title: string;
  copy: string;
  status: "Live now" | "Coming soon";
}> = [
  {
    seed: "01",
    title: "Players build a profile",
    copy: "One canonical identity with per-game profiles — handle, in-game name, role, region and availability.",
    status: "Live now",
  },
  {
    seed: "02",
    title: "Players choose discoverability",
    copy: "Nothing is public by default. Players opt in, and control visibility game by game.",
    status: "Live now",
  },
  {
    seed: "03",
    title: "The directory lists them",
    copy: "A public, filterable player directory. Only opted-in profiles appear — search by game, region, role or name.",
    status: "Live now",
  },
  {
    seed: "04",
    title: "Teams, orgs and brands discover",
    copy: "Dedicated discovery surfaces and opportunity workflows for the other three audiences.",
    status: "Coming soon",
  },
];

export function Ecosystem() {
  return (
    <MarketingSection
      id="ecosystem"
      eyebrow="The ecosystem"
      title="One connected discovery ecosystem"
      lede="Players, teams, organizations and brands find one another in a single place — instead of scattered tryout posts, DMs and spreadsheets. The player side of that loop is operational today."
    >
      <ol className="grid gap-px overflow-hidden rounded-sm border border-steel-200 bg-steel-200 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <li key={step.seed} className="flex flex-col bg-paper p-6">
            <span aria-hidden="true" className="font-display text-4xl font-extrabold text-ghost">
              {step.seed}
            </span>
            <h3 className="mt-3 text-base font-bold">{step.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{step.copy}</p>
            <p className="mt-4">
              <span
                className={
                  step.status === "Live now"
                    ? "inline-block rounded-sm bg-accent-600 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-white uppercase"
                    : "inline-block rounded-sm border border-ink-900/25 px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-ink-600 uppercase"
                }
              >
                {step.status}
              </span>
            </p>
          </li>
        ))}
      </ol>
    </MarketingSection>
  );
}
