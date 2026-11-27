# P8 database and security contracts

No migration is applied in P8 (constraint). This file is the acceptance target
for a future migration author. Routes call the RPC names below; until the
migration lands they resolve to the generic unavailable state — never fake rows.

## Proposed tables (essence, not DDL)

### `organizations` (proposed)

- `id uuid PK`, `slug` unique immutable (lowercase hyphen 2–60), `name` 2–80,
  `description` ≤1000 nullable.
- `region_code` text (per-game CHECK; BGMI set today).
- `org_type` CHECK (`professional| semi-professional|amateur|community|
  collegiate|academy`).
- `game_keys text[] NOT NULL DEFAULT '{}'` (multi-title; GIN index).
- `website_url` nullable (https CHECK app-side + DB CHECK), `social_links`
  jsonb nullable (array ≤8 of `{label ≤40, url https}`, shape-checked).
- `trust_state` CHECK (6 states, default `not_submitted`).
- `is_public bool DEFAULT true`, `created_by uuid` session-derived
  (ownership model pending), timestamps + `handle_updated_at` trigger.
- NO logo column (media contract pending). NO recruitment columns (pending).
- `team_count` is DERIVED at read time (`teams` association count), never stored.

### `brands` (proposed)

- `id uuid PK`, `slug` unique immutable (2–60), `name` 2–80, `description` ≤1000.
- `industry` CHECK (10-value vocabulary), `region_code` text (per-game CHECK).
- `game_interests text[]`, `partnership_types text[]`, `sponsorship_interests
  text[]` (intent vocabularies, GIN indexes).
- `website_url` / `social_links` (same rules as organizations).
- `trust_state` CHECK (6 states, default `not_submitted`).
- `is_public bool DEFAULT true`, `created_by uuid` session-derived,
  timestamps. NO representative columns in v1 (verification pending).
- `representative_verified` is NOT a stored authority in v1; the reader
  freezes it `false`.

## Proposed masked RPC pair (mirrors D1/P1/P3 posture)

- `search_organizations(p_game, p_region, p_org_type, p_query, p_limit, p_offset)`
  → 7 proposed columns; `is_public = true` predicate; GIN-assisted game
  overlap (`p_game = ANY(game_keys)`); LIKE-escaped trim/120-cap query;
  limit 1..60, offset 0..1000; `anon, authenticated` execute; base tables
  revoked from anon; no owner/evidence columns in RETURNS.
- `get_organization_by_slug(p_slug)` → 7 columns + `description,
  website_url, social_links`; single-row; same grants.
- `search_brands(p_game_interest, p_industry, p_region, p_interest,
  p_partnership, p_query, p_limit, p_offset)` → 8 proposed columns;
  `ANY()` overlap on interest arrays; same escaping/clamps/grants; interests
  filter DECLARED intent (no availability predicate exists).
- `get_brand_by_slug(p_slug)` → 8 columns + `description, website_url,
  social_links`; same grants.

## RLS sketch (for the migration author, not a decision)

- Base tables default-deny; no public base reads (RPC-only). Owner/creator
  self-access gated on `auth.uid()` + active `app_users` (D1 pattern).
- Immutability: `slug` (+ future identity ownership) frozen via column grants
  + trigger (D1.5.1 F-T01 pattern).
- No select policies for anon on base tables; `authenticated` policies mirror
  the teams pattern (owner/captain-gated writes only after the ownership
  decision). Verification transitions require a separate evidence-handling +
  admin-boundary decision.
- Grants: `REVOKE ALL` from `public`/`anon`; least-privilege `authenticated`
  grants; `EXECUTE` on the four RPCs to `anon, authenticated` only.
- Service role: never in request paths (webhooks/cron only, none in P8).

## Disabled operations (must remain disabled until separately approved)

Organization ownership assignment, team ownership transfer, org admin
management, brand representative verification, verification approval/rejection,
evidence uploads, profile claims, sponsorship/recruitment postings, contact
handoffs. A presentation shell is not persistence or authorization.
