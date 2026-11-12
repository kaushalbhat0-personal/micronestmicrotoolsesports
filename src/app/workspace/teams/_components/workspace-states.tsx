// Workspace route states (P2). Honest shells for the three non-data
// outcomes: signed-out, unavailable (transport or pre-migration missing
// tables/RPCs — never raw detail), and empty (no managed teams yet).
// No rows invented, no existence signals.

import Link from "next/link";

const shellClass = "mx-auto w-full max-w-3xl px-4 py-10 sm:px-6";

export function WorkspaceSignInPrompt() {
  return (
    <div className={shellClass}>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Team workspace</h1>
      <p className="mt-3 text-sm text-slate-600">Sign in to manage your teams.</p>
      <p className="mt-4">
        <Link
          href={{ pathname: "/login", query: { next: "/workspace/teams" } }}
          className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-sm text-slate-600">
        Team management is available to signed-in players who own teams or serve as captains.
      </p>
    </div>
  );
}

export function WorkspaceUnavailable() {
  return (
    <div className={shellClass}>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Team workspace</h1>
      <div role="alert" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold">Workspace unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">
          Could not load your teams. Please try again.
        </p>
        <Link
          href="/workspace/teams"
          className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}

export function WorkspaceEmpty() {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
      <h2 className="text-lg font-semibold">No teams yet</h2>
      <p className="mt-2 text-sm text-slate-600">
        You do not own or manage any teams. When you create or captain a team, it will appear
        here.
      </p>
      <Link
        href="/teams/new"
        className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Create a team
      </Link>
      <p className="mt-3 text-xs text-slate-500">
        Create a team to manage settings and view your roster in the workspace.
      </p>
    </div>
  );
}
