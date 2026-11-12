# 11 — Decision Freeze Record (G1)

Frozen: nine product-owner approvals. Documentation freeze only — no implementation authorized except G1-4 as explicitly scoped in §7 (product-owner approval 2026-11-11) and G1-7 as explicitly scoped by the G1-7 approvals below (2026-11-11). D-G1-10 enforcement is G1-8B scope (approved 2026-11-11) and is not authorized by this record.

## 1. Approvals

- **D-G1-01 — Lazy application-user bootstrap — APPROVED.** Lazy idempotent insert; trigger rejected.
- **D-G1-02 — Deny owner UPDATE on `app_users` — APPROVED.** No owner UPDATE policy; admin boundary only for `status`/flags.
- **D-G1-03 — RPC-only public projections — APPROVED.** Sole path: `search_player_directory` + `get_player_by_handle`. No public base-table reads, no broad views.
- **D-G1-04 — `game_user_id` omitted from all G1 projections — APPROVED (Option A, 2026-11-11).** Optional owner-private field; excluded in full and masked forms; no G1 search/filter/dedup; no verification claim; no recruiter/org/brand exposure; future sharing requires separate approval.
- **D-G1-05 — Handle change throttle — APPROVED (Option A, 2026-11-11).** Owners may change their handle with an approximately 30-day cooldown between successful changes, enforced by the application. Uniqueness stays case-insensitive; normalization follows existing behavior; no arbitrary handle mutation via generic profile update; changes auditable during the active operation only, no permanent moderation audit-history domain.
- **D-G1-07 — Hard deletion after confirmation — APPROVED (Option A, 2026-11-11).** Two operations only: remove an individual game profile; delete the canonical player profile and all associated game profiles. Whole-account deletion excluded. No Auth identity, `app_users`, unrelated-record or other-user deletion. Immediate handle reuse accepted. No surviving moderation audit history in G1. No grace period, deleted-pending state, scheduled purge or retention scheduler.
- **D-G1-08 — Profile completeness definition — APPROVED (2026-11-11).** Complete = handle + display name + (avatar OR bio) + ≥1 game-specific profile. Derived, not stored; informational only (no identity/game verification, trust, eligibility, skill or ranking implication).
- **D-G1-09 — Separate country and game-region vocabularies — APPROVED.** `country_code` ISO-3166-1 alpha-2; `region_code` game-specific; `ONLINE` game-region only.
- **D-G1-10 — Email-confirmation gate for discoverability — APPROVED (Option A: require, 2026-11-11).** Verified email is a prerequisite for enabling `is_discoverable`. Unverified registration, session establishment where Auth permits, and private profile creation/maintenance are unchanged. Enforcement is server-side (app-layer check plus database-level enforcement in the narrow DEFINER function so direct RPC invocation cannot bypass it). Email confirmation is mailbox control only — never player skill, identity or professional trust verification.
- **Discoverability consent copy — APPROVED (2026-11-11).** Title "Make my player profile discoverable" with the frozen paragraph (see §3). Defaults false, reversible, per-game visibility independent, withdrawal immediate on next RPC, no added projection fields.

## 2. Approval provenance

Explicit product-owner approval in the G1 decision-freeze conversation (D-G1-01/D-G1-02/D-G1-03/D-G1-09) plus explicit product-owner approval of D-G1-04 Option A dated 2026-11-11 (authoritative eight-point wording: optional owner-private; excluded in full and masked forms incl. masked; no search/filter/dedup; no verification claim; owner mutable/clearable with no public derivative; no recruiter/org/brand exposure; future sharing needs separate approval; G1-4 authorized on frozen 12 columns) plus explicit product-owner approval of D-G1-05 Option A, D-G1-07 Option A, D-G1-08 (approved set) and the discoverability consent copy, all dated 2026-11-11, plus explicit product-owner approval of D-G1-10 Option A dated 2026-11-11 (require verified email before `is_discoverable`; unverified private use unchanged; server-side enforcement; email confirmation is not player/skill/trust verification). Recorded in `10-open-decisions.md`. Do not ask for approval again for these nine; all other decisions still require explicit approval.

## 3. Approved behavior (frozen)

