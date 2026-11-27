# P8 brand domain

A brand is NOT an organization. Commercial entity with declared interests;
never an esports roster owner by itself.

## Identity

- `name` (2–80), `slug` (unique, immutable, lowercase hyphen-joined 2–60).
- No logo in v1 (same media-contract rationale as organizations).
- `description` (nullable, detail only).

## Classification

- `industry` controlled vocabulary: `gaming-hardware | peripherals | apparel |
  energy-drink | food-beverage | fintech | telecom | automotive | media | other`.
- `region_code` (same per-game vocabulary discipline as organizations).
- `game_interests: string[]` (titles of interest; display raw if unknown).
- `partnership_types: PartnershipType[]`: `sponsorship | product-partnership |
  content-collaboration | event-partnership | affiliate | other`.
- `sponsorship_interests: SponsorshipInterest[]`: `teams | players | events |
  content-creators | all` — DECLARED INTENT ONLY, never availability.

## Trust and representation

- `trust_state` (same 6-state model as organizations; only `confirmed`
  renders confirmation).
- `representative_verified: false` FROZEN. No pipeline exists. The UI never
  renders a representative badge and every profile carries the note: “This
  profile does not prove that any viewer represents this brand.”
- A website domain alone is never treated as proof of representation.

## Links

Same https-only rule as organizations (`website_url`, `social_links` max 8).

## Public projection

- Search (`search_brands`): `slug, name, industry, region_code,
  game_interests, partnership_types, sponsorship_interests, trust_state`
  (8, in order).
- Detail adds: `description, website_url, social_links` (+ frozen
  `representative_verified: false`, never a stored authority).
- Never members: representative identity/contact, verification evidence,
  timestamps, base-table internals.

## Display rules

- `interest` filter selects DECLARED interest, never availability.
- Sponsorship opportunities section: explicit unavailable note.
- Representation section: unverified note; no contact/inquiry handoff in P8.

## Write boundary

Representative verification, approval/rejection, evidence uploads, claims and
sponsorship postings are disabled (`BrandWriteDisabledError`; no writer).
