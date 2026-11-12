// Canonical player profile contract (G1-2).
// Authoritative: 03 section 1, 05 section 1, 07 section 1/3, 11 section 3 (D-G1-09).
// One row per user: user_id IS app_users(id) IS auth.uid(). is_discoverable
// defaults false (private by default, 04 section 1). No skill scores, ranks,
// K/D, verification claims or completion flags (D-G1-08 stays open).

export interface PlayerProfile {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  country_code: string | null;
  is_discoverable: boolean;
  handle_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Domain errors (07 section 3: repositories throw domain errors, never raw
// PostgREST errors to UI). Messages are generic by design (08 T5/T8:
// no existence oracle beyond the accepted handle-taken residual, no
// private-information leak).

export class ProfileAlreadyExistsError extends Error {
  constructor() {
    super("You already have a player profile.");
    this.name = "ProfileAlreadyExistsError";
  }
}

export class HandleTakenError extends Error {
  constructor() {
    super("This handle is already taken.");
    this.name = "HandleTakenError";
  }
}

export class ProfileNotFoundError extends Error {
  constructor() {
    super("Player profile not found.");
    this.name = "ProfileNotFoundError";
  }
}

export class ProfileValidationError extends Error {
  constructor() {
    super("Invalid profile data.");
    this.name = "ProfileValidationError";
  }
}

export class ProfileOperationError extends Error {
  constructor() {
    super("Could not save your profile. Please retry.");
    this.name = "ProfileOperationError";
  }
}

export class HandleCooldownError extends Error {
  readonly nextEligibleAt: string | null;
  constructor(nextEligibleAt?: string | null) {
    super(
      nextEligibleAt
        ? `You can change your handle again after ${nextEligibleAt}.`
        : "Handle change is not available yet. Please try again later.",
    );
    this.name = "HandleCooldownError";
    this.nextEligibleAt = nextEligibleAt ?? null;
  }
}

export class ProfileDeletionError extends Error {
  constructor() {
    super(
      "Could not delete your profile. Avatar cleanup failed, so nothing was deleted. Please retry.",
    );
    this.name = "ProfileDeletionError";
  }
}