- **Bootstrap (D-G1-01):** first authenticated app action → server action checks `app_users` by `auth.uid()` → `INSERT ... ON CONFLICT (id) DO NOTHING` + re-select in the same transaction. Identity exclusively from the verified session. Authenticated owner client. No middleware writes. Re-select + validate `status`; `suspended` blocked generically. PK uniqueness = concurrency safety. Failure recoverable (onboarding-required).
- **Account-row immutability (D-G1-02):** owners have SELECT (own), INSERT (bootstrap own), no UPDATE, no self-DELETE on `app_users`. Owner edits live in `player_profiles` / `player_game_profiles`. `status`/`suspended_at`/`suspension_reason` change only through the explicitly authorized administrative boundary. No admin role/system invented.
- **Public projections (D-G1-03):** frozen output `handle, display_name, avatar_url, bio, country_code, game_key, game_name, ign, primary_role, play_modes, region_code, availability`. No `SELECT *`. No IDs/email/private identifiers/`game_user_id`/evidence/timestamps (timestamps omitted). Predicates `is_discoverable AND is_visible AND status='active' AND is_active` (where relevant). `LIMIT` 1..48 + bounded `OFFSET`. Handle `^[a-z0-9_]{3,20}$`; bounded query; allowlisted enums. Zod + SQL-side checks. `ILIKE` escapes `%`/`_`/`\` with `ESCAPE '\'`. No dynamic SQL. `SET search_path=''`, fully qualified objects. `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO anon, authenticated`. 404-equivalence.
- **Vocabularies (D-G1-09):** `country_code` optional ISO alpha-2, never `ONLINE`. `region_code` per-game vocabulary, selected by `game_key`. Different games may differ. New game = catalogue row + validation; canonical identity unchanged.
- **Identifier privacy (D-G1-04, Option A, 2026-11-11):** `game_user_id` stays optional owner-private text (4–32, duplicates allowed, owner mutable/clearable). Excluded from every G1 public projection in full and masked forms. Never a G1 search/filter/dedup key. No verification status, badge or ownership claim. No recruiter/org/brand surface exposure in G1. Future counterparty sharing or verification needs a separate approved decision and implementation.
- **Handle change (D-G1-05, Option A, 2026-11-11):** dedicated operation only; `handle` rejected by generic profile update (Zod `.strict()`); normalization + case-insensitive uniqueness unchanged; ~30-day cooldown between successful changes enforced atomically at the database boundary (row lock + timestamp check in one transaction); only success advances the cooldown; validation/collision failures do not; concurrent requests serialize. Durability requires additive `handle_changed_at` persistence (`updated_at` is not a valid proxy).
- **Deletion (D-G1-07, Option A, 2026-11-11):** hard delete after explicit confirmation. Game-profile removal deletes one owned row only; canonical-profile deletion deletes the canonical row (associated game profiles via approved cascade) plus owned avatar objects, releases the handle immediately, preserves `app_users`/Auth/catalogue/unrelated rows. No grace/pending/purge/scheduler/audit-history. Storage-first ordering with safe failure surfacing (no false success).
- **Completeness (D-G1-08, 2026-11-11):** derived helper only: complete = handle + display name + (avatar OR non-empty bio) + ≥1 game profile. No stored flag, no projection change, no discoverability side effect, no verification/trust language.
- **Consent copy (2026-11-11):** title "Make my player profile discoverable"; body "When enabled, your approved profile and visible game profiles can appear in the public player directory and on your public profile page. You can turn this off at any time. When disabled, your profile will no longer be returned by public discovery." Defaults false, reversible, per-game visibility independent, withdrawal immediate on next RPC, no added projection fields. Suspended writes stay blocked; suspension already suppresses public rows, so consent withdrawal while suspended is administrative (service-role) only.
- **Email-confirmation gate (D-G1-10, Option A, 2026-11-11):** enabling `is_discoverable` requires a verified email. Registration with an unverified email, session establishment where Auth permits, and private profile creation/maintenance are unaffected. Enforcement is server-side at two layers: the publish-path server operation asserts the confirmed-email signal from the verified session, and the narrow DEFINER function re-asserts it from the authoritative Auth record so direct PostgREST RPC invocation cannot bypass the gate. No schema change, no RLS redesign, no projection change. Email confirmation attests mailbox control only — no skill, identity or trust claim.

## 4. Security safeguards (frozen acceptance)

- RLS deny-by-default; anon zero base policies; owner binds `auth.uid()`; `status='active'` write guard via inline `EXISTS` (no extra DEFINER).
- DEFINER RPCs audited: `search_path=''`, no `EXECUTE`, static predicates, frozen columns, least GRANTS.
- Mass-assignment: strict Zod, explicit DTOs, no client `user_id`/`status`.
- IDOR/consent/revocation/enumeration/storage matrices per `08`/`09 G1-1..G1-4`, including adversarial anon + authenticated cases. Tests run in a disposable replay or via definition review; never destructively against the primary project.
- Throttling of public search/handle-availability endpoints is an explicit dependency; handle-change cooldown is now fixed at approximately 30 days (D-G1-05 approved 2026-11-11), numeric search limits still not invented.

