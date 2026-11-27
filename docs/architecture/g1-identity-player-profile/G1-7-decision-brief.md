# G1-7 Decision Brief — Owner Settings, Consent, Deletion and Retention

Scope: decision review only. No implementation, no migration, no database
write, no storage change, no RPC change was performed or is proposed here.
All findings below are verified against the frozen architecture documents,
the G1-1–G1-6 implementation reports, the local migrations/code, and live
read-only inspection of the primary project on 2026-11-11.

## 1. Executive summary

G1-7 (owner settings, consent toggles, handle change, game-profile removal,
profile deletion, account deletion) is gated on three open product decisions:
D-G1-05 (handle throttle), D-G1-07 (deletion grace), D-G1-08 (completion
definition). The technical substrate for every option is already in place and
verified: owner UPDATE policies with active-status gates, cascade FKs,
consent predicates inside the RPCs, owner-scoped storage deletes, and the
absence of any DELETE path (fail-closed). What is missing is product approval
of behavior + copy, plus one narrow migration (DELETE policies/grants) and the
G1-7 server operations. Technical recommendation: D-G1-05 Option (a)
throttled, D-G1-07 Option (a) hard delete, D-G1-08 recommended set adopted.
None of the three requires inventing retention periods, legal obligations, or
a moderation system.

## 2. Exact original D-G1-05 wording

Source: `10-open-decisions.md` (lines 35–40), reproduced verbatim:

- Question: Allow free handle changes, throttled changes, or immutable handles?
- Options: (a) Throttled (recommended, e.g., 1 per 30 days, app-enforced). (b) Immutable. (c) Free.
- Recommendation: (a) — balances identity stability vs user correction.
- Impact: G1-7 app logic (no DB change initially).
- User approval required: Yes.

## 3. Exact original D-G1-07 wording

Source: `10-open-decisions.md` (lines 49–54), reproduced verbatim:

- Question: Hard delete on confirmation (recommended) or `deleted-pending` grace window with purge job?
- Options: (a) Hard delete (recommended for G1 — no retention system to operate). (b) Grace window (needs scheduler + purge + disclosure).
- Recommendation: (a).
- Impact: Lifecycle copy + tests.
- User approval required: Yes (privacy/retention).

## 4. Exact original D-G1-08 wording

Source: `10-open-decisions.md` (lines 56–61), reproduced verbatim:

- Question: Exact required set for “complete” (handle + display name + ?). Proposed: handle + display name + (≥1 visible game profile OR explicit “just looking” state?).
- Options: see 03 §7; product must pick whether game profile is required for completeness.
- Recommendation: handle + display name + avatar-or-bio + ≥1 game profile = complete; otherwise “incomplete” (non-blocking, no trust implications).
- Impact: UI copy + derived function (no stored flag).
- User approval required: Yes (product).

## 5. Current implementation facts

### 5.1 Consent and discoverability (verified)

- `is_discoverable` (`player_profiles`, live-verified `boolean NOT NULL DEFAULT false`):
  private by default. Creation forces `false` — the `create_player_profile()`
  RPC takes no discoverability parameter and the server asserts `false` on the
  returned row (fail-closed on default drift).
- No `setDiscoverability` server operation exists (grep of `server/`: only
  `ensureAppUser`, `getOwnProfile`, `createPlayerProfile`, `updatePlayerProfile`,
  game-profile CRUD minus removal, avatar upload/remove, directory readers).
  `schemas/discoverability.ts` defines the input shape; `schemas/update-profile.ts`
  explicitly rejects `is_discoverable` (`.strict()`, G1-7 owns it).
- `updatePlayerProfile` accepts only `display_name/bio/country_code/avatar_path`;
  nullable optionals allow clearing (bio/country/avatar); `display_name` is
  NOT NULL (no null). Generic patch exists; consent/handle flows do not.
- `is_visible` (`player_game_profiles`, live-verified `boolean NOT NULL DEFAULT true`):
  independently manageable per game today via `createGameProfile` /
  `updateGameProfile` (both accept `is_visible`). No `removeGameProfile` exists.
- RLS reality (live-verified policies + local migrations): owner UPDATE
  policies on both tables are row-bound (`user_id`/`player_user_id = auth.uid()`)
  with inline active-status `EXISTS` gates, but column-unrestricted — an
  authenticated owner can `UPDATE handle/is_discoverable/is_visible` directly
  via PostgREST today (throttle/consent UX absent, enforcement app-side only).
- RPC reality (live-verified function bodies, unchanged since G1-4): both
  projections predicate `is_discoverable AND is_visible AND status='active' AND
is_active` statically. Disabling discovery suppresses all public routes on
  the very next call (G1-4 live-proven incl. restore). Caches: profile routes
  use seconds-scale `revalidate = 60` + `noindex` default (G1-6); external
  de-indexing is best-effort and disclosed (04 §4, 08 T10).

