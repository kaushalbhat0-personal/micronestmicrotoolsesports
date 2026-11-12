// P11 founding-owner bootstrap design — evaluation only, NO implementation.
// No owner-claim mechanism, no admin-provisioning shortcut, and no INSERT
// policy/grant is added by P11. The only code here names the alternatives,
// records the recommendation, and throws the disabled error for any bootstrap
// path until owner approval lands. `f03-bootstrap.test.ts` pins that no
// functional bootstrap path exists in SQL or code.

import { ModerationWriteDisabledError } from "./report";

/** Bootstrap alternatives evaluated in f03-founder-bootstrap.md. */
export const BOOTSTRAP_ALTERNATIVES = [
  "admin_provisioned",
  "one_time_claim_token",
  "open_self_claim",
] as const;

export type BootstrapAlternative = (typeof BOOTSTRAP_ALTERNATIVES)[number];

/**
 * Recommended design: `admin_provisioned` — a platform admin creates the
 * organizer row and the founding owner row (bound to the verified session
 * identity of the approved owner) via an audited admin path, after
 * out-of-band approval. No public path can mint ownership. Requires owner
 * approval of admin-provisioning power before any implementation.
 */
export const RECOMMENDED_BOOTSTRAP: BootstrapAlternative = "admin_provisioned";

/** Rejected: open self-claim lets any account mint organizer ownership (squatting, impersonation, spam). */
export const REJECTED_BOOTSTRAP: BootstrapAlternative = "open_self_claim";

export function assertBootstrapAllowed(action: string): never {
  throw new ModerationWriteDisabledError();
  void action;
}
