import Link from "next/link";
import { MarketingCTA } from "@/components/marketing/cta-button";
import { siteConfig } from "@/config/site";
import { SpecimenCard } from "./specimen-card";

export function CampaignHero() {
  return (
    <section className="bg-arena-950 relative overflow-hidden text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(200,16,46,0.18),transparent_55%)]"
      />
      <div className="relative mx-auto grid w-full max-w-5xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
        <div className="min-w-0">
          <p className="text-accent-300 flex items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase">
            <span aria-hidden="true" className="bg-accent-600 inline-block h-3 w-1" />
            {siteConfig.name} · Unofficial community campaign
          </p>
          <h1 className="font-display mt-5 text-[clamp(2.25rem,7vw,3.75rem)] leading-[0.95] font-extrabold tracking-tight uppercase">
            Your game. Your identity. Your {siteConfig.name}.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Create your competitive player identity, share your player card and connect with the
            esports community.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:max-w-md sm:flex-row">
            <MarketingCTA href="/signup" className="sm:flex-1">
              Create your player card
            </MarketingCTA>
            <MarketingCTA href="/players" variant="ghost-on-dark" className="sm:flex-1">
              Explore players
            </MarketingCTA>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-slate-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Log in
            </Link>
          </p>
          <p className="mt-6 max-w-xl text-xs leading-relaxed text-slate-500">
            Independent of KRAFTON and any PMGC organizer. No event affiliation, logos, or
            schedules are claimed here.
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <SpecimenCard />
        </div>
      </div>
    </section>
  );
}