## 5. Affected documents

- D-G1-01: `01` (FR-ID-01/A1), `02` (§1–§3 lifecycle/sequence), `07` (`ensureAppUser`/repos), `08` (T2), `09` (G1-1), `10`.
- D-G1-02: `02` (§5), `05` (§3 fixed cross-ref D-G1-03→D-G1-02 + grants), `07` (no `app_users` owner writes), `08` (T2/T4), `09` (G1-1), `10`.
- D-G1-03: `01` (FR-PV-05), `04` (§2/§5/§6 frozen), `05` (§5 frozen output/validation/grants), `07` (RPC-only readers/validation), `08` (T1/T3/T5/T8), `09` (G1-4/G1-6), `10`.
- D-G1-04: `D-G1-04-decision-brief.md`, `10` (status + eight-point approved position), `04` (§5–§6 exclusion incl. masked), `05` (§5 frozen output), `07` (reader contracts), `08` (T1/T9), `09` (G1-4).
- D-G1-09: `01` (A3), `03` (§1/§3/BGMI model), `04` (allowlist), `05` (§1 CHECKs), `07` (per-game validation), `09` (G1-2/G1-3), `10`.
- D-G1-05: `03` (§7), `05` (cooldown persistence + column-grant bypass closure), `07` (dedicated handle-change operation), `08` (T2/T4/T8), `09` (G1-7), `10`.
- D-G1-07: `02` (lifecycle), `04` (§7 deletion/retention), `05` (owner DELETE policies/grants), `07` (remove/delete operations), `08` (T2/T6), `09` (G1-7), `10`.
- D-G1-08: `03` (§7), `07` (derived helper), `09` (G1-7), `10`.
- D-G1-10: `07` (publish-path server check + DEFINER enforcement), `09` (G1-8B), `10`.
- Discoverability copy: `04` (§2 consent copy), `07` (consent operation), `09` (G1-7), `10`.
- Defect fixed: `05 §3` incorrect `D-G1-03` reference → `D-G1-02`.

## 6. Remaining open decisions (D-G1-04/D-G1-05/D-G1-07/D-G1-08/D-G1-10 closed 2026-11-11)

- D-G1-05 handle throttle — CLOSED (Option A, ~30-day cooldown, G1-7).
- D-G1-06 avatar canonicalization — open detail; gate: before G1-5.
- D-G1-07 deletion grace — CLOSED (Option A hard delete, game-profile + canonical-profile only, G1-7).
- D-G1-08 completion definition — CLOSED (approved set, G1-7).
- D-G1-10 email-confirmation gate — CLOSED (Option A: verified email required before `is_discoverable`; unverified private use unchanged; server-side enforcement; G1-8B owns implementation).
- D-08 moderation, D-09 application caps — open, no G1 dependency; safe to defer.

## 7. Implementation gates

- G1-1 requires D-G1-01/D-G1-02 (frozen). G1-2/G1-3 require D-G1-09 (frozen). G1-4 requires D-G1-03 + D-G1-04 (both frozen; G1-4 authorized 2026-11-11 on the frozen 12 columns with `game_user_id` excluded in all forms). G1-5 requires D-G1-06. G1-7 requires D-G1-05/D-G1-07/D-G1-08 (all approved 2026-11-11; authorized: dedicated handle-change with ~30-day cooldown, explicit consent operation with approved copy, per-game visibility, derived completeness helper, game-profile removal, canonical-profile hard deletion; whole-account deletion excluded; no grace/retention/audit/moderation scheduler). D-G1-07 and D-G1-10 are both approved (2026-11-11); public onboarding additionally requires `site_url`/allowlist verification plus the G1-8B enforcement implementation (confirmed-email publish gate + throttling) with its test gates green.
- No stage ships without its RLS/projection/storage tests green. No Supabase writes authorized by this freeze.

## 8. Authorization scope

This record authorizes documentation freeze only. It does not authorize SQL migrations, tables/functions/policies, Supabase writes, Auth/Storage changes, application code, routes, commits, pushes or deployments. Product scope unchanged: Teams/Orgs/Brands/vacancies/DMs/feeds/scores/badges/payments/tournaments remain out of G1; D-08/D-09 stay open.
