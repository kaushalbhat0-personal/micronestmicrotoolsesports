// Minimal application identity contract (G1-1).
// Authoritative: 02 §2–§3, 07 §1/§3, 11 §3 (D-G1-01/D-G1-02).
// The operation returns id + status only. suspension_reason, timestamps and
// any administrative fields never leave the server boundary in G1-1.

export const APP_USER_STATUSES = ["active", "suspended"] as const;

export type AppUserStatus = (typeof APP_USER_STATUSES)[number];

export interface AppUser {
  id: string;
  status: AppUserStatus;
}

export function isAppUserStatus(value: string): value is AppUserStatus {
  return (APP_USER_STATUSES as readonly string[]).includes(value);
}

// Domain errors (07 §3: repositories throw domain errors, never raw
// PostgREST errors to UI). Messages are generic by design (08 T5/T8:
// no existence oracle, no account-information leak).

export class UnauthenticatedError extends Error {
  constructor() {
    super("Sign in required.");
    this.name = "UnauthenticatedError";
  }
}

export class SuspendedError extends Error {
  constructor() {
    // Generic on purpose: identical for missing/private/suspended handled
    // at the route layer; never reveals which condition matched.
    super("Account unavailable. Contact support if this persists.");
    this.name = "SuspendedError";
  }
}

export class BootstrapError extends Error {
  constructor() {
    super("Could not initialize your account. Please retry.");
    this.name = "BootstrapError";
  }
}
