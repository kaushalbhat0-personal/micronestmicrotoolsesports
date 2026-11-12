// Permission explanation (P2). States the proposed authority matrix (`02`,
// AWAITING approval) in plain language for the caller's own basis. Read-only
// copy: it grants nothing, and every unavailable capability names its
// blocker instead of implying access. Co-captains are explicitly rightless;
// organization membership is explicitly non-authoritative (D1-D4).

import type { WorkspaceRole } from "@/features/teams/domain/workspace";

const basisCopy: Record<WorkspaceRole, string> = {
  owner: "You own this team. You can edit its public fields; appointing captains, removing members and transferring ownership arrive with owner approval and are unavailable in this phase.",
  captain: "You captain this team. You can edit its public fields; member changes, application decisions and captain appointments arrive with owner approval and are unavailable in this phase.",
  member: "You are a member of this team. Management actions are read-only for you; only owners and captains edit team fields.",
};

export function PermissionNote({ role }: { role: WorkspaceRole }) {
  return (
    <section
      aria-label="Your permissions"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold tracking-wide uppercase">Your permissions</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{basisCopy[role]}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li>Co-captains hold no management rights until a subset is specified.</li>
        <li>Organization membership never implies team authority.</li>
        <li>Suspended accounts cannot write, even as owners or captains.</li>
        <li>Ownership transfer is unavailable — no transfer action exists.</li>
      </ul>
    </section>
  );
}