### 5.2 Handles (verified)

- `handle` regex + lowercase + `UNIQUE (lower(handle))` (live-verified CHECK;
  index asserted in G1-2). Change path: `updatePlayerProfile` rejects `handle`
  (`.strict()`); no `updateHandle` operation; no throttle column/timestamp
  anywhere (live-verified column list). Handle-taken is the accepted enumerable
  residual (08 T8); throttling the availability check is explicitly open.

### 5.3 Deletion and retention (verified)

- No owner DELETE policy and no DELETE grant on `player_profiles` or
  `player_game_profiles` (live-verified `pg_policies` + `role_table_grants`;
  migrations defer pending D-G1-07). Self-service deletion of any kind is
  currently impossible (fail-closed; owner DELETE returns 0 rows).
- `app_users`: DELETE grant exists but no DELETE policy (deny-by-default; G1-1
  posture). No owner UPDATE/DELETE on identity (D-G1-02 frozen).
- FK cascades (live-verified): `auth.users → app_users → player_profiles →
player_game_profiles` all `ON DELETE CASCADE`; `game_key → games(key) ON
DELETE RESTRICT` (a title with profiles cannot be removed). Profile-only
  delete keeps `app_users` (future membership anchor); account delete removes
  `app_users` (cascades all) with Auth admin delete last (order prescribed in
  02 §5, unenforced by DB).
- No `deleted-pending` state exists (`status` CHECK is `active/suspended` only,
  live-verified). No purge job, scheduler, or retention duration exists
  anywhere. No audit/moderation tables exist; `suspension_reason` lives on
  `app_users` and cascades away with account deletion (moderation records do
  not survive account deletion by construction).
- Storage (live-verified): 3 buckets with caps/MIME as designed; exactly the 8
  foundation policies; zero objects (no orphans). Owner-delete policies exist
  for avatars; `removeAvatar` + upload flows use storage-first ordering with
  abort semantics; no profile/account-delete sweep flow exists (nothing to
  sweep yet); public-bucket objects stay addressable by previously observed URL
  after unlinking (documented G1-5 property, not a leak path for new readers).

### 5.4 Suspension and re-creation (verified)

- Suspended: writes blocked (active-status `EXISTS` in every write policy),
  own SELECT reads allowed (appeal/export), RPC hides all rows, bootstrap
  blocked with generic error (live-proven G1-1/G1-4). Suspended users cannot
  edit fields or withdraw consent themselves (no write path at all); hiding is
  enforced query-side regardless.
- Re-creation: deleting a profile frees its handle (unique index row removed);
  re-registration of the same handle afterwards is permitted by every layer
  (no reservation, no cooldown). Auth identity persists through profile-only
  deletion; a new profile can be created later (second create while one exists
  → `ProfileAlreadyExistsError`).

## 6. Combined lifecycle analysis

Mapping the ten lifecycle steps to implemented vs approval-needing behavior:

1. Canonical creation — implemented (G1-2): lazy bootstrap, atomic RPC, forced
   undiscoverable, handle uniqueness. Needs nothing from these decisions.
2. Game-profile add — implemented (G1-3): per-title rows, `is_visible`
   accepted at create/update. Removal op missing → needs D-G1-07(a) delete path.
3. Enable discoverability — NOT implemented as a flow (schema + Zod ready,
   operation missing). Needs D-G1-07-adjacent consent copy approval (see §9)
   but no new decision: the toggle is already contracted in 07.
4. Per-game visibility — implemented at the operation layer
   (`updateGameProfile.is_visible`); needs only G1-7 UI wiring, no decision.
5. Withdraw discoverability — RPC suppression proven; self-service flow
   missing. Same approval as (3).
6. Edit/clear fields — generic patch implemented (G1-2); handle change missing →
   needs D-G1-05. Clearing semantics exist (nullable optionals, NOT NULL
   display_name).
7. Avatar removal — implemented (G1-5, `removeAvatar`).
8. Suspension — implemented (G1-1/G1-4): writes blocked, rows hidden, reads
   preserved, bootstrap blocked. No decision needed.
9. Deletion requests — no flow of any kind exists. Needs D-G1-07 (which
   granularity levels to offer, which confirmation copy) + one narrow
   migration (DELETE policies/grants) + operations + tests.
10. Retention/anonymization — nothing exists and nothing is required for G1
    under Option (a): hard delete removes rows; cascades remove dependents;
    storage sweep removes objects; timestamps/PII leave with the rows. No
    retention period is invented or needed. Anonymization is out of scope
    (no analytics exports of private fields in G1 per 04 §7).

