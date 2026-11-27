# P8 organization domain

Game-agnostic. One row per organization. Independent teams remain valid and
discoverable regardless of any association.

## Identity

- `name` (2–80), `slug` (unique, immutable, lowercase hyphen-joined 2–60).
- No logo in v1: no accepted media contract exists (storage bucket reservation
  only). Cards render an initial-letter mark; no imagery is fabricated.
- `description` (nullable, detail only).

## Capability

- `region_code` (per-game vocabulary at the reader for known games; unknown
  games pass through fail-closed).
- `game_keys: string[]` (multi-title; unknown keys render raw, filter
  fail-closed to zero rows).
- `org_type` controlled vocabulary: `professional | semi-professional |
  amateur | community | collegiate | academy`.
- `team_count: number` (derived count only — no identities embedded).
- Recruitment: NO members in v1. Directory has NO recruitment filter
  (ungrounded). Profile shows an explicit unavailable note.

## Trust

`trust_state: not_submitted | submitted | under_review | confirmed | rejected | expired`.
Only `confirmed` renders a confirmation indicator. See `trust-and-verification.md`.

## Links

`website_url: string | null`, `social_links: { label, url }[]` (max 8, labels
≤40). Https-only, no credentials; bad URLs fail the row closed. Rendered with
`target=_blank rel=noopener` + handoff note.

## Public projection

- Search (`search_organizations`): `slug, name, region_code, org_type,
  game_keys, trust_state, team_count` (7, in order).
- Detail adds: `description, website_url, social_links`.
- Never members: owner identity, representative data, verification evidence,
  applicant data, timestamps, base-table internals.

## Display rules

- Teams section: count + independence note + link to `/teams`; no identities.
- Recruitment section: unavailable note; no supply claimed.
- Unavailable sections are labelled, never hidden silently.

## Write boundary

Organization ownership/administration, team↔org association, verification
transitions, and claims are disabled. The domain exposes
`OrganizationWriteDisabledError`; no writer module exists.
