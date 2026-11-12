// P8 trust states — shared semantics for organizations and brands.
// The UI must never imply that submitted information is confirmed. Only the
// `confirmed` state renders a confirmation indicator; every other state
// renders an explicit neutral note (see trust-and-verification.md).
//
// `not_submitted` means no verification request exists. `rejected` and
// `expired` are terminal non-confirmed states. No privileged transition is
// modelled here — verification approval/rejection stays disabled (no writer).

export const TRUST_STATES = [
  "not_submitted",
  "submitted",
  "under_review",
  "confirmed",
  "rejected",
  "expired",
] as const;

export type TrustState = (typeof TRUST_STATES)[number];

export function isTrustState(value: unknown): value is TrustState {
  return typeof value === "string" && (TRUST_STATES as ReadonlyArray<string>).includes(value);
}

/** Only `confirmed` may render a confirmation indicator. Everything else is neutral. */
export function isConfirmedTrust(value: TrustState): boolean {
  return value === "confirmed";
}

export function trustStateLabel(value: TrustState): string {
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
export function trustStateNote(value: TrustState): string {
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
