# 06 — Database Schema Proposal (P14-D1)

**Database:** PostgreSQL 17 / Supabase project `knniommcyyhbyiwljisk`  
**Mode:** additive; do not reset; do not modify G1 migration files.  
**Stance on historical D1 SQL:** treat as design evidence; **do not apply unchanged**. Reimplement approved requirements in new P14 migrations (`08-migration-plan.md`).

---

## 1. Smallest coherent table set

| Table | Foundation v1? | Rationale |
| --- | --- | --- |
| `teams` | **Yes** | Core aggregate |
| `team_members` | **Yes** | Roster + role/status |
| `team_games` | **No** | One `game_key` on `teams` |
| `team_invitations` | **No** | Workflow unapproved |
| `team_applications` / `applications` | **No** (defer P3) | Needs D1-D12 |
| `recruitment_posts` | **No** (defer P3) | Needs D1-D12 |
| `team_audit_events` | **Yes (slim)** | Ownership/membership mutations need audit once RPCs exist |
| `reports` | **Defer** | Retention undecided (D1-D9) — do not take live user reports |

**Optional later:** `recruitment_posts`, `applications`, invitations, reports — each with its own security contract.

If the owner insists on keeping historical D1 five-table shape, still require remediation semantics + status/role separation; that is a larger apply surface and is **not** the recommended minimum.

---

## 2. `public.teams`

```sql
-- Logical proposal (not applied in this phase)
id uuid PK default gen_random_uuid()
slug text NOT NULL UNIQUE
  CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 2 AND 60)
name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60)
description text NULL CHECK (description IS NULL OR char_length(description) <= 1000)
game_key text NOT NULL REFERENCES public.games(key) ON DELETE RESTRICT
region_code text NOT NULL CHECK (region_code IN (/* BGMI closed set */))
current_level text NOT NULL CHECK (… competitive levels …)
target_level text NOT NULL CHECK (… competitive levels …)
recruiting boolean NOT NULL DEFAULT true
is_public boolean NOT NULL DEFAULT true
lifecycle_status text NOT NULL DEFAULT 'active'
  CHECK (lifecycle_status IN ('active','archived'))
owner_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT
created_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT
organization_id text NULL  -- inert; never in RLS predicates
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
```

**Indexes**

- UNIQUE(`slug`)
- (`game_key`, `region_code`) for directory filters
- (`is_public`, `lifecycle_status`, `created_at DESC`) partial where public+active
- (`owner_user_id`)

**Triggers**

- `handle_updated_at`
- `enforce_teams_immutable_columns` — block changes to `slug`, `game_key`, `owner_user_id`, `created_by`, `organization_id` on direct UPDATE (transfer RPC uses controlled path)

**Logo/banner/country:** omit columns until product approves media/country; prefer additive later migration.

---

## 3. `public.team_members`

```sql
id uuid PK default gen_random_uuid()  -- optional; composite unique still required
team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE
user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE
role text NOT NULL CHECK (role IN ('captain','co_captain','player','sub'))
membership_status text NOT NULL CHECK (
  membership_status IN ('active','invited','applied','removed','left','suspended')
)
game_role text NULL CHECK (game_role IS NULL OR game_role IN ('IGL','Assaulter','Support','Scout'))
created_at timestamptz NOT NULL DEFAULT now()
joined_at timestamptz NULL
left_at timestamptz NULL
```

**Constraints**

- UNIQUE(`team_id`, `user_id`)
- Partial UNIQUE(`team_id`, `user_id`) WHERE `membership_status = 'active'` if soft history retained in-row  
  — **or** prefer terminal statuses in-row with single row per pair and status transitions (simpler for v1): keep UNIQUE(`team_id`,`user_id`) and mutate status.
- CHECK: if status ∈ (`removed`,`left`) then `left_at IS NOT NULL`
- CHECK: `role` elevated only when `membership_status = 'active'` (captain/co_captain inactive forbidden)

**Indexes**

- (`user_id`) for workspace “my teams”
- (`team_id`) WHERE `membership_status = 'active'` for counts/roster

**Note:** Owner authority lives on `teams.owner_user_id`. Do not require an `owner` role in `team_members` (avoids dual sources of truth). Optional: seed a `captain` active row for creator.

---

## 4. `public.team_audit_events` (slim)

```sql
id uuid PK
team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE
actor_user_id uuid NULL REFERENCES public.app_users(id) ON DELETE SET NULL
event_type text NOT NULL  -- e.g. team.created, team.updated, member.removed, ownership.transferred
payload jsonb NOT NULL DEFAULT '{}'::jsonb  -- non-secret projection only
created_at timestamptz NOT NULL DEFAULT now()
```

- RLS: no client SELECT/INSERT; writers = SECURITY DEFINER RPCs only
- Append-only trigger (block UPDATE/DELETE) mirroring admin audit posture
- Index (`team_id`, `created_at DESC`)

---

## 5. Helpers

| Function | Behavior |
| --- | --- |
| `is_team_member(team_id)` | `auth.uid()` has **active** membership |
| `is_team_captain(team_id)` | owner/creator **or** active captain — **must match approved D1-D3** |
| `is_team_owner(team_id)` | `owner_user_id = auth.uid()` |

All: `SECURITY DEFINER`, `search_path = ''`, `stable`, grant EXECUTE to `authenticated` only (or tighter if only used internally — prefer grant authenticated for RLS).

---

## 6. RLS requirements (tables)

### `teams`

- ENABLE RLS; revoke ALL from `anon`/`authenticated` then grant minimal.
- SELECT: members OR owner (workspace); **no anon SELECT**
- INSERT: authenticated + active + `owner_user_id = created_by = auth.uid()`  
  **Preferred:** deny direct INSERT; create via RPC only (stronger).
- UPDATE: captain/owner + active; column grants limited to editable list
- DELETE: deny client; archive via RPC

### `team_members`

- SELECT: active members of same team (and owner) — subject to privacy OPEN
- INSERT/UPDATE/DELETE: **revoke from clients**; RPC-only
- No policy that allows self role escalation

### `team_audit_events`

- No client policies (default deny)

Public discovery: **RPC only** (same pattern as G1 players).

---

## 7. Grants / revokes (pattern)

```
REVOKE ALL ON TABLE … FROM PUBLIC, anon, authenticated;
GRANT SELECT ON teams TO authenticated;           -- if direct workspace reads retained
-- Prefer: no GRANT INSERT/UPDATE/DELETE on team_members to authenticated
GRANT EXECUTE ON FUNCTION search_teams… TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_team_by_slug… TO anon, authenticated;
GRANT EXECUTE ON mutation RPCs TO authenticated;  -- when approved
```

Column-level UPDATE on `teams` for editable fields only (name, description, levels, recruiting, is_public, region_code, updated_at).

---

## 8. Relationship diagram

```
games ←—— teams ——→ app_users (owner_user_id, created_by)
              │
              ├── team_members ——→ app_users
              └── team_audit_events ——→ app_users (actor, nullable)
```

---

## 9. Deliberately not modeled in foundation

- Multi-game divisions (`team_games`)
- Invitation tokens table
- Application/recruitment tables
- Live reports intake
- Billing/entitlement columns
- Verified badges
- Age fields
