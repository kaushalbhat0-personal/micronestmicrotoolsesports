// Homepage closing CTA: points at existing public discovery plus account creation.
// Static only.

import { MarketingCTA } from "./cta-button";

export function ClosingCTA({
  title = "Your next opportunity starts here.",
  copy = "Create your FRAGIX identity, share your card immediately, and get BGMI ownership reviewed for the public player registry. Browse self-declared rosters and community tournament listings with zero platform lock-in.",
}: {
  title?: string;
  copy?: string;
}) {
  return (
    <div className="bg-paper text-ink-900 w-full">
      <div className="mx-auto w-full max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <p
          aria-hidden="true"
          className="font-display text-accent-600 text-sm font-extrabold tracking-[0.2em] uppercase"
        >
          Ecosystem participation — open index
        </p>
        <h2 className="font-display mt-4 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
          {title}
        </h2>
        <p className="text-ink-600 mx-auto mt-4 max-w-xl text-base leading-relaxed">{copy}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <MarketingCTA href="/signup">Sign up free</MarketingCTA>
          <MarketingCTA href="/players" variant="ghost-on-light">
            Explore the ecosystem
          </MarketingCTA>
        </div>
        <p className="text-slate-mid mt-6 text-xs tracking-wide uppercase">
          Strict opt-in basis — no commercial sale of player telemetry
        </p>
      </div>
    </div>
  );
}
