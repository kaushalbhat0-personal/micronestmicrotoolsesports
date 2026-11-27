// P13-A approval-binding domain — pure logic mirroring the database rule in
// 20261113000005_p13_activation (validator
// `tournament_review_approval_valid`). The database is the authority; this
// module documents the rule for reviewers and UI copy, and is unit-tested.
// Binding rule: a privileged transition requires a decision row with matching
// type AND matching submission version; publish/republish additionally require
// the exact snapshot hash. Reviewer must be a currently-active moderator and
// must not be a member of the target organizer (checked in SQL).

import type { ModerationDecision } from "./decision";
import { DECISION_LIFECYCLE } from "./decision";

export interface ApprovalBinding {
  readonly decision: ModerationDecision;
  readonly submissionVersion: number;
  readonly contentHash: string | null;
  readonly reviewerActiveModerator: boolean;
  readonly reviewerOrganizerMember: boolean;
}

export interface ApprovalRequirement {
  readonly decision: ModerationDecision;
  readonly needsHash: boolean;
}

/** Which decision authorizes which transition, and whether it is hash-bound. */
export function requiredApprovalFor(
  from: string,
  to: string
): ApprovalRequirement | null {
  for (const decision of Object.keys(DECISION_LIFECYCLE) as ModerationDecision[]) {
    const mapping = DECISION_LIFECYCLE[decision];
    if (mapping.from === from && mapping.to === to) {
      return {
        decision,
        needsHash: decision === "publish" || decision === "republish",
      };
    }
  }
  return null;
}

/**
 * Mirrors the validator: all conditions must hold simultaneously.
 * - type matches the required decision for the transition
 * - version matches the row's current submission version (stale replay fails)
 * - hash matches when the decision type is hash-bound (concurrent edit fails)
 * - reviewer is a currently-active moderator (suspended reviewers fail)
 * - reviewer is not a member of the target organizer (self-review fails)
 */
export function isApprovalBindingValid(
  requirement: ApprovalRequirement,
  binding: ApprovalBinding,
  currentVersion: number,
  currentHash: string
): boolean {
  if (binding.decision !== requirement.decision) {
    return false;
  }
  if (binding.submissionVersion !== currentVersion) {
    return false;
  }
  if (requirement.needsHash && binding.contentHash !== currentHash) {
    return false;
  }
  if (!binding.reviewerActiveModerator) {
    return false;
  }
  if (binding.reviewerOrganizerMember) {
    return false;
  }
  return true;
}
