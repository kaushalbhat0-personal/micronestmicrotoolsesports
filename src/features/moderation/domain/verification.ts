// P10 organizer verification workflow — states, evidence categories, role
// boundaries, retention, rejection/re-verification/expiry, reviewer audit.
// Every transition is DISABLED: verification requires the separately approved
// evidence-handling and retention policy (P10-05), and no evidence upload
// system exists until storage, access, and retention policy is approved.

import { ORGANIZER_TRUST_STATES, type OrganizerTrustState } from "@/features/organizers/domain/trust";

/** Verification states reuse the frozen 6-state trust vocabulary. */
export const VERIFICATION_STATES: ReadonlyArray<OrganizerTrustState> = ORGANIZER_TRUST_STATES;

export type VerificationState = OrganizerTrustState;

/**
 * Evidence categories a reviewer may record. Declared for policy review —
 * no upload surface, no storage path, and no acceptance of evidence exists
 * in P10. Domain-ownership signals alone (e.g. website reachability) are
 * explicitly NOT verification and are never presented as such.
 */
export const VERIFICATION_EVIDENCE_CATEGORIES = [
  "business_registration",
  "event_history",
  "social_presence",
  "community_vouch",
  "direct_contact",
] as const;

export type VerificationEvidenceCategory =
  (typeof VERIFICATION_EVIDENCE_CATEGORIES)[number];

export function isVerificationEvidenceCategory(
  value: unknown
): value is VerificationEvidenceCategory {
  return (
    typeof value === "string" &&
    (VERIFICATION_EVIDENCE_CATEGORIES as ReadonlyArray<string>).includes(value)
  );
}

/** Who may submit an organizer for verification: owner or admin only. Editors never submit. */
export const VERIFICATION_SUBMITTER_ROLES = ["owner", "admin"] as const;

export type VerificationSubmitterRole = (typeof VERIFICATION_SUBMITTER_ROLES)[number];

/**
 * Verification transitions. `from` → `to` with the single role permitted to
 * perform it (`moderator` = platform admin via `is_super_admin()`).
 * `disabledReason` is non-null for every row while P10-04/P10-05 are
 * unapproved: the table validates intent but never executes.
 */
export interface VerificationTransition {
  readonly from: VerificationState;
  readonly to: VerificationState;
  readonly allowedBy: "moderator" | "submitter";
  readonly disabledReason: string | null;
}

const MODERATION_DISABLED =
  "Verification authority is unresolved: evidence handling, retention, and approver roles await owner decisions.";
const SUBMIT_DISABLED =
  "Verification submission is disabled: no evidence intake exists until storage, access, and retention policy is approved.";

export const VERIFICATION_TRANSITIONS: ReadonlyArray<VerificationTransition> = [
  { from: "not_submitted", to: "submitted", allowedBy: "submitter", disabledReason: SUBMIT_DISABLED },
  { from: "submitted", to: "under_review", allowedBy: "moderator", disabledReason: MODERATION_DISABLED },
  { from: "under_review", to: "confirmed", allowedBy: "moderator", disabledReason: MODERATION_DISABLED },
  { from: "under_review", to: "rejected", allowedBy: "moderator", disabledReason: MODERATION_DISABLED },
  // Re-verification: a rejected or expired organizer may be submitted again
  // by the owner/admin; history is preserved, never rewritten.
  { from: "rejected", to: "submitted", allowedBy: "submitter", disabledReason: SUBMIT_DISABLED },
  { from: "expired", to: "submitted", allowedBy: "submitter", disabledReason: SUBMIT_DISABLED },
  // Expiry is a moderator/system action with an approved retention rule.
  { from: "confirmed", to: "expired", allowedBy: "moderator", disabledReason: MODERATION_DISABLED },
];

export function findVerificationTransition(
  from: VerificationState,
  to: VerificationState
): VerificationTransition | null {
  return VERIFICATION_TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

/**
 * Reviewer audit entry shape (proposed queue-table projection, not a live
 * table). Append-only: rows are never updated or deleted. Organizers can see
 * the outcome and reason for their own organizer; reviewer identity is never
 * exposed to organizers.
 */
export interface VerificationAuditEntry {
  readonly organizerId: string;
  readonly from: VerificationState;
  readonly to: VerificationState;
  readonly reason: string;
  readonly evidenceCategories: ReadonlyArray<VerificationEvidenceCategory>;
  readonly createdAt: string;
}

export class VerificationValidationError extends Error {
  constructor() {
    super("Invalid verification request. Check the highlighted fields and try again.");
    this.name = "VerificationValidationError";
  }
}
