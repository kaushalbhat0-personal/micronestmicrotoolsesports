# 10 — Open Decisions (G1)

> Decision-freeze update: D-G1-01, D-G1-02, D-G1-03, D-G1-04, D-G1-05, D-G1-07, D-G1-08, D-G1-09 and D-G1-10 are APPROVED by explicit product-owner approval (D-G1-01/D-G1-02/D-G1-03/D-G1-09 in the G1 decision-freeze conversation; D-G1-04 Option A on 2026-11-11; D-G1-05 Option A, D-G1-07 Option A and D-G1-08 approved set on 2026-11-11; D-G1-10 Option A on 2026-11-11). D-08/D-09 remain open per program constraints and are not decided here. See `11-decision-freeze.md` for provenance.

## D-G1-01 — Application-user bootstrap: lazy vs trigger — APPROVED (lazy)
- Question: Create `app_users` lazily on first action or via `on_auth_user_created` trigger?
- Approved position: (a) Lazy idempotent insert. Trigger alternative is rejected and removed as an active option: no function/trigger in `auth` schema, no orphan rows from abandoned signups.
- Required safeguards (frozen): session-derived identity only (`auth.uid()`, never caller-controlled user ID); idempotent `INSERT ... ON CONFLICT (id) DO NOTHING` + re-select; concurrency safety via PK uniqueness + conflict handling in the same transaction; normal bootstrap uses the authenticated owner client; no unrestricted service-role bootstrap (service-role limited to authorized administrative operations: Auth admin delete, suspension flips, cleanup, seeding); no middleware database writes for bootstrap (middleware only refreshes session); bootstrap re-selects and validates resulting account status; suspended accounts cannot regain access through bootstrap (blocked with generic error); initialization failure is recoverable (app data first, auth last; onboarding-required when no row).
- Approval provenance: explicit product-owner approval in the G1 decision-freeze conversation.
- Impact: Determines G1-1 migration shape. Reversible before implementation, costly after.
- Affected stages: G1-1 (identity anchor + `ensureAppUser`); enforced through G1-2/G1-7 owner flows.

## D-G1-02 — Owner UPDATE on `app_users` — APPROVED (deny)
- Question: Allow owners any UPDATE on their `app_users` row or deny all owner UPDATEs in G1?
- Approved position: (a) Deny. No owner UPDATE policy on `app_users` in G1. The row is immutable except through an explicitly authorized administrative boundary (service-role admin path for `status`/`suspended_at`/`suspension_reason`).
- Required safeguards (frozen): account `status`, privileged flags and administrative attributes are never owner-editable; owner profile editing belongs in the relevant domain profile tables (`player_profiles`, `player_game_profiles`), not `app_users`. No administrative role or management system is invented by this decision.
- Approval provenance: explicit product-owner approval in the G1 decision-freeze conversation.
- Impact: RLS policy set in G1-1 (no owner UPDATE/DELETE on `app_users`).
- Affected stages: G1-1 (RLS); enforced in G1-2/G1-7 (no app action writes `app_users.status`).

