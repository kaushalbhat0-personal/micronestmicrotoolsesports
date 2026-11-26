// Access policy for profile onboarding states (P14-D12).
// Application-layer guidance only. Database RPCs/RLS remain authoritative
// (e.g. create_team still requires auth.users.email_confirmed_at).
// Self-reported profile completeness never grants a "verified" claim.

import type { ProfileOnboardingStatus } from "./onboarding-status";

export interface AccessDecision {
  allowed: boolean;
  reason: string;
}

export function canBrowsePublicContent(_status: ProfileOnboardingStatus | "anonymous"): AccessDecision {
  return {
    allowed: true,
    reason: "Public directory and marketing content are readable without a completed profile.",
  };
}

export function canCompleteOwnProfile(status: ProfileOnboardingStatus): AccessDecision {
  if (status === "not_started" || status === "incomplete") {
    return {
      allowed: true,
      reason: "Authenticated owners may create or finish their self-reported profile.",
    };
  }
  return {
    allowed: true,
    reason: "Completed profiles can still edit settings; completeness is informational.",
  };
}

export function canOptIntoDiscoverability(status: ProfileOnboardingStatus): AccessDecision {
  if (status === "not_started") {
    return {
      allowed: false,
      reason: "Create a player profile before changing discoverability.",
    };
  }
  return {
    allowed: true,
    reason:
      "Discoverability is an explicit owner consent toggle — not a verification badge.",
  };
}

/**
 * Soft UI guidance. The create_team RPC remains the hard gate
 * (active app_users + email_confirmed_at). With mailer autoconfirm, new
 * frictionless signups receive email_confirmed_at immediately.
 */
export function canAttemptTeamCreate(status: ProfileOnboardingStatus): AccessDecision {
  if (status === "not_started" || status === "incomplete") {
    return {
      allowed: false,
      reason:
        "Finish your player profile (handle, display name, bio or avatar, and at least one game profile) before creating a team.",
    };
  }
  return {
    allowed: true,
    reason:
      "Profile looks complete for onboarding. Team creation still requires an active account; the database enforces email_confirmed_at.",
  };
}

export function canClaimVerifiedIdentity(_status: ProfileOnboardingStatus): AccessDecision {
  return {
    allowed: false,
    reason:
      "Self-reported profiles are never marked verified. Admin review is required for any future verified state.",
  };
}
