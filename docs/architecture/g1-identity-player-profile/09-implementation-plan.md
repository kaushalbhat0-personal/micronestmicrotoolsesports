# 09 — Implementation Plan (G1, gated stages — no code in this phase)

Each stage lists scope, migration impact, application changes, RLS tests, acceptance criteria, rollback. Stages are sequential; do not merge stages to “move faster” — RLS + projection must be proven before directory UI ships.

## Stage G1-0 — Contracts freeze + test scaffolding
- Scope: freeze 01–08; add `src/features/player-profile/` README + Zod schema stubs (types only, no tables); add RLS/projection test plan (SQL + Vitest outlines) without DB writes to primary.
- Migration impact: none.
- Application changes: none functional (docs + type stubs behind no routes).
- RLS tests: test files added but asserting current empty state (0 tables) to lock the harness.
- Acceptance: 01–10 reviewed; approved decisions D-G1-01/D-G1-02/D-G1-03/D-G1-09 recorded (see 10 + 11); remaining open decisions triaged (which need pre-implementation answers — see 10).
- Rollback: delete stubs.

## Stage G1-1 — Identity anchor (`app_users` + lazy bootstrap) — APPROVED D-G1-01/D-G1-02
- Scope: `app_users` table (id, status, suspended_at/reason, timestamps + trigger), RLS (own SELECT, bootstrap INSERT, no owner UPDATE/DELETE per D-G1-02), `ensureAppUser` server action (APPROVED lazy bootstrap: verified-session identity only, authenticated owner client, no middleware writes, re-select + status validation, suspended blocked, `ON CONFLICT DO NOTHING` concurrency safety, recoverable) + onboarding entry (no profile UI yet).
- Migration impact: 1 migration (table + trigger + RLS + grants). No seed data.
- Application changes: `ensureAppUser` repository (session-derived ID only; owner client) + unit tests (mocked Supabase client), onboarding redirect logic. No middleware bootstrap.
- RLS tests: anon base SELECT → 0; authenticated non-owner → 0; owner bootstrap INSERT idempotency (`ON CONFLICT DO NOTHING` twice → 1 row); concurrent double-bootstrap → 1 row; owner UPDATE `app_users` (incl. `status`) → denied; suspended fixture (if seeded in test only) blocked from initialization with generic error; re-select returns `suspended` status path covered.
- Acceptance: signup → no `app_users` row until first action; first action creates exactly one; second call idempotent; suspended cannot pass; failure recoverable (retryable onboarding-required).
- Rollback: drop migration (fresh environments) or compensating migration removing table (deployed environments) — decide per environment; primary is not the replay target so no primary rollback in G1.

## Stage G1-2 — Canonical player profile (APPROVED D-G1-09: `country_code` ISO alpha-2 only)
- Scope: `player_profiles` (all columns + CHECKs + `lower(handle)` unique + trigger), RLS owner CRUD, handle normalization, avatar_path plumbing (no upload yet). `country_code` ISO-3166-1 alpha-2 allowlist; never `ONLINE`; game-specific validation not hardcoded into canonical identity.
- Migration impact: 1 migration. Depends on G1-1.
- Application changes: create/update/delete profile server actions + Zod DTOs + owner settings form (no public routes yet).
- RLS tests: owner CRUD happy path; non-owner read/write → 0/denied; anon → 0; handle collisions (`ABC` vs `abc`) → 1 row; overlong bio/handle → CHECK denial; `is_discoverable` toggle owner-only.
- Acceptance: one profile per user enforced (second create → 409/unique); handle rules enforced at DB + Zod identically.
- Rollback: remove migration (fresh) or drop table (compensating); app code behind no public route so safe to revert.

## Stage G1-3 — Game catalogue + BGMI game profiles (APPROVED D-G1-09: game-specific `region_code`)
- Scope: `games` table + `bgmi` seed + `player_game_profiles` (columns/constraints/indexes in 05), RLS owner CRUD, per-game visibility. `region_code` validated against the applicable game-specific vocabulary (BGMI set illustrative); different games may define different vocabularies; adding a game = catalogue row + validation, no canonical-profile redesign.
- Migration impact: 1 migration (table + seed + RLS + indexes). No verification columns.
- Application changes: game-profile CRUD actions + validation (role/mode/region/availability allowlists) + owner game list UI.
- RLS tests: `(player, game)` uniqueness; array caps; allowlist CHECKs; non-owner isolation; `is_visible` toggle semantics.
- Acceptance: multiple games per player allowed (seed a second catalogue row in test only); BGMI happy path + validation rejections.
- Rollback: as above; catalogue seed removal via compensating delete (test envs only).

