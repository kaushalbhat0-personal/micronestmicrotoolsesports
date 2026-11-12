// P11 material tournament fields — the content columns frozen while a
// listing is `published` (F-02, strict default). The database trigger
// `freeze_published_tournament_content()` enforces this list; this module is
// the application-layer mirror used by tests and review copy. The two must
// be kept in sync — `f02-content-integrity.test.ts` pins every entry against
// the migration SQL text.
//
// Strictest safe default (owner policy unresolved): there are NO
// non-material content fields in v1. Even contact text can smuggle a scam URL
// and even a closing-date shift changes who can register, so every content
// column is material. Relaxation of an individual field requires owner
// approval plus a migration edit, never a code-only change.

/** Content columns frozen while `published`. System columns excluded. */
export const MATERIAL_TOURNAMENT_FIELDS = [
  "title",
  "game_key",
  "region_code",
  "format",
  "starts_at",
  "ends_at",
  "timezone",
  "entry_fee_minor",
  "prize_pool_minor",
  "currency",
  "description",
  "organizer_kind",
  "organizer_name",
  "organizer_slug",
  "organizer_id",
  "registration_url",
  "contact_instructions",
  "registration_closes_at",
  "eligibility",
  "published_at",
] as const;

export type MaterialTournamentField = (typeof MATERIAL_TOURNAMENT_FIELDS)[number];

export function isMaterialTournamentField(value: unknown): value is MaterialTournamentField {
  return (
    typeof value === "string" &&
    (MATERIAL_TOURNAMENT_FIELDS as ReadonlyArray<string>).includes(value)
  );
}

/** Why each field is material (bait-and-switch surface if edited live). */
export const MATERIAL_FIELD_RATIONALE: Readonly<Record<MaterialTournamentField, string>> = {
  title: "Renaming a reviewed listing misrepresents what was approved.",
  game_key: "Changing the game changes the entire competitive context.",
  region_code: "Changing the region changes who the listing is for.",
  format: "Changing team/individual format changes eligibility and fairness.",
  starts_at: "Moving the start changes who can attend.",
  ends_at: "Moving the end changes the commitment reviewed.",
  timezone: "Reinterpreting event times changes actual attendance.",
  entry_fee_minor: "Changing the fee changes the financial commitment.",
  prize_pool_minor: "Changing the prize is the classic bait-and-switch.",
  currency: "Changing currency revalues fee and prize silently.",
  description: "Description edits can rewrite rules after approval.",
  organizer_kind: "Changing the organizer kind reframes accountability.",
  organizer_name: "Changing the organizer name reframes accountability.",
  organizer_slug: "Changing the organizer ref reframes accountability.",
  organizer_id: "Moving a listing between organizers breaks the isolation boundary.",
  registration_url: "Swapping the registration link redirects users off-platform.",
  contact_instructions: "Contact text can smuggle scam URLs after approval.",
  registration_closes_at: "Moving the deadline changes who can still register.",
  eligibility: "Eligibility edits change who may compete after approval.",
  published_at: "History of when the listing went live must survive unpublish.",
};
