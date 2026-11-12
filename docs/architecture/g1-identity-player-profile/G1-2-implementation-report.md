# G1-2 Implementation Report — Canonical Player Profile

## 1. Verdict

**G1-2 PASS** — migration deployed, server operations implemented, mocked +
live adversarial tests green, remote verification complete, zero residue.

## 2. Preflight and project identity

* Repo `micronestmicrotoolsesports`, branch `new-platform`, HEAD
  `01893ae5b0275979649edb754e4dd9ea6cbaebb7` (matches the expected baseline;
  G1-1 was never committed — its files remain untracked, as its report states).
  Pre-existing unrelated items preserved (`M .gitignore`, `?? AGENTS.md`,
  `?? docs/audits/...`); nothing staged, committed or pushed in this stage.
* Remote (explicit ref, never any env var): id `knniommcyyhbyiwljisk`, name
  `micronestmicrotoolsesports`, region `ap-northeast-1`, status
  `ACTIVE_HEALTHY`, PG `17.6.1.171`. No sibling project touched.
* History before: exactly `20261110000001_foundation_baseline`,
  `20261110000002_storage_foundation`, `20261110135602_g1_identity_anchor`,
  `20261110135654_g1_identity_anchor_grant_tightening` (MCP-assigned versions;
  local files `...00003/00004` are content-identical lineage copies per the
  G1-1 report). Public schema held one table (`app_users`, 0 rows) — no
  `player_profiles`, no conflicting implementation.
* `app_users` introspected live: exact 6 approved columns, PK + FK CASCADE,
  both CHECKs, `trg_app_users_updated_at` present, RLS on, exactly 2
  `authenticated`-only policies (owner SELECT `id=auth.uid()`, owner INSERT
  `WITH CHECK id=auth.uid()`), `ensure_app_user()` `SECURITY INVOKER`
  (`is_definer=false`, `SET search_path=''`, INSERT+re-select body). The G1-1
  foundation is intact; nothing changed during preflight.

## 3. Migration design

* One additive file:
  `supabase/migrations/20261110000005_g1_player_profile.sql` (local file;
  remote record `20261110141108_g1_player_profile` — the MCP applier assigns
  its own version, as in G1-1; content identical, local file kept for lineage).
* Design anchors: 03 section 1 (columns), 05 section 1 (CHECKs/indexes/trigger),
  05 section 3 (RLS matrix), 05 section 6 (no DEFINER), 05 section 7 (grants),
  02 sections 2–3 (transactional bootstrap+creation), 07 (operations).
* Deployment path: `supabase db push --linked --dry-run` was attempted and
  correctly refused (remote MCP-versioned history `...135602/...135654` has no
  local-version counterparts — push would touch unrelated history, which is
  forbidden). Deployment therefore used the G1-1 pattern: MCP
  `apply_migration` with ONLY the reviewed G1-2 SQL. Pre-apply grep audit:
  no `DROP`, no `TRUNCATE` (sole match is the `REVOKE ... TRUNCATE` keyword),
  `app_users` referenced only by the approved FK, the RPC ensure-INSERT and
  read-only `EXISTS` guards — no `ALTER`/`UPDATE`/`DELETE` on any existing
  object. No previous migration modified.

## 4. Player-profile schema

`public.player_profiles` (verified live via `list_tables --verbose`):

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `user_id` | uuid | NOT NULL | — | PK + FK `app_users(id) ON DELETE CASCADE`. Equals `auth.uid()`. |
| `handle` | text | NOT NULL | — | `CHECK handle ~ '^[a-z0-9_]{3,20}$'`, stored lowercase. |
| `display_name` | text | NOT NULL | — | `CHECK char_length 1..40`. |
| `avatar_path` | text | NULL | NULL | `CHECK` uid-scoped raster path (plumbing only; upload is G1-5). |
| `bio` | text | NULL | NULL | `CHECK char_length <= 280`. |
| `country_code` | char(2) | NULL | NULL | ISO-3166-1 alpha-2 allowlist (249 codes); never `ONLINE`. |
| `is_discoverable` | boolean | NOT NULL | `false` | Private by default. |
| `created_at` / `updated_at` | timestamptz | NOT NULL | `now()` | `updated_at` via reused `handle_updated_at()` trigger. |

