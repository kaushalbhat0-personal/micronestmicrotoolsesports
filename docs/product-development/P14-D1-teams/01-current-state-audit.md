# 01 — Current State Audit (P14-D1)

**Phase:** discovery / architecture / security contract only.  
**Scope:** new platform (`src/`, `supabase/migrations/202611*`, product docs).  
**Out of scope:** `legacy/` runtime, DB mutation, UI implementation, write-switch flips.

---

## 1. Verdict

Teams discovery and workspace **UI + domain contracts exist**. Persistent team tables and RPCs exist as **local, unapplied** D1 migrations. **All write paths are fail-closed.** Public directory calls masked RPCs that are **not live** on primary project `knniommcyyhbyiwljisk` (remote ledger is G1-only per P13 docs). No invented rows; missing tables surface as unavailable/error, not fake data.

---

## 2. Inventory — feature module

| Area | Path | Status |
| --- | --- | --- |
| Pure domain | `src/features/teams/domain/` | Levels, roles, matching, directory/workspace contracts |
| Zod | `src/features/teams/schemas/` | `team`, `directory`, `workspace` |
| Public reader | `src/features/teams/server/team-directory-reader.ts` | RPC-only (`search_teams`, `get_team_by_slug`) |
| Workspace reader | `src/features/teams/server/workspace.ts` | Session + RLS table reads; `ensureAppUser` |
| Workspace writer | `src/features/teams/server/workspace-writer.ts` | **`WORKSPACE_WRITES_ENABLED = false`** |
| Roster intake | `src/features/teams/roster/` | Pure paste/normalize (no DB) |
| Tests | `src/features/teams/tests/`, `server/*.test.ts`, `roster/tests/` | Static SQL + domain + gate tests |

**Player feature:** `src/features/player-profile/` (not `features/players/`). Teams do **not** FK to `player_profiles`; membership targets `app_users`. Shared vocabularies only (`BGMI_REGION_VOCABULARY`, `gameKeySchema`).

**Auth:** no `src/lib/auth/` / `src/features/auth/` in the new platform. Canonical pattern is `createClient()` → `auth.getUser()` → `ensureAppUser()` (G1). Caller-supplied user IDs are rejected by schemas and route audits.

---

## 3. Routes and UI actions

### Public (`src/app/teams/`)

| Route | Behavior | Writes |
| --- | --- | --- |
| `/teams` | Filters (game, region, query) + pagination (page size 24, max page 42) | None |
| `/teams/[slug]` | Public detail via `getTeamBySlug`; private/missing → identical 404 | None |
| `/teams/new` | `TeamForm` validates `teamSchema`; submit **disabled**, no server action wired | Disabled |

**Orphan presentation components (not mounted on live routes):** `RecruitmentPostCard`, `ApplicationForm`, `ApplicationStatus`.

### Workspace (`src/app/workspace/teams/`)

| Route | Behavior | Writes |
| --- | --- | --- |
| `/workspace/teams` | `listManagedTeams`; sign-in / empty / unavailable states | None |
| `/workspace/teams/[id]` | Overview + links | None |
| `/workspace/teams/[id]/settings` | Settings form; submit disabled | Disabled |
| `/workspace/teams/[id]/roster` | Role / game_role / is_self only; **no rendered user IDs** | None |

`actions.ts`: `createTeamAction` / `updateTeamSettingsAction` always return `WORKSPACE_DISABLED_MESSAGE` and never call writer ops.

---

## 4. Domain types and schemas (current)

### Public projection (frozen 9 + description on detail)

`id`, `slug`, `name`, `game_key`, `region_code`, `current_level`, `target_level`, `recruiting`, `member_count` (+ `description` on detail).

**Never in public projection:** `owner_user_id`, `created_by`, `organization_id`, timestamps, applicant data, member identities.

### Team create/update fields

`slug`, `name`, `gameKey` (literal `bgmi`), `regionCode`, `currentLevel`, `targetLevel`, `description?`, `recruiting`, `isPublic`. Update omits `slug` / `gameKey`.

### Membership roles (DB/Zod today)

