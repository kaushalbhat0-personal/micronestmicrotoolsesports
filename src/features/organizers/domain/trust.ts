// P9 organizer trust states — same 6-state semantics as P8 organizations and
// brands (see docs/product-development/P8-org-brand-discovery/trust-and-verification.md).
// Only `confirmed` may render a confirmation indicator. Every other state
// renders a neutral label + note. Verification approval/rejection stays
// disabled: no privileged transition is modelled here.

export const ORGANIZER_TRUST_STATES = [
  "not_submitted",
  "submitted",
  "under_review",
  "confirmed",
  "rejected",
  "expired",
] as const;

export type OrganizerTrustState = (typeof ORGANIZER_TRUST_STATES)[number];

export function isOrganizerTrustState(value: unknown): value is OrganizerTrustState {
  return (
    typeof value === "string" && (ORGANIZER_TRUST_STATES as ReadonlyArray<string>).includes(value)
  );
}

/** Only `confirmed` may render a confirmation indicator. Everything else is neutral. */
export function isConfirmedOrganizerTrust(value: OrganizerTrustState): boolean {
  return value === "confirmed";
}

export function organizerTrustLabel(value: OrganizerTrustState): string {
  switch (value) {
    case "not_submitted":
      return "Not submitted for review";
    case "submitted":
      return "Submitted — not yet reviewed";
    case "under_review":
      return "Under review — not confirmed";
    case "confirmed":
      return "Confirmed";
    case "rejected":
      return "Not confirmed";
    case "expired":
      return "Confirmation expired";
  }
}

/** Short public note shown alongside the label. Never claims confirmation unless confirmed. */
export function organizerTrustNote(value: OrganizerTrustState): string {
  switch (value) {
    case "confirmed":
      return "Confirmed by MicroNest review.";
    case "submitted":
      return "This information was submitted and has not been reviewed.";
    case "under_review":
      return "This information is under review and is not confirmed.";
    case "not_submitted":
      return "This information has not been submitted for review.";
    case "rejected":
      return "This information was reviewed and is not confirmed.";
    case "expired":
      return "A prior confirmation has expired and is no longer valid.";
  }
}
