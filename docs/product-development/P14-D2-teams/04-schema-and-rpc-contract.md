# 04 — Schema and RPC Contract (P14-D2 Locked)

Implements approved **A1–A6** + P14-D1 minimum tables.  
**Out of scope:** recruitment, applications, invitations, ownership transfer, leadership appoint/revoke RPCs, public roster identities.

**Preserve:** G1 tables and player public projection RPCs untouched.

---

## 1. Tables

### 1.1 `public.teams`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `slug` | text | UNIQUE; `^[a-z0-9]+(?:-[a-z0-9]+)*$`; length 2–60 |
| `name` | text | length 2–60 |
| `description` | text null | length ≤ 1000 |
| `game_key` | text | FK → `games(key)` ON DELETE RESTRICT |
| `region_code` | text | CHECK BGMI closed set (parity with G1/D1 vocab) |
| `current_level` | text | CHECK competitive levels |
| `target_level` | text | CHECK competitive levels |
| `recruiting` | boolean | NOT NULL DEFAULT true |
| `is_public` | boolean | NOT NULL DEFAULT true |
| `lifecycle_status` | text | NOT NULL DEFAULT `active`; CHECK (`active`,`archived`) |
| `owner_user_id` | uuid | NOT NULL FK → `app_users(id)` ON DELETE **RESTRICT** |
| `created_by` | uuid | NOT NULL FK → `app_users(id)` ON DELETE **RESTRICT** |
| `organization_id` | text null | **inert** — never in RLS |
| `created_at` / `updated_at` | timestamptz | DEFAULT now(); updated_at via `handle_updated_at` |

**Indexes:** UNIQUE(slug); (game_key, region_code); partial (is_public, lifecycle_status, created_at DESC) WHERE public+active; (owner_user_id).

**Trigger `enforce_teams_immutable_columns`:** BEFORE UPDATE reject changes to `slug`, `game_key`, `owner_user_id`, `created_by`, `organization_id`.

---

### 1.2 `public.team_members`

| Column | Type | Constraints |
| --- | --- | --- |
| `team_id` | uuid | FK → `teams(id)` ON DELETE CASCADE |
| `user_id` | uuid | FK → `app_users(id)` ON DELETE CASCADE |
| `role` | text | CHECK (`captain`,`co_captain`,`player`,`sub`) |
| `membership_status` | text | CHECK (`active`,`invited`,`applied`,`removed`,`left`,`suspended`) |
| `game_role` | text null | CHECK null or BGMI roles |
| `created_at` | timestamptz | DEFAULT now() |
| `joined_at` | timestamptz null | set when becoming active |
| `left_at` | timestamptz null | required when status in (`removed`,`left`) |

**PK / unique:** PRIMARY KEY (`team_id`, `user_id`).

**CHECKs:**  
- status ∈ (`removed`,`left`) ⇒ `left_at IS NOT NULL`  
- role ∈ (`captain`,`co_captain`) ⇒ `membership_status = 'active'`

**Indexes:** (user_id); partial (team_id) WHERE membership_status = `active`.

**A4:** create path inserts (`role=captain`, `membership_status=active`, `joined_at=now()`).  
**Authority:** ownership = `teams.owner_user_id` (A4).

---

### 1.3 `public.team_audit_events`

| Column | Type |
| --- | --- |
| `id` | uuid PK |
| `team_id` | uuid NOT NULL FK → teams CASCADE |
| `actor_user_id` | uuid NULL FK → app_users SET NULL |
| `event_type` | text NOT NULL |
| `payload` | jsonb NOT NULL DEFAULT `{}` |
| `created_at` | timestamptz NOT NULL DEFAULT now() |

**Trigger:** BEFORE UPDATE OR DELETE → raise (append-only).  
**Index:** (team_id, created_at DESC).

**Required events:** `team.created`, `team.settings_updated`.

---

## 2. Helpers (SECURITY DEFINER, `search_path=''`, grant authenticated)

