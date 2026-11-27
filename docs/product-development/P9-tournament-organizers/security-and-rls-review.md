# P9 security and RLS review

## Method

Static SQL review of both migration files + simulated authorization tests
(fake Supabase clients, no network) + route audits. **No runtime
PostgreSQL/RLS verification was possible**: remote database operations are
forbidden in this phase and no disposable/docker database may be used. The
distinction matters and is stated in every claim below.

## What was verified statically

- Default-deny: every base table enables RLS; anon holds no base-table
  privileges; public reads go through masked RPCs only.
- Least privilege: authenticated grants are the minimum for the approved
  operations (organizers select/insert/update; members select;
  tournaments select/insert/update). No delete grants anywhere.
- No caller authority: no function accepts a user id; `created_by` binds
  `auth.uid()`; writers resolve identity via `ensureAppUser()`.
- Immutability: slug/game/organizer/owner columns frozen by triggers;
  lifecycle transitions enumerated (everything else raises).
- Moderator reservation: every moderator-gated transition raises in the
  trigger with an authority message; no moderator policy grants direct table
  power.
- No cross-organizer access: tournament policies join `organizer_members`
  on the row's own `organizer_id`.
- No verification path: no policy or function mutates `trust_state` for
  members; `canTouchVerification()` is false for all roles.
- Money/URL/timezone shapes enforced twice (Zod + mapping + CHECKs).
- Audit alignment: `ORGANIZER_WRITES_ENABLED = false` and
  `TOURNAMENT_WRITES_ENABLED = false` both pinned by failing-if-flipped
  route tests.

## Simulated tests (no database)

- Reader key-set pinning, bad-URL fail-closed, bad-count fail-closed,
  multi-row anomaly rejection, pre-RPC vocabulary enforcement, unknown-game
  pass-through, transport-error mapping.
- Writer gate: validated inputs still throw `OrganizerWriteDisabledError`
  before any table touch.
- Workspace isolation: membership-gated selects, invisible rows → null
  (404-equivalence), no `user_id` parameter anywhere.
- Lifecycle matrix: allowed vs moderated vs forbidden transitions.

## What was NOT verified (explicit gaps)

1. The migrations have never executed against PostgreSQL: syntax, trigger
   behavior, RLS policy evaluation and RPC output shapes are reviewed, not
   run. A disposable-replay run is required before any remote apply.
2. `search_organizers` counts against `tournaments` — join correctness under
   RLS/`SECURITY DEFINER` needs the replay run.
3. Performance (GIN usage, RPC latency, pagination over-read) is unmeasured.
4. Storage policies for future organizer artwork are undesigned (reservation
   only).

## Standing findings (carried, not new)

- P8 organization/brand contracts remain proposals; their migrations were
  never applied — same posture as P9, no regression.
- P3 tournament RPCs did not exist before P9; the 06 migration now proposes
  them. Until applied, tournament discovery keeps resolving to the
  unavailable state — unchanged behavior.