Dependencies among the three decisions: D-G1-05 is independent (app-enforced
cooldown, no migration). D-G1-08 is independent (derived function + copy, no
stored flag, non-blocking). D-G1-07 determines the delete migration shape
(D-07(a): DELETE policies only; D-07(b): status value + scheduler + purge +
disclosure — a different system). D-G1-07 interacts with D-G1-05 only in copy:
whether a deleted handle becomes immediately re-registerable (recommended yes
under (a), disclosed) or held.

## 7. Options comparison

### D-G1-05 handle changes

|                   | (a) Throttled (recommended)                                                 | (b) Immutable                   | (c) Free                           |
| ----------------- | --------------------------------------------------------------------------- | ------------------------------- | ---------------------------------- |
| User impact       | Correction possible; squatting churn bounded                                | Typo permanence; support burden | Full flexibility; squat/churn risk |
| Privacy/security  | Throttle needs availability-check throttling too (08 T8 residual, accepted) | Smallest enumeration surface    | Largest churn/oracle surface       |
| Operational cost  | One timestamp + app check (no migration initially)                          | Zero                            | Zero + abuse handling              |
| DB impact         | None initially (app-enforced, e.g. 30d)                                     | None                            | None                               |
| Projection impact | RPC joins on stable `user_id`; handle change reflects on next call          | Frozen handles                  | Same as (a)                        |
| Reversibility     | Window adjustable later                                                     | Hard to relax credibly          | Hard to tighten credibly           |
| G1-7 impact       | `updateHandle` op + cooldown state + tests                                  | Reject-handle op (copy only)    | `updateHandle` op without cooldown |

### D-G1-07 deletion

|                   | (a) Hard delete (recommended)                                           | (b) Grace window                                                        |
| ----------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| User impact       | Immediate, irreversible; must be explicit in copy                       | Recovery window; delayed finality                                       |
| Privacy impact    | Strongest G1 posture: rows+objects gone, no retention system to secure  | Pending rows must stay hidden everywhere (RPC predicate change + audit) |
| Security impact   | No new state machine; cascade FKs already verified                      | New `deleted-pending` status, purge identity, scheduler trust           |
| Operational cost  | One migration (DELETE policies/grants) + ops + tests                    | Scheduler + purge job + monitoring + disclosure                         |
| DB impact         | DELETE policies on 2 tables (+ app_users flow via service-role)         | Status CHECK widening + purge function + indexes                        |
| Storage impact    | Sweep exact `{uid}/*` paths in the same flow (pattern exists in G1-5)   | Sweep deferred to purge; orphans possible mid-window                    |
| Projection impact | Row vanishes next call (predicate unchanged)                            | Predicate must additionally exclude pending (RPC change)                |
| Reversibility     | Irreversible by design (disclosed)                                      | Reversible in-window; needs restore path                                |
| G1-7 impact       | `removeGameProfile` + `deleteProfile` + `deleteAccount` + confirmations | All of (a) plus pending state, restore, purge, disclosure               |

### D-G1-08 completion

|                  | Recommended set (adopt)                                   | Game-profile-optional variant     |
| ---------------- | --------------------------------------------------------- | --------------------------------- |
| User impact      | Clear checklist; "incomplete" non-blocking                | Lower bar; weaker guidance signal |
| Privacy/security | None (derived, no stored flag, no trust chrome per 03 §6) | Same                              |
| Operational cost | One pure function + copy                                  | Same                              |
| DB impact        | None (derived only — no migration under any option)       | None                              |
| G1-7 impact      | Copy + derived helper                                     | Copy + derived helper             |

Five concepts kept distinct: account deletion (app_users + cascade + Auth admin
last + storage sweep), canonical-profile deletion (profile row + game cascade,
account kept), game-profile removal (single `(player, game)` row), consent
withdrawal (flag flip, instant RPC hiding, data retained), suspension
(admin-only flag, writes blocked, data retained, reads preserved). Only
deletion removes data; the other four hide or restrict it.

## 8. Verified security gaps (read-only findings; nothing fixed in this task)

1. Consent/handle without guardrails (by-construction interim): owner UPDATE
   policies are column-unrestricted, so `is_discoverable`, `handle` and
   `is_visible` are directly writable via PostgREST today. Mitigations live
   only in not-yet-built G1-7 actions + future throttle. No evidence of
   exploitation (zero data rows); RPC predicates remain the enforcement point
   for readers.
2. No self-service deletion of any kind (fail-closed, intended pending D-G1-07).
3. Suspended users cannot withdraw consent or correct data themselves; hiding
   is enforced query-side, but a suspended user's public intent is admin-mediated.
4. Moderation traces (`suspension_reason`, timestamps) do not survive account
   deletion; no audit domain exists (reserved, D-08 open). Acceptable for G1
   only if product accepts it explicitly.
