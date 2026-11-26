// Profile onboarding status (P14-D12).
// Derived labels over existing G1 rows — never stored, never a verification
// badge. Self-reported `complete` is NOT identity verification.
//
// Supported today (honest mapping to live schema):
//   not_started | incomplete | complete
//
// Not supported without new schema (do not invent as live product gates):
//   pending_verification | verified | rejected
// See P14-D12 docs for the recommended admin-review process.

export const PROFILE_ONBOARDING_STATUSES = [
  "not_started",
  "incomplete",
  "complete",
] as const;

export type ProfileOnboardingStatus = (typeof PROFILE_ONBOARDING_STATUSES)[number];

/** Planned verification statuses — documented only until schema exists. */
export const PLANNED_VERIFICATION_STATUSES = [
  "pending_verification",
  "verified",
  "rejected",
] as const;

export type PlannedVerificationStatus = (typeof PLANNED_VERIFICATION_STATUSES)[number];

export interface OnboardingCompletenessView {
  complete: boolean;
  missing: readonly string[];
}

export interface OnboardingStatusSnapshot {
  status: ProfileOnboardingStatus;
  completeness: OnboardingCompletenessView | null;
  /** Always false for self-reported profiles — never claim verification. */
  isVerified: false;
}

export function resolveOnboardingStatus(
  hasProfile: boolean,
  completeness: OnboardingCompletenessView | null,
): OnboardingStatusSnapshot {
  if (!hasProfile) {
    return {
      status: "not_started",
      completeness: null,
      isVerified: false,
    };
  }
  const complete = completeness?.complete === true;
  return {
    status: complete ? "complete" : "incomplete",
    completeness,
    isVerified: false,
  };
}
