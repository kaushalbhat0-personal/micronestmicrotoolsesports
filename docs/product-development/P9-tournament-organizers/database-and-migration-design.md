# P9 database and migration design

## Files (local only, NOT applied remotely)

- `supabase/migrations/20261112000005_p9_organizer_foundation.sql`
  — `organizers` + `organizer_members` + tournaments table structure +
  organizer masked RPCs.
- `supabase/migrations/20261112000006_p9_tournament_link.sql`
  — tournament lifecycle trigger, tournament RLS, narrow grants, tournament
  masked RPCs.

G1–P8 migrations are preserved untouched; these are additive.

## Tables

### `organizers`

`id` PK · `slug` unique immutable (lowercase-hyphen 2–80) · `name` 2–80 ·
`description` ≤1000 nullable · `region_code` · `organizer_type`
(independent|organization|professional) · `game_keys text[]` (≤8, GIN) ·
`website_url` nullable (https pattern + app-side revalidation) ·
`social_links jsonb` nullable (shape-checked app-side) · `trust_state`
6-state default `not_submitted` · `is_public` default true · `created_by`
session-derived, immutable · timestamps + `handle_updated_at` trigger.

### `organizer_members`

`(organizer_id, user_id)` PK · `role` (owner|admin|editor). Founding-owner
immutability trigger: no second owner, no owner UPDATE/DELETE in v1.

### `tournaments` (fulfills the P3 proposal)

Implements `04-data-model.md` column-for-column, plus two documented
extensions: `organizer_id uuid FK → organizers(id) ON DELETE SET NULL`
(explicit relationship; historical rows may carry only denormalized
kind/name/slug) and `lifecycle` extended to
`draft|submitted|published|unpublished|archived` (default `draft`).
Adds `updated_by`, `published_at`. Money stays integer minor units;
registration URL https-only; `ends_at > starts_at` CHECK.

`organizer_id` is nullable for historical compatibility; the writer contract
requires it for new rows. `ON DELETE SET NULL` preserves history (never
cascade-delete tournament records); organizer deletion with tournaments is
RESTRICT-blocked via `created_by` chains in practice and documented for the
applying owner.

## P3 contract preservation

The 14-column `search_tournaments` / detail RPC contract is byte-identical
in order and types. Extensions are additive: the `organizer` JSON prefers
the registry join when `organizer_id` is present and falls back to the
denormalized ref otherwise; `verified` stays frozen `false`; the public
predicate fixes `lifecycle = 'published'`, so `submitted`/`archived` never
leak. `TOURNAMENT_DIRECTORY_COLUMNS` is unchanged.

## RPCs

- `search_organizers(p_game, p_region, p_organizer_type, p_query, p_limit,
p_offset)` → 8 columns; `is_public` predicate; game overlap via `ANY()`;
  trimmed/escaped LIKE; limit 1..60, offset 0..1000.
- `get_organizer_by_slug(p_slug)` → 8 columns + `description, website_url,
social_links, organization_slug` (null until approved linkage).
- `search_tournaments(...)` / `get_tournament_by_slug(p_slug)` → frozen P3
  contract, organizer-aware, published-only.
- All four: `SECURITY DEFINER` with empty `search_path`, revoked from
  `public`, `EXECUTE` to `anon, authenticated` only.

## RLS and grants

- All base tables `ENABLE ROW LEVEL SECURITY`, default-deny (tournaments
  revoked from all roles before policies land in 06 — no unprotected window).
- Organizer/member writes: active-account + membership-gated; no anon
  policies; no member INSERT/UPDATE/DELETE (invitation workflow pending).
- Tournament writes: membership-gated on the row's organizer (the
  cross-organizer isolation boundary); no DELETE policy (history preserved).
- Grants: authenticated gets `select/insert/update` on organizers,
  `select` on members, `select/insert/update` on tournaments; anon gets
  nothing on base tables.
- Service role: never in request paths.

## Constraints and indexes

CHECKs on slugs, names, lifecycle, roles, trust, money ranges, URL shapes;
GIN on `game_keys`; btree on region/type/lifecycle/organizer. Immutability
triggers on `organizers.slug/created_by`, owner rows, and
`tournament.slug/game_key/organizer_id/created_by` + lifecycle transitions.
