// P9 tournament organizers — organizer type vocabulary.
// An organizer is a publishing identity for tournament discovery, distinct
// from players, organizations, brands and tournaments. Three values are
// frozen so filters and cards stay honest:
//
// - `independent`: a standalone organizer with no organization attachment.
// - `organization`: an esports organization that explicitly operates
//   tournaments (explicit linkage only — never inferred, never automatic).
// - `professional`: a future vetted tournament operator. The vocabulary value
//   is accepted so filters/cards never break, but no professional rows exist
//   until a verification + operator policy is approved. Rendering an empty
//   result for this filter is honest, not a gap.

export const ORGANIZER_TYPES = ["independent", "organization", "professional"] as const;

export type OrganizerType = (typeof ORGANIZER_TYPES)[number];

export function isOrganizerType(value: unknown): value is OrganizerType {
  return typeof value === "string" && (ORGANIZER_TYPES as ReadonlyArray<string>).includes(value);
}

export function organizerTypeLabel(value: OrganizerType): string {
  switch (value) {
    case "independent":
      return "Independent organizer";
    case "organization":
      return "Organization-run";
    case "professional":
      return "Professional operator";
  }
}
