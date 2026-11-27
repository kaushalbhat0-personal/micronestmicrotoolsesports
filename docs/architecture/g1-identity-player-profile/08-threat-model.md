# 08 — Threat Model (G1)

Assumption: all client input and all client-side checks are attacker-controlled. Server, RLS, CHECKs, and RPC predicates are the enforcement points.

## T1 — PII leakage via over-broad reads
- Scenario: directory/search returns email, UID, `game_user_id`, evidence paths, timestamps.
- Mitigations (APPROVED D-G1-03): RPC-only frozen projection allowlist (04 §5, 05 §5); no base-table anon grants; no `select *` (fixed `TABLE(...)` columns); RPC fixed output omitting IDs/email/`game_user_id`/evidence/precise timestamps (timestamps omitted); code review of RPC column lists; RLS tests asserting anon/authenticated non-owner base SELECT returns 0 rows.
- Tests: anon `SELECT FROM player_profiles` → 0 rows; authenticated non-owner → 0 rows; RPC returns only allowlisted keys (assert key set exactly).

## T2 — IDOR (object-level authorization failure)
- Scenario: user A updates/deletes user B’s profile or game profile by guessing UUID/handle.
- Mitigations (APPROVED D-G1-01/D-G1-02): every write policy binds `auth.uid()` (`user_id` / `player_user_id`); no `USING true` policies; no owner UPDATE policy on `app_users` at all (status/flags not owner-editable); server actions derive owner exclusively from the verified session, never from request body UID (forged `userId` ignored, session wins; `ensureAppUser(userId)` argument is server-derived); normal bootstrap uses the authenticated owner client; middleware never invokes bootstrap; mass-assignment allowlists (Zod `.pick`, explicit column lists, no client-supplied `user_id`).
- Tests: authenticated A `UPDATE/DELETE ... WHERE user_id = B` → 0 rows / RLS denial; owner UPDATE on `app_users` → denied; server action with forged `userId` ignored (session wins).

## T3 — RLS bypass via view/RPC confusion
- Scenario: attacker queries projection to reach base rows, or crafts view/RPC to escalate.
- Mitigations (APPROVED D-G1-03: RPC-only; views rejected): definer RPCs with fixed predicates (05 §5), not invoker views requiring base public grants and not definer views; `REVOKE ALL ... FROM PUBLIC` + least GRANTs (`EXECUTE` to anon/authenticated only); `search_path=''`; fully qualified objects; no dynamic SQL; fixed output columns (timestamps omitted); explicit consent + `status='active'` + `is_active` predicates; no user-created views/functions (no DDL grants to anon/authenticated).
- Tests: `EXPLAIN` review of RPC definitions in migration review; RLS test asserting base tables unreachable by anon even when RPC returns rows.

## T4 — Mass assignment (privilege/flag escalation)
- Scenario: client sends `is_discoverable=true` hidden field, `status='active'`, or `user_id` of another user.
- Mitigations (APPROVED D-G1-02): Zod strict objects (`.strict()`), explicit per-action DTOs, `status` never client-writable (no owner UPDATE policy on `app_users` at all), `user_id` never accepted from client, consent toggle is a dedicated action with confirmation (not part of generic profile patch).
- Tests: unit tests posting extra keys → rejected/ignored; RLS tests for `status` tampering (owner UPDATE denied).

## T5 — Unauthorized discoverability (forced public exposure)
- Scenario: bug or policy gap makes private profiles searchable; revoked consent still indexed.
- Mitigations (APPROVED D-G1-03): private-by-default defaults, AND-semantics (master + per-game + `status='active'` + `games.is_active`), RPC predicates include all flags, 404-equivalence (no existence oracle), `noindex` default, short cache TTL on profile routes.
- Tests: matrix test (private/master-off/game-hidden/suspended/inactive-game → absent from RPC search + by-handle empty); revocation test (toggle off → immediately absent).

## T6 — Storage abuse (oversize/malicious uploads, path traversal, orphan fan-out)
- Scenario: SVG with script, 100 MB upload, `../../` path, thousands of files per user.
- Mitigations: bucket MIME/size caps (512 KB avatars, raster only) + server re-validation; fixed `{uid}/avatar.ext` single path (no user subpaths, traversal impossible); extension allowlist + DB CHECK; single-file overwrite (no fan-out); owner-scoped policies with `foldername(name)[1]` check.
- Tests: upload SVG → rejected; oversize → rejected; forged path `other-uid/avatar.png` → RLS denial; replace-then-delete leaves ≤1 object.

## T7 — Account takeover / session confusion
- Scenario: Auth misconfig (open redirects, weak passwords, OTP abuse) enables takeover, then profile takeover follows.
- Mitigations: baseline already hardened (8-char min, no anon sign-ins, no OAuth without approval); G1 adds: production `site_url`/allowlist before public auth (gate in 01/10), email-confirmation decision (U1), no session in logs, `getUser()` server validation (already in middleware), no service-role in browser.
- Tests: redirect-allowlist review; auth baseline checklist before public onboarding (see G0.2 §9, carried into 10).

## T8 — Enumeration (handle/user discovery)
- Scenario: attacker scrapes handles via availability endpoint or timing.
- Mitigations: handle-taken responses rate-limited (throttling required; numeric limits need product approval — D-G1-05 stays open); by-handle 404-equivalence (no private-vs-missing distinction); directory pagination capped (`LIMIT ≤48` with bounded `OFFSET`), no total-private counts; `ILIKE` inputs escaped (`%`/`_`/`\` + `ESCAPE '\'`); no UID/sequential IDs in URLs (UUIDs unguessable; public URLs use handles only for eligible rows).
- Accepted residual: handle availability is inherently enumerable on signup-like flows (same as any username system); throttled, not eliminated.

## T9 — Fake verification / reputation spoofing
- Scenario: user crafts “verified” badge, skill score, or rank to win opportunities.
- Mitigations: G1 stores no verification status/rank/score; UI renders no badges; `game_user_id` omitted from projection; copy guidelines forbid trust chrome on self-declared fields. Future verification domain owns the badge, with evidence + reviewer gates.
- Tests: snapshot/unit tests asserting public card contains no `verified|score|rank|K/D` strings; schema test asserting no such columns exist.

## T10 — Cached/indexed profile after revocation
- Scenario: CDN/search still shows revoked profile.
- Mitigations: short revalidation, `noindex` default + opt-in indexing, no PII in OG images, documented best-effort external de-indexing. No sensitive fields in projection minimizes blast radius.

## Attack surface summary (G1)

| Surface | Exposed to | Controls |
|---|---|---|
| RPC directory search/by-handle | anon + authenticated | RPC-only; allowlist output (timestamps omitted), predicates (`is_discoverable AND is_visible AND status='active' AND is_active`), LIMIT ≤48 + bounded OFFSET, ILIKE escape + ESCAPE, GRANT EXECUTE only |
| Owner CRUD on 3 tables | authenticated owner rows only | RLS `auth.uid()` binds, CHECKs, Zod, mass-assignment guards |
| Avatar upload/delete | owner prefix only | Policy path check, MIME/size caps, single path |
| `games` read | public | Static catalogue, no writes |
| Admin (suspend/delete/seed) | service-role server only | No browser import, window guard, audit hook |

Security testing required (see 09): RLS matrix tests, projection key-set tests, IDOR tests, storage policy tests, mass-assignment tests, revocation matrix tests. No test may target the primary project destructively; tests run against RPC/base semantics in the future disposable replay or via policy-definition review until then.