No invented columns: no skill scores, ranks, K/D, verification claims, no
completion flag (D-G1-08 open), no `suspended_at` (lives on `app_users`).

## 5. Constraints and indexes

* PK `player_profiles_pkey (user_id)` — one profile per user; second create
  surfaces `23505` (mapped to `ProfileAlreadyExistsError`).
* FK `player_profiles_user_id_fkey → app_users(id) ON DELETE CASCADE` — the
  approved referential action (05 section 2). This does NOT decide D-G1-07: a
  future grace window would delay the `app_users` DELETE, not change cascade
  mechanics. No deletion workflow implemented (no DELETE policy/grant).
* `player_profiles_handle_lower_uniq ON (lower(handle))` — case-insensitive
  handle uniqueness enforced by PostgreSQL (live proof: `ABC` vs `abc`
  collide with `HandleTakenError`; Zod lowercases, DB is the authority).
* `player_profiles_discoverable_idx ON (is_discoverable) WHERE is_discoverable
  = true` — partial btree prefilter for the G1-4 RPCs (no public reads yet).
* CHECKs mirror Zod exactly (handle regex, display-name length, avatar regex,
  bio length, 249-code country allowlist). `ONLINE` is rejected three ways:
  not in the allowlist, fails `char(2)` by length, refined away in Zod.
* Country allowlist provenance: full 249-code ISO 3166-1 set, cross-checked
  against the datahub.io country-list mirror (same 249 codes). Two codes
  missing from the first draft (`CV`, `HK`) were caught by that cross-check
  before deployment. Game-region values do not appear here (G1-3 owns
  `region_code`).
* Trigger `trg_player_profiles_updated_at` (foundation reuse) present.

## 6. RLS and grants

Live-verified (`pg_policy` + `role_table_grants`):

* RLS enabled. Exactly 3 policies, all `authenticated`-only:
  * SELECT `USING (user_id = auth.uid())` — own reads stay allowed when
    suspended (appeal/export).
  * INSERT `WITH CHECK (user_id = auth.uid() AND EXISTS (... status='active'))`
    — suspended guard via inline `EXISTS`, no DEFINER helper (05 section 6).
  * UPDATE `USING` + `WITH CHECK` (same owner+active conjunction) — the
    `WITH CHECK` also blocks ownership transfer (`user_id` → another uid
    fails the check; verified live).
* No owner DELETE policy (deferred pending D-G1-07; default-deny verified:
  owner DELETE is a no-op and the row survives). No anon policies. No public
  SELECT policy (public reads arrive in G1-4 as RPCs only, D-G1-03).
* Grants: `authenticated` = SELECT/INSERT/UPDATE only (no DELETE/TRUNCATE/
  REFERENCES/TRIGGER; no anon/public grants). `postgres`/`service_role`
  untouched. `create_player_profile()` EXECUTE granted to `authenticated`
  only (revoked from `PUBLIC`/`anon`).
* `app_users` grants unchanged (authenticated SELECT/INSERT/DELETE).

## 7. Transaction/concurrency behavior

* Creation is atomic via narrowly scoped `SECURITY INVOKER`
  `public.create_player_profile(p_handle, p_display_name, p_bio,
  p_country_code)` (one RPC = one transaction: `app_users` ensure `ON
  CONFLICT DO NOTHING` + profile INSERT + re-select; `SET search_path=''`,
  fully qualified objects, no dynamic SQL, no identity parameter, no
  `is_discoverable`/`avatar_path` parameters — creation forces
  undiscoverable). INVOKER adds zero privilege: caller RLS still applies.
  Justification recorded in the migration header: two PostgREST calls cannot
  share a transaction, so the approved succeed-or-fail-together contract
  needs this encapsulation. No `SECURITY DEFINER` introduced anywhere.
* Server pre-gate (`ensureAppUser`) is a read-only status check; the
  recoverable "onboarding required" row it may leave is the normal
  intermediate state, not unintended partial state. A suspension landing
  mid-flow is still enforced by the RLS `EXISTS` guard inside the RPC.
* Database uniqueness is the final authority. Live proof: 5-way concurrent
  first-creation converged on exactly 1 row (winners return the profile;
  losers receive a predictable 409-domain error — creation is intentionally
  NOT idempotent, unlike bootstrap). Sequential duplicate → 
...[truncated 5079 chars]