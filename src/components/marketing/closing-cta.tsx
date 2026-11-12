// Homepage closing CTA: points at existing public discovery only.
// No registration promise, no signup action. Static only.

import { MarketingCTA } from "./cta-button";

export function ClosingCTA({
  title = "Your next opportunity starts here.",
  copy = "Browse an open, transparent esports directory — opt-in player projections, self-declared rosters, and community tournament listings with zero platform lock-in.",
}: {
  title?: string;
  copy?: string;
}) {
  return (
    <div className="w-full bg-paper text-ink-900">
      <div className="mx-auto w-full max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <p aria-hidden="true" className="font-display text-sm font-extrabold tracking-[0.2em] text-accent-600 uppercase">
          Ecosystem participation — open index
        </p>
        <h2 className="font-display mt-4 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-600">
          {copy}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <MarketingCTA href="/players">Explore the ecosystem</MarketingCTA>
          <MarketingCTA href="/about" variant="ghost-on-light">
            Read our ethical data policy
          </MarketingCTA>
        </div>
        <p className="mt-6 text-xs tracking-wide text-slate-mid uppercase">
          Strict opt-in basis — no commercial sale of player telemetry
        </p>
      </div>
    </div>
  );
}
