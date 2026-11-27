# P11 migration design

## Files (all LOCAL PROPOSAL ONLY — NOT applied)

| File | Purpose | Depends on |
| ---- | ------- | ---------- |
| `20261113000001_p11_f01_trust_guard.sql` | Trust-state freeze trigger | P9 05 (`organizers`), D1/D1.5.1 (`is_super_admin`) |
| `20261113000002_p11_f02_published_integrity.sql` | Published-content freeze trigger | P9 05+06 (`tournaments`, lifecycle trigger) |
| `20261113000003_p11_moderation_queue.sql` | Queue tables + append-only guard, default-deny | P9 05 (`organizers` FK), G1 (`app_users`, `extensions`) |

Deterministic ordering: the `20261113` date prefix sorts after `20261112`
(P9); two-digit sequence suffixes fix intra-phase order. Each file states its
dependencies in its header. No file modifies another file's objects.

## What the files do and do not do

- **Do:** add two hardened trigger functions + triggers (F-01/F-02), three
  tables + one guard function + trigger (queue), comments, revokes.
- **Do not:** alter, drop, or replace any G1–P10 object; add any RLS policy;
  add any GRANT to any API role; add any RPC; touch storage; touch the P3
  projection (no tournament/organizer reader function is recreated).
- **Privilege delta of the whole phase: zero.** Pinned by
  `f03-bootstrap-queue.test.ts` (no `CREATE POLICY`, no privilege GRANT in
  any P11 file) and the per-finding suites.

## Contract preservation

- P3 14-column contract: untouched — no reader function is recreated or
  altered; `TOURNAMENT_DIRECTORY_COLUMNS` unchanged; P3 suites green.
- G1–P8 behavior: no baseline object touched (pinned: no ALTER/DROP of
  G1–P9 objects in any P11 body).
- P9 lifecycle semantics: preserved and tightened — F-02 complements the P9
  transition trigger (content vs transitions); the allowed-transition set is
  unchanged.

## Hardening conventions (all three files)

- Trigger functions: `security invoker` + `set search_path = ''` (D1.5.1
  convention), schema-qualified references, `RAISE EXCEPTION` with
  authority-describing messages.
- Every added function revoked from `public`, `anon`, `authenticated`.
- Queue tables: RLS enabled, zero policies, full revokes — inert by design.

## Rollback (per file, reverse order 03 → 02 → 01)

- 03: drop tables (decisions, cases, reports), drop guard function. No data
  migration involved; queue empty by construction (nothing could write it).
- 02: drop `trg_tournaments_freeze_published`, drop function. Restores P9
  posture (same-state pass-through) exactly.
- 01: drop `trg_organizers_trust_guard`, drop function. Restores P9 posture
  (application-boundary enforcement) exactly.

## Apply prerequisites (NOT met — nothing is applied)

1. Owner approval of the moderation-authority package (P10-04) for the
   F-01 moderator path to be meaningful.
2. Owner approval of the F-02 strict default (or a chosen relaxation set).
3. Separately authorized disposable replay (see
   `runtime-verification-strategy.md`) executing G1 → P9 → P11 in order
   with the repo's isolated-identity pattern, before any primary-project
   application is even proposed.
