# P11 runtime verification strategy

## Question

Can the two corrective triggers and the queue DDL be executed and their
PostgreSQL/RLS behavior verified under the standing constraints (no Docker,
no second/disposable project, no remote writes, no new dependencies without
documented need)?

## Answer: still BLOCKED — no new dependency installed in P11

The D1.5.2/P10 inventory is unchanged: no local PostgreSQL-compatible
runtime exists in the repo, Docker is prohibited (so `supabase start` is
unavailable), and the integration lane needs live keys plus project writes.
P11 adds no engine and performs no remote operation. The evidence level of
this phase is: clause-level static review of three new migration bodies +
36 new static/simulated regression tests + the full existing battery.

## If PGlite (or equivalent) is proposed in a later phase

A PGlite-based harness (`@electric-sql/pglite`, real PostgreSQL as WASM)
would genuinely support, and any proposal must demonstrate each item:

- **Supported:** real RLS (USING/WITH CHECK evaluation per role), real
  GRANT/REVOKE enforcement, `BEFORE` trigger firing and ordering, `RAISE
  EXCEPTION` semantics, CHECK/UNIQUE/partial-index enforcement, `SECURITY
  DEFINER` vs `INVOKER` boundaries, `SET search_path` behavior.
- **Supabase-specific and NOT provable by PGlite alone:** `auth.uid()`
  JWT-claim wiring (needs GoTrue-issued tokens or a faithful stub —
  and the stub is precisely what would need proving), PostgREST
  anon/authenticated role switching per request, the `auth` schema and
  GoTrue isolated-identity flows for the multi-user matrix, and
  `extensions.gen_random_uuid()` availability.
- **Needs explicit approval first:** the package itself, its WASM binary
  download, the auth-stub design with its fidelity argument, and the mapping
  from harness results to primary-project behavior. Installing anything "to
  just try" would violate the new-dependency rule and could not be validated
  as Supabase-equivalent without the live reference it is meant to replace.

## What remains unverified (explicit, cumulative with P10)

1. All three P11 files have never executed: trigger creation, table
   creation, index builds, and revoke effectiveness are reviewed, not run.
2. F-01 trigger firing under real anon/authenticated/member/moderator JWTs,
   including the `is_super_admin()` subselect path.
3. F-02 freeze interaction with the P9 lifecycle trigger on shared rows
   (order-independence is argued statically from disjoint concerns).
4. Queue inertness through PostgREST role switching (no-policy ⇒ deny for
   every role, including moderators, until the authority migration).
5. Partial-unique-index behavior under concurrent report filing.
6. Whole-sequence replay atomicity (G1 → P9 → P11) and rollback steps.

## Consequence

Simulated tests are labeled as simulated in every claim. The platform is not
launch-ready on static evidence; the disposable-replay prescription from
D1.5.2/P10 stands unchanged and is now larger (three more files in order).
