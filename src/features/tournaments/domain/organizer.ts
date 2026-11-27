// P3 tournaments domain — organizer reference.
// Organizers are NOT necessarily organizations (phase constraint): an
// organizer is either an independent organizer or an organization, and the
// reference carries no authority by itself. Verification does not exist in
// this phase — `verified` is frozen false and the UI states it plainly
// instead of implying trust. No moderator permissions are modelled here.

export const ORGANIZER_KINDS = ["independent", "organization"] as const;

export type OrganizerKind = (typeof ORGANIZER_KINDS)[number];

export function isOrganizerKind(value: unknown): value is OrganizerKind {
  return typeof value === "string" && (ORGANIZER_KINDS as ReadonlyArray<string>).includes(value);
}

export interface OrganizerRef {
  readonly kind: OrganizerKind;
  readonly name: string;
  /** Public organizer slug when one exists; null for unlisted organizers. */
  readonly slug: string | null;
  /** Frozen false: no verification pipeline exists. Never render a badge. */
  readonly verified: false;
}

export function isOrganizerRef(value: unknown): value is OrganizerRef {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isOrganizerKind(record["kind"]) &&
    typeof record["name"] === "string" &&
    (record["name"] as string).trim().length >= 2 &&
    (record["name"] as string).length <= 80 &&
    (typeof record["slug"] === "string" || record["slug"] === null) &&
    record["verified"] === false
  );
}

export const ORGANIZER_TRUST_NOTE =
  "Organizer identity is self-declared. Verification arrives with a later decision — nothing here is a verified badge.";

export function organizerKindLabel(kind: OrganizerKind): string {
  return kind === "organization" ? "Organization" : "Independent organizer";
}
