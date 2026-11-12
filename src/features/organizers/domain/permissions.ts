// P9 organizer permission model — minimal, evolvable, least-privilege.
// Roles (frozen vocabulary, stored per membership row):
//
// - `owner`: created the organizer profile. Owns identity columns, manages
//   members, manages tournaments, submits for publication. Immutable origin:
//   the founding owner row can never be edited or transferred in v1 (no
//   transfer workflow exists).
// - `admin`: manages the organizer profile fields and tournaments, submits
//   for publication. Cannot manage members, cannot touch verification.
// - `editor`: drafts and edits tournaments only. Cannot touch the organizer
//   profile, members, or publication transitions beyond submit.
// - Platform `moderator`: NOT an organizer role. Moderation authority derives
//   from `public.platform_admins` via `is_super_admin()` (D1). Moderator
//   publish/unpublish/archive powers are modelled below but stay DISABLED
//   until the moderation boundary is approved.
//
// What is deliberately NOT modelled:
// - Organization-member → organizer-rights inheritance (never implied).
// - Self-approved verification (no member can touch `trust_state`).
// - Ownership transfer (no workflow exists; owner columns immutable).
// - Multi-admin requirement: a single owner is sufficient at launch.

export const ORGANIZER_ROLES = ["owner", "admin", "editor"] as const;

export type OrganizerRole = (typeof ORGANIZER_ROLES)[number];

export function isOrganizerRole(value: unknown): value is OrganizerRole {
  return typeof value === "string" && (ORGANIZER_ROLES as ReadonlyArray<string>).includes(value);
}

/** Tournament lifecycle (P9): extends the P3 draft/published/unpublished proposal. */
export const ORGANIZER_TOURNAMENT_LIFECYCLE = [
  "draft",
  "submitted",
  "published",
  "unpublished",
  "archived",
] as const;

export type OrganizerTournamentLifecycle = (typeof ORGANIZER_TOURNAMENT_LIFECYCLE)[number];

export function isOrganizerTournamentLifecycle(
  value: unknown
): value is OrganizerTournamentLifecycle {
  return (
    typeof value === "string" &&
    (ORGANIZER_TOURNAMENT_LIFECYCLE as ReadonlyArray<string>).includes(value)
  );
}

export interface LifecycleTransition {
  readonly from: OrganizerTournamentLifecycle;
  readonly to: OrganizerTournamentLifecycle;
  /** Organizer-side roles permitted to request this transition. `moderator` = platform admin. */
  readonly allowedBy: ReadonlyArray<OrganizerRole | "moderator">;
  /** True while the moderation boundary is unresolved: the transition validates but never executes. */
  readonly disabledReason: string | null;
}

/**
 * Approved transition table. Rejection is represented as submitted → draft
 * (returned with a reason), not as a stored state — the audit history for
 * the return lives in the moderation queue follow-up, not in a status enum.
 */
export const LIFECYCLE_TRANSITIONS: ReadonlyArray<LifecycleTransition> = [
  { from: "draft", to: "submitted", allowedBy: ["owner", "admin", "editor"], disabledReason: null },
  {
    from: "submitted",
    to: "published",
    allowedBy: ["moderator"],
    disabledReason:
      "Moderation authority is unresolved: publishing a submitted tournament requires an approved reviewer boundary.",
  },
  {
    from: "submitted",
    to: "draft",
    allowedBy: ["moderator"],
    disabledReason:
      "Moderation authority is unresolved: returning a submission requires an approved reviewer boundary.",
  },
  {
    from: "published",
    to: "unpublished",
    allowedBy: ["owner", "admin", "moderator"],
    disabledReason: null,
  },
  {
    from: "unpublished",
    to: "published",
    allowedBy: ["moderator"],
    disabledReason:
      "Re-publication requires moderator review: silent reactivation of an unpublished listing is not permitted.",
  },
  {
    from: "unpublished",
    to: "archived",
    allowedBy: ["moderator"],
    disabledReason:
      "Archival authority is unresolved: archiving destroys discoverability and requires an approved retention rule.",
  },
  {
    from: "published",
    to: "archived",
    allowedBy: ["moderator"],
    disabledReason:
      "Archival authority is unresolved: archiving destroys discoverability and requires an approved retention rule.",
  },
];

export function findTransition(
  from: OrganizerTournamentLifecycle,
  to: OrganizerTournamentLifecycle
): LifecycleTransition | null {
  return LIFECYCLE_TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

export function canRoleTransition(
  role: OrganizerRole | "moderator",
  from: OrganizerTournamentLifecycle,
  to: OrganizerTournamentLifecycle
): boolean {
  const transition = findTransition(from, to);
  if (transition === null) {
    return false;
  }
  return (transition.allowedBy as ReadonlyArray<string>).includes(role);
}

/** Organizer profile capabilities per role (publication excluded — see lifecycle table). */
export function canManageOrganizerProfile(role: OrganizerRole): boolean {
  return role === "owner" || role === "admin";
}

export function canManageMembers(role: OrganizerRole): boolean {
  return role === "owner";
}

export function canEditTournaments(role: OrganizerRole): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}

/** No organizer role may touch verification. Verification is moderator-only AND disabled. */
export function canTouchVerification(role: OrganizerRole | "moderator"): boolean {
  void role;
  return false;
}

export const ORGANIZER_PERMISSIONS_NOTE =
  "Organizer membership never inherits from esports organization membership. Verification can never be self-approved.";