| Function | Definition |
| --- | --- |
| `is_team_owner(p_team_id uuid)` | `exists teams where id=p and owner_user_id=auth.uid()` |
| `is_team_active_member(p_team_id uuid)` | active membership for `auth.uid()` |
| `is_team_captain(p_team_id uuid)` | active member with `role='captain'` **or** `is_team_owner` (A1 settings path). Co-captain **never** true here for admin. |

Prefer naming that makes A1 clear: settings authZ uses owner OR active captain role; leadership RPCs (future) use owner-only.

---

## 3. RLS / grants

### `teams`

- ENABLE RLS; REVOKE ALL from PUBLIC/anon/authenticated; then:  
- GRANT SELECT to authenticated.  
- Policy SELECT: `is_team_owner(id) OR is_team_active_member(id)`.  
- No anon SELECT.  
- No client INSERT/UPDATE/DELETE grants (mutations via RPC).  
- Column UPDATE grants **not** required if settings are RPC-only (preferred).

### `team_members`

- ENABLE RLS; REVOKE ALL DML from clients.  
- GRANT SELECT to authenticated.  
- Policy SELECT: caller is owner of team **or** active member of **same** team (A3 workspace identities).  
- No INSERT/UPDATE/DELETE policies for clients.

### `team_audit_events`

- ENABLE RLS; **no** client policies; REVOKE ALL from anon/authenticated.

---

## 4. Public read RPCs

### `search_teams(p_game text, p_region text, p_query text, p_limit int, p_offset int)`

- SECURITY DEFINER, STABLE, `search_path=''`  
- GRANT EXECUTE to `anon`, `authenticated`  
- Predicate: `is_public AND lifecycle_status='active'`  
- Escape ILIKE; clamp limit 1..60; offset 0..1000  
- Returns frozen 9 columns: `id, slug, name, game_key, region_code, current_level, target_level, recruiting, member_count`  
- `member_count` = count active memberships only  

### `get_team_by_slug(p_slug text)`

- Same security posture  
- Returns 9 columns + `description`  
- Private/missing → empty set (404-equivalence at app)

**Never return:** owner_user_id, created_by, organization_id, member identities, audit rows.

---

## 5. Mutation RPCs

Common rules: DEFINER; `search_path=''`; `v_uid := auth.uid()`; require active `app_users`; GRANT EXECUTE to `authenticated` only; write audit; never trust client-supplied owner/user ids for authZ.

### `create_team(...)` → `(id uuid, slug text)`

**Inputs:** slug, name, game_key, region_code, current_level, target_level, description null, recruiting default true, is_public default true.

**AuthZ (A5):**  
1. `auth.uid()` present  
2. `app_users.status = 'active'`  
3. `auth.users.email_confirmed_at IS NOT NULL`

**Txn (A4):**  
1. INSERT teams with `owner_user_id=created_by=v_uid`  
2. INSERT team_members captain/active for `v_uid`  
3. INSERT audit `team.created`  
4. RETURN id, slug  

**Errors:** unique slug → conflict; unverified/suspended → permission denied.

### `update_team_settings(p_team_id uuid, …editable…)` → `(id uuid)`

**Editable:** name, description, region_code, current_level, target_level, recruiting, is_public.  
**Forbidden:** slug, game_key, owner_user_id, created_by, organization_id, lifecycle_status (archive later).

**AuthZ (A1):** `is_team_owner(p_team_id) OR (active captain membership)`. Co-captain denied. Suspended denied.

**Txn:** UPDATE allowed columns; audit `team.settings_updated`.

### Explicitly **not** in this contract

- `transfer_team_ownership` (A2 deferred)  
- `appoint_captain` / `revoke_captain` (leadership management deferred)  
- `leave_team` / `remove_team_member` (membership admin deferred; when added, must enforce A2 last-owner rule)  
- recruitment/application RPCs  

---

## 6. App-layer gates (unchanged until D3 enablement)

- `WORKSPACE_WRITES_ENABLED = false` until migrations applied + tests green + owner flip.  
- Zod strict schemas continue to reject smuggled ownership keys.

---

## 7. G1 preservation

No ALTER to `app_users`, `player_profiles`, `player_game_profiles`, `games`, or player directory RPCs/`search_player_directory` column freeze.