## D-G1-03 — Public projection vehicle: RPC-only — APPROVED
- Question: Ship only the two definer RPCs or also a `security_invoker=false` view for direct PostgREST reads?
- Approved position: (a) RPC-only. Sole public read path is `search_player_directory` + `get_player_by_handle`. No direct public base-table reads; no broad public views.
- Required safeguards (frozen): `SECURITY DEFINER` with `SET search_path = ''`; fully schema-qualified objects (`public.*` + `pg_catalog` only); no dynamic SQL; fixed output columns (no `SELECT *`); explicit active-account and consent predicates (`player.is_discoverable AND game.is_visible AND app_users.status='active' AND games.is_active`, where relevant); explicit `REVOKE ALL ... FROM PUBLIC` + least-privilege `GRANT EXECUTE ... TO anon, authenticated`; strict parameter validation (Zod at app boundary + SQL-side checks; handle syntax/length, bounded query length, allowlisted enums); strict result limits (`LIMIT` max 48, bounded `OFFSET`); `ILIKE` literal matching with `%`/`_`/`\` escaping and deliberate `ESCAPE` clause; `get_player_by_handle` 404-equivalence (zero rows for ineligible/nonexistent); adversarial anonymous + authenticated security tests; public output omits internal user IDs, email, private identifiers, `game_user_id`, verification evidence and precise timestamps (timestamps omitted, not year-exposed).
- Approval provenance: explicit product-owner approval in the G1 decision-freeze conversation.
- Impact: G1-4 migration shape + reader contracts.
- Affected stages: G1-4 (functions + grants + matrix tests); consumed by G1-6 (routes via `DirectoryReader` only).

## D-G1-04 — `game_user_id` in projection — APPROVED (Option A: omit, 2026-11-11)
- Question: Omit entirely in G1 (recommended) or show masked last-4?
- Approved position: (a) Omit. `game_user_id` remains an optional, owner-private field; it is excluded entirely from every G1 public projection, including masked representations. It is not searchable, filterable or usable as a deduplication key in G1. No verification status, badge or account-ownership claim is permitted. The owner may change or clear the value; no public derivative exists. No G1 recruiter, organization or brand surface may expose it. Future counterparty sharing or verification requires a separate approved decision and implementation.
- Impact: RPC output list (frozen 12 columns; G1-4 authorized to implement with `game_user_id` excluded in all forms).
- Approval provenance: explicit product-owner approval (Option A) dated 2026-11-11. D-G1-04 is closed.

## D-G1-05 — Handle change throttle — APPROVED (Option A: throttled, 2026-11-11)
- Question: Allow free handle changes, throttled changes, or immutable handles?
- Options: (a) Throttled (recommended, e.g., 1 per 30 days, app-enforced). (b) Immutable. (c) Free.
- Recommendation: (a) — balances identity stability vs user correction.
- Approved resolution (2026-11-11): Option A. Owners may change their handle. Approximately 30-day cooldown between successful changes. Cooldown enforced by the application. Handle uniqueness remains case-insensitive. Handle normalization follows existing approved behavior. No arbitrary handle mutation through generic profile update operations. Handle changes must be auditable during the active operation, but no permanent moderation audit-history domain is approved.
- Implementation consequences: dedicated handle-change operation only; generic profile update continues to reject `handle`; only a successful change advances the cooldown; failed changes (validation/collision) do not advance it; concurrent changes must not bypass cooldown or uniqueness. Durability note: the pre-G1-7 schema carries no handle-change timestamp and `updated_at` is not a valid proxy (it advances on any profile edit), so G1-7 adds the smallest additive persistence required for a reliable cooldown (see G1-7 report). No in-memory or client-side cooldown.
- Impact: G1-7 handle-change operation + cooldown persistence (additive only). No moderation subsystem.
- User approval: received 2026-11-11. Closed.

## D-G1-06 — Avatar extension canonicalization
- Question: Canonicalize `jpeg→jpg` on upload or preserve original extension?
- Options: (a) Canonicalize to `{png,jpg,webp}` (recommended — single path per user simplifies replacement). (b) Preserve.
- Recommendation: (a).
- Impact: Upload action + CHECK regex.
- User approval required: No (implementation detail; recorded for consistency).

## D-G1-07 — Deletion grace period — APPROVED (Option A: hard delete, 2026-11-11)
- Question: Hard delete on confirmation (recommended) or `deleted-pending` grace window with purge job?
- Options: (a) Hard delete (recommended for G1 — no retention system to operate). (b) Grace window (needs scheduler + purge + disclosure).
- Recommendation: (a).
- Approved resolution (2026-11-11): Option A — hard delete after explicit confirmation. Two operations are approved: (1) remove an individual game profile; (2) delete the canonical player profile and all associated game profiles. Whole-account deletion is explicitly excluded from G1-7. Supabase Auth identities, `app_users` anchors, entire application accounts, unrelated records and other users' data are never deleted. Handle reuse is accepted immediately after deletion. No moderation audit history survives deletion in G1. No grace period, no deleted-pending state, no scheduled purge, no retention scheduler.
- Implementation consequences: exact owner-only DELETE policies/grants; session-derived identity only; storage cleanup of owned avatar objects with safe failure surfacing (no false success); cascade (or narrowly controlled transaction) removes associated game profiles; catalogue rows preserved.
- Impact: Lifecycle copy + tests (G1-7).
- User approval: received 2026-11-11 (privacy/retention). Closed.

## D-G1-08 — Profile completion definition
- Question: Exact required set for “complete” (handle + display name + ?). Proposed: handle + display name + (≥1 visible game profile OR explicit “just looking” state?).
- Options: see 03 §7; product must pick whether game profile is required for completeness.
- Recommendation: handle + display name + avatar-or-bio + ≥1 game profile = complete; otherwise “incomplete” (non-blocking, no trust implications).
- Approved resolution (2026-11-11): a player profile is complete when all conditions hold — handle exists; display name exists; at least one of avatar or bio exists; at least one game-specific player profile exists. Completeness is derived, not stored. It is informational only and must not imply identity verification, game account verification, trust, eligibility, skill or ranking.
- Implementation consequences: pure derived helper (no stored flag, no frozen-projection change); complete/incomplete + missing-requirements output for owner guidance; no discoverability side effects; no verification or trust language.
- User approval: received 2026-11-11 (product). Closed.

## D-G1-09 — Region model: country list + per-game server list — APPROVED (separate vocabularies)
- Question: Confirm seeded `country_code` allowlist and per-game `region_code` vocabularies in 03/05.
- Approved position: (a) Adopt separate vocabularies. `country_code` is an optional ISO 3166-1 alpha-2 code. `region_code` is a game-specific controlled vocabulary selected according to the player's game. `ONLINE` is permitted only in an applicable game-region vocabulary, never as a `country_code`. Different games may define different valid region vocabularies. Adding another game must not require redesigning canonical player identity (catalogue row + game-specific validation only, no canonical-profile schema change).
- Approval provenance: explicit product-owner approval in the G1 decision-freeze conversation.
- Impact: CHECK allowlists in G1-2/G1-3 (game-specific validation must not be hardcoded into canonical identity).
- Affected stages: G1-2 (canonical `country_code`); G1-3 (per-game `region_code`); carried into G1-4 search filters and G1-7 forms.
- Note: complete country/region seed lists are not invented here; allowlists are enumerated in migrations from the vocabularies already present in 03/05.

## D-G1-10 — Email-confirmation gate for discoverability (U1) — APPROVED (Option A: require, 2026-11-11)
- Question: Require verified email before `is_discoverable` can be enabled?
- Options: (a) Require (recommended before public). (b) Allow unverified (dev only).
- Recommendation: (a) before public onboarding; (b) acceptable during closed development.
- Approved resolution (2026-11-11): Option A. Users may register with an unverified email, establish an authenticated session where Supabase Auth permits it, and create and maintain a private player profile under the existing identity and profile security rules. An unverified user must not enable public player discoverability: email verification is a prerequisite for enabling `is_discoverable`. The rule is enforced server-side and never depends solely on frontend controls. Existing public directory RPCs continue to return only approved, consented public projections. Email confirmation is mailbox control only — it must never be represented as player skill verification, identity verification or professional trust verification.
- Impact: `setDiscoverability` server check (`email_confirmed_at`), no schema change.
- Implementation consequences: app-layer confirmed-email assertion in the publish path plus database-level enforcement inside the narrow DEFINER function (direct PostgREST RPC invocation must not bypass the gate); no RLS/projection/grant redesign; no block on private profile creation. G1-8B owns it.
- User approval: received 2026-11-11 (product/security). Closed.

## Discoverability consent copy — APPROVED (2026-11-11)

**Make my player profile discoverable**

"When enabled, your approved profile and visible game profiles can appear in the public player directory and on your public profile page. You can turn this off at any time. When disabled, your profile will no longer be returned by public discovery."

Requirements (frozen): discoverability defaults to false; consent remains reversible; individual game visibility remains independently manageable; withdrawal must immediately suppress public discovery on the next RPC call; no additional public projection fields.

## Carried program decisions (not decided here)
- D-08 (moderation SLA/strikes): open. G1 dependency: none (evidence stays private, reviewer path reserved; workflow later). Gate: safe to defer past G1.
- D-09 (application caps/note lengths): open. G1 dependency: none (no application domain in G1). Gate: safe to defer past G1.

## Remaining open decisions — stage gates (frozen classification, statuses unchanged)
- D-G1-04 (`game_user_id` omit vs masked): CLOSED — Option A approved 2026-11-11 (omit in all forms, no search/filter/dedup, no verification claim, no recruiter/org/brand exposure; future sharing requires separate approval). G1-4 output freeze proceeds on the frozen 12 columns.
- D-G1-05 (handle change throttle): CLOSED — Option A approved 2026-11-11 (throttled, ~30-day cooldown, app-enforced; handle update only via dedicated operation). G1-7 owns it.
- D-G1-06 (avatar extension canonicalization): open, implementation detail (no product approval required per register). Required before G1-5 wiring.
- D-G1-07 (deletion grace period): CLOSED — Option A approved 2026-11-11 (hard delete after confirmation; game-profile + canonical-profile deletion only; whole-account deletion excluded). G1-7 owns it.
- D-G1-08 (profile completion definition): CLOSED — approved set 2026-11-11 (handle + display name + avatar-or-bio + ≥1 game profile; derived, informational). G1-7 owns it.
- D-G1-10 (email-confirmation gate for discoverability): CLOSED — Option A approved 2026-11-11 (verified email required before `is_discoverable`; unverified registration/session/private profiles unchanged; server-side enforcement; email confirmation is not player/skill/trust verification). G1-8B owns enforcement.
