# 08 — Migration Plan (P14-D1)

**Do not apply migrations in this phase.**  
**Do not reset Supabase.**  
**Do not modify G1 files.**  
**Do not bring old D1 migration files forward unchanged.**

Primary project: `knniommcyyhbyiwljisk`  
Remote today (docs): G1 applied; D1/P9/P11/P13 local-only pending P13 owner push.

---

## 1. Conflict with existing local D1 files

Local unapplied files already define teams:

- `20261112000001_d1_admin_foundation.sql`
- `20261112000002_d1_teams_discovery.sql`
- `20261112000003_d1_security_remediation.sql`
- `20261112000004_d1_insert_boundary_indexes.sql`

P13-C0 plans to push these. P14-D1 requires a **clean reimplementation** of approved membership foundation.

### Owner choice (blocking)

| Option | Description | Recommendation |
| --- | --- | --- |
| **A — Supersede** | Before any remote apply: remove D1 teams files from the apply queue (or replace bodies with no-op stubs **only if** history tooling requires filenames — prefer not). Ship new `2026xxxxxx_p14_d1_*` migrations implementing this proposal. Keep admin foundation decision separate. | **Preferred** for membership model changes (status≠role) |
| **B — Apply D1 then delta** | Apply remediated D1 as-is, then additive P14 migrations alter `team_members` (add status), add audit, tighten RPCs. | Acceptable if owner wants P13 push unchanged first |
| **C — Apply D1 unchanged only** | Forbidden by P14-D1 charter (“not unchanged”) and by open D1-D3/D10/D12 gaps for writes | Reject for write enablement |

**This phase makes no filesystem changes to migrations** beyond documentation. Implementation phase executes the chosen option after product decisions.

---

## 2. Proposed ordered P14 migrations (Option A sketch)

Timestamps illustrative — assign after owner sequencing with P13.

| # | Proposed file | Contents |
| --- | --- | --- |
| 1 | `…_p14_d1_teams_foundation.sql` | `teams`, indexes, updated_at, immutable-column trigger, RLS scaffolding, grants |
| 2 | `…_p14_d1_team_members.sql` | `team_members` with role **and** membership_status, constraints, indexes, RLS deny DML, helpers `is_team_member` / `is_team_owner` / `is_team_captain` |
| 3 | `…_p14_d1_team_public_rpcs.sql` | `search_teams`, `get_team_by_slug` (escaped, clamped, active count) |
| 4 | `…_p14_d1_team_audit.sql` | `team_audit_events` append-only + revoke client access |
| 5 | `…_p14_d1_team_create_rpc.sql` | `create_team` + optional `update_team_settings` (still app kill-switched until acceptance) |

**Not in this sequence:** invitations, applications, recruitment_posts, reports, ownership transfer RPC (until OPEN items resolve).

Admin (`platform_admins`) may remain on the P13 D1-01 path or a dedicated admin migration — **out of Teams membership minimum**, but `is_super_admin` active-join must exist before relying on it.

---

## 3. Option B delta sketch (if D1 already applied)

1. Add `lifecycle_status` to `teams` if missing.
2. Add `membership_status`, `joined_at`, `left_at` to `team_members`; backfill `active`.
3. Replace `member_count` subquery to count active only.
4. Add `team_audit_events`.
5. Confirm INSERT still revoked on `team_members`.
6. Add create/update RPCs; keep recruitment tables locked.

Do **not** edit historical D1 file bytes; only additive timestamps.

---

## 4. Migration-level verification matrix

| Check | How verified | Lane |
| --- | --- | --- |
| Tables exist with expected columns/CHECKs | `\d` / information_schema | Runtime disposable |
| FKs to `app_users`, `games` | catalog query | Runtime |
| RLS enabled | `pg_class.relrowsecurity` | Runtime |
| No anon table privileges | `has_table_privilege` | Runtime |
| `team_members` INSERT denied for authenticated | JWT role attempt | Runtime RLS |
| Public RPC column key-set | RPC call + assert keys | Runtime + static |
| LIKE escape / clamps | probe `%_\\` | Runtime |
| Immutable columns | UPDATE attempt | Runtime |
| G1 player RPCs unchanged | call + key-set freeze tests | Regression |
| No G1 object altered | migration diff review | Static |

---

## 5. Application gates (ordered)

1. Owner resolves security-material decisions in `10-open-product-decisions.md`.
2. Owner chooses migration Option A or B and updates P13 push plan accordingly.
3. Authorized apply to disposable/replay first.
4. Runtime RLS/RPC battery (see `09`).
5. Only then consider primary project apply.
6. App write switch remains **false** until create/update authorization tests pass.

---

## 6. Explicit non-actions for this discovery phase

- No `supabase db push` / reset / SQL DDL/DML
- No enabling `WORKSPACE_WRITES_ENABLED`
- No commit / push / deploy
- No modification of applied G1 history
