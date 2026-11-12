# P9 routes and components

## Public discovery

- `/organizers` (`src/app/organizers/page.tsx`): arena shell, GET-only filter
  form (game/region/type/query), invalid-filter notice, Suspense-streamed
  results, bounded pagination (24/page, max page 42, +1 over-read).
- `/organizers/_components/*`: `organizer-filters`, `organizer-results`
  (invalid → explained empty; transport → retryable alert; zero rows →
  honest empty), `organizer-card` (initial-letter mark, type label,
  Unverified/Confirmed chip, derived published count — never invented),
  `organizers-pagination`, `results-skeleton`.
- `/organizers/[slug]` (+ `not-found.tsx`, `error.tsx`): identity header,
  trust panel (state label + note + anti-conflation copy), description,
  links (https, `rel=noopener`, self-declared note), explicit organization
  linkage (when present), published-tournament section (count honest;
  zero-state explains moderation; non-zero links back to the tournament
  directory). 404-equivalence for missing/unpublished; unavailable state
  for reader outages. `revalidate = 60`.
- Header nav gains `Discover organizers`; robots `noindex` (directory
  posture parity with players/teams/tournaments).

## Workspace (all `force-dynamic`, `noindex, nofollow`)

- `/workspace/organizer`: managed organizer list with per-row basis
  (owner/admin/editor); unauthenticated → sign-in prompt; failures →
  generic unavailable; empty → boundary notice. Disabled-persistence banner.
- `/workspace/organizer/tournaments`: organizer picker when no
  `?organizer=`; per-organizer tournament list with lifecycle + basis;
  invalid UUID → explained invalid state (no existence oracle).
- `/workspace/organizer/tournaments/new?organizer=`: strict draft form
  (title, slug, game, region, format, UTC instants, IANA timezone, minor-unit
  money, https registration, contact, description) + live preview + gated
  server action (validates, returns the disabled message).
- `/workspace/organizer/tournaments/[id]/edit`: managed-row load (invisible
  → `notFound()`), locked-field notice (slug/game/organizer/lifecycle),
  gated update action.

## P3 integration

- `tournament-detail` unchanged except `OrganizerCard`: the organizer name
  links to `/organizers/[slug]` when the ref carries a slug, else plain
  text. No new data path, no base-table read, no identity claim.
- Organizer profiles link back via the tournament directory (query = name
  until the approved `organizer_slug` filter RPC lands — documented
  limitation, no fake precision).
- Existing filtering, pagination, unavailable and 404 behavior intact;
  `TOURNAMENT_DIRECTORY_COLUMNS` untouched.

## Presentation vs function (honest ledger)

| Surface                                             | Status                                       |
| --------------------------------------------------- | -------------------------------------------- |
| Directory/profile rendering                         | functional UI, data gated on migration apply |
| Draft validation + preview                          | functional locally                           |
| Draft save / submit / publish / unpublish / archive | disabled, messaged                           |
| Verification transitions                            | disabled, unmodelled                         |
| Moderator actions                                   | disabled, no authority invented              |
| Media upload                                        | no surface (reservation only)                |