## Stage G1-4 — Public projection RPCs (security boundary) — APPROVED D-G1-03 (RPC-only)
- Scope: `search_player_directory` + `get_player_by_handle` (definer, `SET search_path=''`, fully qualified objects, no dynamic SQL, frozen allowlist output with timestamps omitted, explicit consent + `status='active'` + `is_active` predicates, `LIMIT ≤48` + bounded `OFFSET`, `ILIKE` escaping with `ESCAPE`) + `REVOKE ALL FROM PUBLIC`/`GRANT EXECUTE TO anon, authenticated` + revocation/404-equivalence semantics. No broad public views.
- Migration impact: 1 migration (functions + grants). No table changes.
- Application changes: `DirectoryReader` calling RPCs only (no base reads for others); no public UI yet (reader unit-tested with mocked RPC).
- RLS tests (critical, frozen): base tables still 0-row for anon/non-owner; RPC returns only eligible rows across matrix (private/master-off/game-hidden/suspended/inactive-game → absent); output key-set exact (frozen allowlist; no IDs/email/`game_user_id`/evidence/timestamps); `LIMIT` clamp 1..48 + bounded `OFFSET` enforced; `ILIKE` injection strings (`%`/`_`/`\`) treated literally via `ESCAPE`; handle validation enforced; `search_path=''` + no `EXECUTE` verified.
- Acceptance: matrix green; function definitions reviewed (`search_path=''`, fully qualified objects, no `EXECUTE`, static predicates, frozen columns).
- Acceptance: matrix green; function definitions reviewed (`search_path=''`, no `EXECUTE`, static predicates).
- Rollback: `DROP FUNCTION` compensating migration; readers removed.

## Stage G1-5 — Avatar storage wiring
- Scope: app upload/replace/delete flows against existing `public-avatars` bucket/policies (no new buckets/policies); `avatar_path` CHECK + single-path discipline.
- Migration impact: none (policies already deployed; CHECKs landed in G1-2).
- Application changes: avatar upload server action (validate → upsert `{uid}/avatar.ext` → update `avatar_path`), removal action, cleanup on profile/account delete.
- RLS/storage tests: SVG rejected; oversize rejected; cross-UID path rejected; replace leaves 1 object; delete-then-null consistency.
- Acceptance: avatar round-trip (upload → public URL renders → replace → delete) with ≤1 object per user.
- Rollback: remove actions; orphan objects cleaned via owner delete.

## Stage G1-6 — Public directory + profile routes (read-only)
- Scope: `/players` + `/players/[handle]` server components via `DirectoryReader` only; `noindex` default + opt-in logic; 404-equivalence; metadata from projection.
- Migration impact: none.
- Application changes: routes + cards + pagination + empty states + a11y/SEO (skip link already in shell, focus management, alt text, semantic headings).
- Tests: unit (mocked reader) + Playwright smoke (handle page renders projection, private handle 404s); RLS matrix re-run (routes use RPC — assert no base-table import in route modules via lint rule).
- Acceptance: private/suspended/nonexistent handles indistinguishable (same 404); directory shows only eligible; no UID/PII in HTML beyond allowlist.
- Rollback: remove routes (no data impact).

## Stage G1-7 — Edit/settings + consent UX + deletion flows
- Scope: `/settings/profile` (owner base reads), consent toggles with explicit copy, handle-change throttle, avatar management, delete-profile and delete-account confirmations + re-auth.
- Migration impact: none (or tiny throttle-state migration only if server-enforced — prefer app-level timestamp check first; DB throttle only if abuse observed).
- Application changes: owner forms + danger zone + audit log hook (no audit table in G1 — log to app log with uid only).
- Tests: mass-assignment tests (extra keys ignored), consent copy review, deletion cascade tests (profile delete keeps `app_users`; account delete removes all + avatar cleanup), re-auth enforcement test.
- Acceptance: owner can complete lifecycle end-to-end in a disposable environment; non-owner cannot reach edit actions (403/404).
- Rollback: remove routes/actions (data already created remains; documented).

## Cross-stage gates
- No stage ships without its RLS/projection/storage tests green.
- `npm run db:types` regeneration after G1-2/G1-3 (requires disposable stack; primary untouched).
- Lint rule added by G1-1 and enforced thereafter: no `src/server/*` imports in `src/app/**`, `src/components/**`, `src/lib/**` (except server components explicitly marked — prefer zero exceptions in G1).
