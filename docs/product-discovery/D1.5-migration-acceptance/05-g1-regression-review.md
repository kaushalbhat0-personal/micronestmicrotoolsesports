# 05 — G1 Regression Review

Claim: the two D1 migrations do not change any accepted G1 behavior.
Method: full-text read of both D1 files + `grep` over `supabase/migrations`
for G1 object names; comparison against frozen records
`11-decision-freeze.md`, `10-open-decisions.md`, and G1 migrations
`20261110000001`–`20261111000009`.

## 1. Identity / bootstrap (D-G1-01, D-G1-02)

- No `ALTER`/`DROP`/`CREATE POLICY` on `public.app_users`.
- No change to `ensure_app_user()` (INVOKER, `auth.uid()` only).
- No new UPDATE/DELETE policy on `app_users`; `organization_id`/team FKs do not
  touch `app_users` policies. `RESTRICT` on `teams.owner/created_by` only blocks
  parent-row delete while teams exist (transfer-first intent, D1-D10) — does not
  alter bootstrap, status, or suspension semantics.
- **Result: no change.**

## 2. Player-profile ownership / lifecycle (D-G1-05/07/08)

- No `ALTER` on `player_profiles` / `player_game_profiles` (no new column,
  no DELETE-policy change, no grant change).
- `handle_changed_at` cooldown, dedicated `set_player_discoverability()` /
  `update_player_handle()` DEFINER functions, and column-level UPDATE grants
  (G1-7) untouched — no `CREATE OR REPLACE` on either function in D1 files.
- **Result: no change.**

## 3. Frozen 12-column public projection (D-G1-03/04)

- Column order/content
  (`handle,display_name,avatar_url,bio,country_code,game_key,game_name,ign,
  primary_role,play_modes,region_code,availability`) untouched.
- `search_player_directory` / `get_player_by_handle` bodies, predicates
  (`is_discoverable AND is_visible AND status='active' AND is_active`),
  `LIMIT 1..48`, `ESCAPE '\'`, 404-equivalence, and grants untouched.
- D1 `search_teams`/`get_team_by_slug` are **new, separate functions** with
  distinct names/signatures; they do not overload or replace G1 RPCs.
- **Result: no change.**

## 4. Existing public RPCs and grants

- No `REVOKE`/`GRANT` on any G1 function in D1 files.
- D1 grants target only new tables/functions (`teams`, `team_members`,
  `recruitment_posts`, `applications`, `reports`, `is_team_member/captain`,
  `search_teams`, `get_team_by_slug`, `is_super_admin`).
- **Result: no change.**

## 5. Private `game_user_id` protection (D-G1-04 Option A)

- D1 code and SQL never reference `game_user_id` (verified by read).
- `schemas/team.ts` explicitly excludes `character_id`/`game_user_id`;
  `catalog.ts` never drives FKs; RPC projections omit identifiers.
- **Result: no change (protection preserved).**

## 6. Storage policies and bucket boundaries

- No `storage.buckets` / `storage.objects` statement in either D1 file.
- Buckets `public-avatars` / `public-entity-media` / `private-verification`,
  MIME/size limits, owner-path policies, and service-role-only entity-media
  posture (G1 storage foundation) untouched.
- D1 team logos would use `public-entity-media` via future server path only —
  no permissive policy added in D1 (correctly deferred).
- **Result: no change.**

## 7. Email-confirmation discoverability (D-G1-10)

- G1-8B enforcement (confirmed-email gate in publish path + DEFINER) is not
  present in the current tree (owned by a later stage) and D1 does not add,
  remove, or bypass it. D1 discovery (`is_public` teams) is a separate
  visibility flag on a separate table; it does not read or write
  `player_profiles.is_discoverable`.
- **Result: no change (neither implemented nor weakened by D1).**

## 8. Only shared-object touch

- `public.handle_updated_at()` (foundation baseline, INVOKER,
  `search_path=''`, revoked from anon/authenticated) is **reused** by three D1
  triggers (`teams`, `recruitment_posts`, `applications`). Reuse fires the
  existing function; it does not `CREATE OR REPLACE` it and does not alter its
  grants. This is the sole G1-lineage dependency and it is additive-only.
- No G1 CHECK, index, FK, or trigger is dropped or replaced.

## Conclusion

**No G1 regression in the D1 SQL text.** The migrations are additive-only with
respect to G1. This does not imply D1 is safe to apply — `02`/`03`/`06` block
acceptance on D1's own defects.
