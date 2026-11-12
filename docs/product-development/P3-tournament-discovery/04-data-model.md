# P3 Data Model Proposal (acceptance target — NO migration exists)

This proposal is the target the reader contracts pin (column order, types,
predicates). It creates no migration file in this phase by constraint; a
future migration must implement exactly this shape or update the contracts
+ tests together.

## Proposed tables (names + essence, not DDL)

- `tournaments` — `id` (uuid PK), `slug` (unique, immutable, lowercase-hyphen
  2–80), `title` (2–120), `game_key` (FK `games.key`, immutable), `region_code`
  (per-game CHECK, BGMI set today), `format` (`team|individual|both`),
  `starts_at`/`ends_at` (timestamptz, `ends_at > starts_at`), `timezone`
  (text, validated app-side; canonical IANA list is ICU-dependent),
  `entry_fee_minor` (int ≥ 0, nullable), `prize_pool_minor` (int ≥ 0,
  nullable), `currency` (CHAR(3), nullable with amounts), `description`
  (≤4000, nullable), `organizer_kind` (`independent|organization`),
  `organizer_name` (2–80), `organizer_slug` (nullable, no FK in v1),
  `lifecycle` (`draft|published|unpublished`, default `draft`),
  `registration_url` (nullable, https rule enforced app-side + CHECK),
  `contact_instructions` (≤500, nullable), `registration_closes_at`
  (nullable), `eligibility` (jsonb, nullable, shape-checked), `created_by`
  (uuid, session-derived — ownership model pending, see 08),
  `created_at`/`updated_at` (defaults + trigger).
- No organizer table in v1 (organizer is a denormalized public ref +
  `created_by` accountability; a registry arrives with verification).
- No registration/moderation tables in v1 (external handoff only; report
  queue arrives with the moderation boundary).

## Proposed masked RPC pair (mirrors D1/P1 posture)

- `search_tournaments(p_game, p_region, p_status, p_query, p_limit, p_offset)`
  → the 14 proposed columns; `lifecycle = 'published'` predicate; G1-parity
  LIKE escaping (trim/120-cap/backslash-wildcard escape); limit 1..60,
  offset 0..1000; `anon, authenticated` execute; base tables revoked from
  anon; no owner/moderation columns in RETURNS.
- `get_tournament_by_slug(p_slug)` → 14 columns + description +
  contact_instructions + eligibility; single-row; same grants.
- Status is DERIVED at read time from instants (never a stored column that
  can drift); the optional `p_status` filter compares against the same
  derivation SQL-side.

## RLS sketch (for the migration author, not a decision)

- Base tables: default-deny; owner/creator-gated writes after the
  organizer-permission decision; no public base reads (RPC-only).
- Immutability: `slug`, `game_key` (+ identity/ownership) frozen via
  column grants + trigger, following the D1.5.1 F-T01 pattern.
- Reports/moderation: insert-only reporter pattern per D1-D9 when approved.

## Acceptance checklist

Column order/types = `domain/columns.ts`; key-sets enforced by reader
tests; URL/money/eligibility shapes enforced twice (Zod + mapping);
404-equivalence for missing/unpublished; escaping/clamp probes;
anon+authenticated callers; disposable-replay RLS execution before apply.
