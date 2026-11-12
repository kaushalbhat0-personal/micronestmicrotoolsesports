# 02 — Grants, RLS, and Function Review (effective state after 000003)

## Effective table privileges (`authenticated`)

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `teams` | table | table | **columns only:** `name, description, current_level, target_level, recruiting, is_public, region_code, updated_at` | table (no DELETE policy → RLS denies) |
| `team_members` | table | **revoked** (no policy → denied) | table (captain+active policy) | table (captain+active policy) |
| `recruitment_posts` | table | table (captain+self+active) | table (captain+active) | table (captain+active) |
| `applications` | table | table (applicant+applied+active; F-NEW-01: `decided_*` unconstrained) | **columns only:** `(status, updated_at)` (withdraw-only policy + trigger) | revoked (M2; unchanged) |
| `reports` | — (no policy) | table (reporter+open+active) | — | — |
| `platform_admins` | — | — | — | — |
| `admin_audit_logs` | — | — | — (trigger) | — (trigger) |
| `cron_run_ledger` | — | — | running→terminal (trigger) | — (trigger) |

`anon`: no base-table privilege or policy anywhere; EXECUTE on `search_teams`
+ `get_team_by_slug` only (intended public path).

## Policy composition (no duplicates, no leftovers)

Every M3-touched policy follows `DROP POLICY IF EXISTS` → `CREATE POLICY` with
the identical name: `applications applicant withdraw`, `team_members captain
update/delete`, `recruitment_posts captain insert/update/delete`. The dropped
`team_members captain insert` has no replacement. Untouched policies
(`teams owner select/insert`, `teams captain update`, `team_members member
select`, `recruitment_posts captain select`, `applications applicant
select/insert`, `reports reporter insert`) remain exactly as in M2 — verified by
name diff. No table ends with two policies for the same command/role.

## Revoke-then-grant ordering

Each narrowed grant is preceded by its revoke in the same file (teams UPDATE
`000003:168-170`; applications UPDATE `000003:188-189`; team_members INSERT
`000003:230`; function EXECUTE pairs). No broad grant survives a later revoke,
and no narrow grant is later widened. Order within the file is safe in a single
transactional apply.

## Triggers (firing order analyzed)

- `teams` BEFORE UPDATE: `trg_teams_immutable_columns` (M3) fires before
  `trg_teams_updated_at` (M2) alphabetically; the checker constrains only
  protected columns, the stamper writes only `updated_at` — no conflict.
- `applications` BEFORE UPDATE: `trg_applications_updated_at` (M2) fires before
  `trg_applications_withdraw_boundary` (M3); the boundary permits the
  `updated_at` delta (it constrains note/created_at only) — no conflict.
- Severity note: both M3 triggers fire for **all** roles including owner and
  service-role (PostgreSQL semantics) — intended fail-closed now; future
  privileged RPCs must own their trigger revisions (FWD-01/FWD-02).

## Functions

- `is_super_admin()` — SQL, STABLE, DEFINER, `search_path=''`, auth.uid-only,
  active-gated; EXECUTE authenticated-only. No user-id parameter.
- `is_team_member/captain()` — unchanged from M2 (DEFINER, empty search_path,
  auth.uid-only, authenticated-only). Consumed by all recreated policies.
- `search_teams()` — replaced, same signature/defaults/columns; DEFINER,
  empty search_path, G1-parity escaping; EXECUTE anon+authenticated.
- `get_team_by_slug()` — unchanged (equality predicate, no wildcards).
- New/changed trigger functions (`enforce_teams_immutable_columns`,
  `enforce_application_withdraw_boundary`, three admin hardenings) — all
  `SECURITY INVOKER + SET search_path=''` with revoke-all from
  public/anon/authenticated. Trigger firing is unaffected by EXECUTE revokes
  (same as the G1 `handle_updated_at` pattern).
- No new function retains default PUBLIC execute: every created-or-replaced
  function is followed by an explicit revoke (verified per function).

## Indexes and constraints

M3 adds none and alters none: `teams.slug` unique, `applications_active_unique`
partial index, all CHECKs/FKs (incl. `owner/created_by RESTRICT`,
`reporter CASCADE`) behave exactly as in M1/M2. F-T13 (secondary indexes) stays
open by design (no product decision).
