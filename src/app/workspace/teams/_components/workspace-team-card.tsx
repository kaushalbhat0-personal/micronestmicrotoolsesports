// Managed team card (P2). Shows the team identity plus the CALLER's own
// management basis (owner / captain / member) — never another user's basis,
// never ownership internals, never applicant data. Links into the workspace
// views and out to the public page.

import Link from "next/link";
import type { ManagedTeam } from "@/features/teams/domain/workspace";
import { getGameByKey } from "@/lib/game-catalog/catalog";

const basisStyles: Record<string, string> = {
  owner: "bg-slate-900 text-white",
  captain: "bg-amber-100 text-amber-900",
  member: "bg-slate-100 text-slate-600",
};

const basisLabels: Record<string, string> = {
  owner: "Owner — you manage this team",
  captain: "Captain — you manage this team",
  member: "Member — read-only",
};

export function WorkspaceTeamCard({ team }: { team: ManagedTeam }) {
  const gameName = getGameByKey(team.game_key)?.shortName ?? team.game_key;
  return (
    <article
      aria-label={`Managed team ${team.name}`}
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">
            <Link
              href={`/workspace/teams/${team.id}`}
              className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {team.name}
            </Link>{" "}
            <span className="font-normal text-slate-500">@{team.slug}</span>
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {gameName} · {team.region_code} · {team.member_count}{" "}
            {team.member_count === 1 ? "member" : "members"}
          </p>
        </div>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${basisStyles[team.role] ?? basisStyles["member"] ?? ""}`}
        >
          {basisLabels[team.role] ?? team.role}
        </span>
      </div>
      <nav aria-label={`Manage ${team.name}`} className="mt-3 flex flex-wrap gap-2 text-sm">
        <Link
          href={`/workspace/teams/${team.id}`}
          className="rounded-md border border-slate-300 px-3 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Overview
        </Link>
        <Link
          href={`/workspace/teams/${team.id}/settings`}
          className="rounded-md border border-slate-300 px-3 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Settings
        </Link>
        <Link
          href={`/workspace/teams/${team.id}/roster`}
          className="rounded-md border border-slate-300 px-3 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Roster
        </Link>
        <Link
          href={`/teams/${team.slug}`}
          className="rounded-md px-3 py-1.5 text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Public page
        </Link>
      </nav>
    </article>
  );
}