5. Handle re-registration after deletion is unrestricted (no reservation or
   cooldown); combined with D-G1-05(c) this would maximize squatting churn.
6. Auth-first deletion (Auth admin delete before app cleanup) would cascade app
   rows but orphan avatar objects (no sweep); the prescribed app-first order is
   procedural, not DB-enforced.
7. Public-bucket avatar bytes may outlive consent withdrawal at previously
   observed URLs (G1-5 documented property); delinking is immediate, byte
   erasure requires the object delete in the removal flow.

## 9. Technical recommendations

- D-G1-05: adopt (a) throttled — 30-day app-enforced cooldown, no migration.
  `updateHandle` operation + cooldown state in G1-7; throttle the
  availability check alongside (08 T8).
- D-G1-07: adopt (a) hard delete — immediate, irreversible, explicit
  double-confirmation copy. One narrow migration (owner DELETE policies on
  `player_profiles` + `player_game_profiles` with active-status gates mirroring
  UPDATE; least-privilege DELETE grants), three operations (`removeGameProfile`,
  `deleteProfile`, `deleteAccount` with app-first/Auth-last ordering + storage
  sweep), matrix tests. Keep (b) deferred, not rejected, for post-G1 scale.
- D-G1-08: adopt the recommended set (handle + display name + avatar-or-bio +
  ≥1 game profile = complete; otherwise incomplete, non-blocking, no trust
  chrome, derived function only). Product picks only whether to keep the set
  as stated.
- Minimum to begin G1-7: D-G1-05(a) + D-G1-07(a) + D-G1-08 set (§11). Consent
  toggle (`setDiscoverability`) needs no separate decision — it is contracted
  in 07 and its safety case (default-off, reversible, instant RPC effect) is
  proven; product approval of the exact consent copy rides with D-G1-07.
- Safely deferrable: D-G1-10 (blocks public onboarding, not G1-7), D-G1-07(b)
  grace machinery, retention durations, audit domain, D-08/D-09.
- Future architecture needed only if (b) is ever chosen, or if moderation
  evidence must survive deletion (dedicated retention/moderation design, out
  of G1).

## 10. Exact product-owner questions

1. D-G1-05: approve throttled handle changes (a), app-enforced 1-per-30-days,
   over immutable (b) or free (c)?
2. D-G1-07: approve hard delete on confirmation (a), immediate and
   irreversible, over a `deleted-pending` grace window with purge job (b)?
3. D-G1-07 scope: offer all three levels — game-profile removal, canonical
   profile deletion (account kept), full account deletion — each with explicit
   confirmation copy?
4. D-G1-07 copy: accept that deleted handles become immediately
   re-registerable by anyone, and that account deletion erases moderation
   traces (`suspension_reason`) with no audit retention in G1?
5. D-G1-08: approve complete = handle + display name + (avatar or bio) + ≥1
   game profile, shown as non-blocking guidance with no trust implications —
   or require a different set (including whether “just looking” counts)?
6. Consent copy: approve explicit enable/disable wording stating exactly what
   becomes public per 04 §3 (handle, display name, avatar, bio, country, game
   IGN/role/modes/region/availability), separate from profile save, with
   immediate-effect and best-effort de-indexing disclosure?

## 11. Minimum G1-7 authorization statement

G1-7 is authorized to begin when the product owner approves: D-G1-05 Option
(a) (throttled, ~30-day app-enforced), D-G1-07 Option (a) (hard delete with
the three levels and copy in §10 Q3–Q4), and the D-G1-08 completion set
(§10 Q5), plus the consent copy (§10 Q6). Authorized implementation scope:
`setDiscoverability` + `updateHandle` (+ cooldown) + `removeGameProfile` +
`deleteProfile` + `deleteAccount` (+ storage sweeps, app-first/Auth-last
ordering), exactly one narrow DELETE-policy migration, derived completion
helper, lifecycle copy, and the G1-7 test matrix. Expressly not authorized:
grace-window machinery, retention periods, audit tables, moderation workflow,
email-gating changes, or any G1-1–G1-6 modification.

## 12. Deferred work and dependencies

- D-G1-10 email-confirmation gate: blocks public onboarding, not G1-7;
  closed-development behavior (allow unverified) stands until then.
- D-G1-07(b) grace window: deferred; choosing it later requires status
  migration + scheduler + purge + RPC predicate change + disclosure.
- Retention durations, legal holds, audit domain: no requirement stated in
  G1; inventing them is out of scope.
- D-08 (moderation SLA/strikes), D-09 (application caps): open, no G1
  dependency, safe to defer past G1.
- G1-7 test matrix dependency: RLS DELETE-denial inversion tests, cascade
  tests, storage-sweep tests, consent round-trip tests, handle-cooldown
  tests, completion-derivation tests — all runnable in the disposable replay
  pattern, never destructively against the primary project.
