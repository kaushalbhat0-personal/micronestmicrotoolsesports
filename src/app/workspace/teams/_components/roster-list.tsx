// Roster presentation (P2).
// Member cards show membership role (captain highlighted), game-specific
// role, and a "you" marker for the caller's own row. Raw user_ids are keys
// only — never rendered. The owner may sit outside the roster (authority ≠
// roster row): the management note states this instead of inventing rows.
// Add/remove, captain assignment and application-driven insertion are
// explicitly unavailable (no RPCs, D1-D3/D1-D12 pending) — no controls exist.

import type { RosterMemberView } from "@/features/teams/domain/workspace";

export function RosterMemberCard({ member }: { member: RosterMemberView }) {
  const isCaptain = member.role === "captain";
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-4 ${isCaptain ? "border-amber-300" : "border-slate-200"}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {isCaptain ? "Captain" : member.role}
          {member.is_self ? <span className="font-normal text-slate-500"> · you</span> : null}
        </p>
        <p className="mt-0.5 text-sm text-slate-600">
          {member.game_role ?? "Flexible role"}
        </p>
      </div>
      {isCaptain ? (
        <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
          Captain
        </span>
      ) : (
        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          {member.role}
        </span>
      )}
    </li>
  );
}

export function RosterList({ members }: { members: RosterMemberView[] }) {
  return (
    <div>
      {members.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <h2 className="text-lg font-semibold">Empty roster</h2>
          <p className="mt-2 text-sm text-slate-600">
            No members yet. Member invitations arrive with owner approval and are unavailable in
            this phase.
          </p>
        </div>
      ) : (
        <ul aria-label="Team roster" className="grid gap-3 sm:grid-cols-2">
          {members.map((member) => (
            <RosterMemberCard key={member.key} member={member} />
          ))}
        </ul>
      )}
      <p
        role="note"
        className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        Roster changes are disabled in this phase: adding or removing members, assigning
        captains, and application-driven joins arrive with owner approval. The team owner may
        manage without holding a roster row.
      </p>
    </div>
  );
}
