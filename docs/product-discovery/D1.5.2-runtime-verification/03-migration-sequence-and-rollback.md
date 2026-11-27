# 03 — Migration Sequence and Rollback

## Execution order (by filename timestamp; Supabase applies in this order)

1. `20261112000001_d1_admin_foundation.sql` — admin tables, `is_super_admin()`,
   audit/cron triggers, RLS enable, revoke-all.
2. `20261112000002_d1_teams_discovery.sql` — teams tables, helpers, RPCs,
   policies, grants. Depends on: `app_users`, `games` (G1), `handle_updated_at()`.
3. `20261112000003_d1_security_remediation.sql` — corrective layer. Depends on:
   every object it replaces/drops (policies, functions, grants from 000001/2).

M3 must run third and only third; it references no manually created object —
all dependencies are created by 000001/000002 (or pre-existing G1). On the
expected greenfield schema (G1 migrations `20261110000001–20261111000009`
applied) the sequence is dependency-complete.

## Transactional safety

All three files contain purely transactional DDL/DCL: `CREATE TABLE/FUNCTION/
TRIGGER/POLICY/INDEX`, `ALTER TABLE ... ENABLE RLS`, `REVOKE/GRANT`, `COMMENT`,
`DROP POLICY IF EXISTS`. No `CREATE INDEX CONCURRENTLY`, no `VACUUM`, no
database-level statements, no `DO` blocks with transaction control. Supabase
applies each migration file in its own transaction: a mid-file failure rolls
back that file only; earlier files stay applied. Partial-application risk
*within* a file is therefore limited to engine-level aborts (handled by
rollback), not half-written schema.

Re-application note: M3 is once-only like all migrations (`CREATE TRIGGER`
without `OR REPLACE`/`IF NOT EXISTS`, and policy DROP+CREATE, assume
first-run). Re-running requires manual reset of that file's effects — standard
migration discipline, not a defect.

## Rollback

- **Before first application (current state):** all three files are local-only.
  Safe removal set: `000003` alone (returns to the rejected-but-recorded D1
  pair), or all three (returns to pure G1). No data exists, so no data loss.
- **After any application:** rollback is forward-correction only. The tables
  carry FKs into `app_users`/`games` and (future) user data; dropping them
  would destroy data and violate FK dependents. Policy/grant/trigger fixes
  remain additive (`CREATE OR REPLACE`, DROP+CREATE). The immutable/withdraw
  triggers and column grants, once live with data, can only be narrowed further
  or revised by the approved feature migrations (FWD-01/FWD-02) — never by
  re-adding the broad grants.

## What D1.5.2 did NOT do

No migration executed, locally or remotely. No `db reset`, truncate, delete, or
cleanup. Files verified read-only (worktree check in final report).
