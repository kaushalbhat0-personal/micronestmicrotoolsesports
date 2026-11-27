// Illustrative FRAGIX player-card specimen for campaign marketing.
// Static only — labelled specimen fields, no real athlete data or stats.

import { siteConfig } from "@/config/site";

const rows: Array<{ label: string; value: string }> = [
  { label: "IGN", value: "SAMPLE_IGN" },
  { label: "Handle", value: "@demo_player" },
  { label: "Game", value: "BGMI" },
  { label: "Primary role", value: "In-Game Leader" },
  { label: "Region", value: "India · North" },
  { label: "Play modes", value: "Squad (TPP)" },
];

export function SpecimenCard() {
  return (
    <figure
      aria-label="Illustrative FRAGIX player card specimen"
      className="bg-arena-950 w-full max-w-md border border-white/15 text-white shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
    >
      <div aria-hidden="true" className="bg-accent-600 h-1.5 w-full" />
      <div className="flex items-center gap-3 px-5 pt-5">
        <svg width="40" height="40" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
          <rect width="28" height="28" rx="3" fill="#FFFFFF" />
          <path d="M8 7h12v3H11v3.5h7.5v3H11V21H8V7z" fill="#0A0E14" />
          <rect x="8" y="21" width="12" height="2.5" fill="#C8102E" />
        </svg>
        <div className="min-w-0">
          <p className="font-display text-sm font-extrabold tracking-tight uppercase">
            {siteConfig.name}
          </p>
          <p className="text-accent-300 text-[11px] font-semibold tracking-[0.12em] uppercase">
            {siteConfig.tagline}
          </p>
        </div>
      </div>

      <div className="px-5 pt-5">
        <p className="text-accent-300 text-[11px] font-bold tracking-[0.16em] uppercase">
          FRAGIX player identity
        </p>
        <figcaption className="font-display mt-2 text-2xl font-extrabold tracking-tight uppercase sm:text-3xl">
          Demo Player
        </figcaption>
        <p className="mt-1 text-sm text-slate-300">BGMI · @demo_player</p>
      </div>

      <dl className="mt-5 divide-y divide-white/10 border-y border-white/10 px-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-[11px] font-bold tracking-[0.14em] text-slate-400 uppercase">
              {row.label}
            </dt>
            <dd className="min-w-0 truncate font-mono text-sm text-slate-100">{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="px-5 py-4 text-xs leading-relaxed text-slate-400">
        Illustrative specimen only — not a real athlete. Sharing a card does not require ownership
        review. The ownership-reviewed badge appears only after approval.
      </p>

      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[11px] font-bold tracking-[0.14em] text-slate-300 uppercase">
          {siteConfig.name} · {siteConfig.tagline}
        </p>
        <p className="text-accent-300 mt-1 text-xs">players/@demo_player</p>
      </div>
    </figure>
  );
}
