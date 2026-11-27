import Link from "next/link";
import { MarketingCTA } from "@/components/marketing/cta-button";
import { siteConfig } from "@/config/site";

export function CampaignCta() {
  return (
    <section className="bg-arena-950 text-white" aria-labelledby="campaign-cta-heading">
      <div className="mx-auto w-full max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <p className="text-accent-300 text-xs font-bold tracking-[0.2em] uppercase">
          {siteConfig.name} · {siteConfig.tagline}
        </p>
        <h2
          id="campaign-cta-heading"
          className="font-display mt-4 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl"
        >
          Your squad is out there.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
          Create your identity, share your card, and connect with competitive players starting with
          BGMI.
        </p>
        <div className="mx-auto mt-8 max-w-sm">
          <MarketingCTA href="/signup">Create your FRAGIX identity</MarketingCTA>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Or{" "}
          <Link
            href="/login"
            className="font-semibold text-slate-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            log in
          </Link>{" "}
          to continue your profile.
        </p>
      </div>
    </section>
  );
}