`captain | co-captain | player | sub` — **role only; no membership status column** in current D1 SQL.

### Workspace roles (app layer)

`owner | captain | member`. Co-captain resolves to **member** (no captain rights). Owner authority can exist without a roster row (`owner_user_id`).

### Filters supported by actual RPC

`game`, `region`, `query`, `limit`, `offset`. **No** recruiting, level, or status filter params. Sort: `created_at desc` only (inside SQL).

---

## 5. Local D1 SQL (not applied remotely)

| Migration | Intent |
| --- | --- |
| `20261112000001_d1_admin_foundation.sql` | `platform_admins`, audit/cron ledger, `is_super_admin` |
| `20261112000002_d1_teams_discovery.sql` | `teams`, `team_members`, `recruitment_posts`, `applications`, `reports`; helpers; `search_teams` / `get_team_by_slug`; RLS |
| `20261112000003_d1_security_remediation.sql` | Active-admin check; team column freeze; withdraw-only apps; **deny `team_members` INSERT**; LIKE-escape search |
| `20261112000004_d1_insert_boundary_indexes.sql` | Application insert nullness (F-NEW-01); read indexes |

P13 docs: remote project has **G1 migrations only**; D1 remains in the pending push queue. Historical D1.5/D1.6 docs mark acceptance **blocked** pending owner decisions.

---

## 6. Historical proposals — not auto-approved

| Source | Treat as |
| --- | --- |
| P1 / P2 product-development docs | Evidence of shipped UI + gated writers |
| D1.5 / D1.5.1 / D1.6 / D1.6.1 product-discovery | Security findings + **AWAITING** decision register D1-D1…D1-D12 |
| P13-C0 | Migration push readiness; **no** teams apply yet |
| P14-B* design | Competitive Arena visual language; teams directory audited as text-dense / honest |

---

## 7. UI ↔ model mismatches

1. **Liveness:** UI expects RPCs/tables that are absent on remote → unavailable/error.
2. **Creation path:** `/teams/new` form not wired to `createTeamAction`; workspace empty state links to `/teams/new`.
3. **Recruitment:** components + tables designed; no public post RPC; writes blocked; D1-D12 open.
4. **Applications:** schema/UI exist; captain decision path intentionally denied.
5. **Status vs role:** product asks for invitation/application/removed/left; D1 stores only role on `team_members`.
6. **Logo/banner/country:** UI/product ask; **not** in D1 `teams` columns.
7. **Lifecycle status** (active/archived): not modeled (only `is_public` + recruiting boolean).
8. **`organization_id`:** nullable text, never authoritative (correct for D1-D4 recommended posture).
9. **Admin comment gap:** `000001` comments mention `record_admin_audit()` but do not create it.
10. **Zod recruitment vs SQL:** `availability_required` / `expires_at` requiredness diverge.

---

## 8. Security posture already enforced in code/SQL design

- Session-derived identity only (`ensureAppUser` / `auth.uid()`).
- Public reads RPC-masked; no anon base-table SELECT designed.
- Direct membership INSERT revoked in remediation SQL.
- Team ownership columns frozen on UPDATE (grant + trigger design).
- Applicant withdraw-only; captain decisions not inventable via direct UPDATE.
- Suspended users: active-status gates on mutations (G1 + D1.5.1 patterns).
- Write kill switch + static tests pin `WORKSPACE_WRITES_ENABLED = false`.

---

## 9. G1 contracts that must be preserved

- `app_users` identity + `status` (`active`/`suspended`).
- `games` catalogue (BGMI first).
- Frozen player public projection / directory RPCs — **untouched**.
- No widening of player projection from teams work.

---

## 10. Audit conclusion for P14-D1

The platform has a **presentation-complete, write-gated** Teams surface over an **unapplied, historically remediated** schema. P14-D1 must produce an implementation-ready contract that:

1. Separates approved vs open product decisions.
2. Recommends the **smallest** persistent model for membership foundation.
3. Reimplements approved requirements in **new** migrations (do not apply old D1 files unchanged).
4. Keeps all writes denied until security-material decisions are owner-resolved.
