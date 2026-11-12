// P10 moderation decision domain — reviewer decisions over tournaments,
// reviewer identity protections, and the audit-entry shape. All decisions are
// DISABLED: they validate intent only and throw before any table touch until
// the moderation authority (P10-04) and the retention rule (P10-07) land.

import type { OrganizerTournamentLifecycle } from "@/features/organizers/domain/permissions";

/** Decisions a moderator may record. Rejection returns to draft (P10-06). */
export const MODERATION_DECISIONS = [
  "publish",
  "return_to_draft",
  "republish",
  "unpublish",
  "archive",
] as const;

export type ModerationDecision = (typeof MODERATION_DECISIONS)[number];

export function isModerationDecision(value: unknown): value is ModerationDecision {
  return (
    typeof value === "string" && (MODERATION_DECISIONS as ReadonlyArray<string>).includes(value)
  );
}

/**
 * The lifecycle transition each decision performs. `return_to_draft` keeps
 * the public enum small: rejection is submitted → draft with the reason in
 * the audit trail, never a stored `rejected` state.
 */
export const DECISION_LIFECYCLE: Readonly<Record<ModerationDecision, { from: OrganizerTournamentLifecycle; to: OrganizerTournamentLifecycle }>> = {
  publish: { from: "submitted", to: "published" },
  return_to_draft: { from: "submitted", to: "draft" },
  republish: { from: "unpublished", to: "published" },
  unpublish: { from: "published", to: "unpublished" },
  archive: { from: "unpublished", to: "archived" },
};

/** Every decision requires a reason (5–500 chars). No silent moderation. */
export const MAX_DECISION_REASON_LENGTH = 500;
export const MIN_DECISION_REASON_LENGTH = 5;

/**
 * Moderation audit entry shape (proposed queue-table projection, not a live
 * table). Append-only; a duplicate or conflicting resolution for the same
 * review is rejected by the uniqueness rule documented in
 * `moderation-domain.md` (one open review per entity; one decision per
 * review).
 */
export interface ModerationAuditEntry {
  readonly tournamentId: string;
  readonly decision: ModerationDecision;
  readonly from: OrganizerTournamentLifecycle;
  readonly to: OrganizerTournamentLifecycle;
  readonly reason: string;
  readonly createdAt: string;
}

/**
 * Anti-abuse invariants, enforced in code today (validation shell) and in
 * the approving migration later (database):
 * - No self-approval: an organizer member can never decide on their own
 *   organizer's listing, even if they are also a platform admin. The review
 *   assignment must exclude members of the target organizer.
 * - No forged reviewer identity: reviewer identity derives from the session
 *   via `is_super_admin()`; it is never accepted as input.
 * - No duplicate/conflicting resolution: one open review per entity, one
 *   decision per review, terminal decisions immutable.
 */
export function isSelfApproval(reviewerOrganizerIds: ReadonlyArray<string>, targetOrganizerId: string): boolean {
  return reviewerOrganizerIds.includes(targetOrganizerId);
}
