import type { Metadata } from "next";
import Link from "next/link";
import { TeamForm } from "../_components/team-form";
import { buildTeamsCanonicalUrl } from "../_lib/query";

export const metadata: Metadata = {
  title: "Create a team",
  description: "Start a new MicroNest Esports team for your game and region.",
  robots: { index: false, follow: true },
  ...(buildTeamsCanonicalUrl("/teams/new") === undefined
    ? {}
    : { alternates: { canonical: buildTeamsCanonicalUrl("/teams/new") } }),
};

// Team creation experience (P14-D6): form wired to createTeamAction.
export default function NewTeamPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-6 text-sm">
        <Link
          href="/teams"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to team directory
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Create a team</h1>
      <p className="mt-3 max-w-2xl text-base text-slate-600">
        Set up your team identity, game, region and competitive context. Levels are self-reported —
        never a MicroNest rating.
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <TeamForm />
      </div>
    </div>
  );
}
