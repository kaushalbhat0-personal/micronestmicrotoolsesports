# 07 — RPC and RLS Security Contract (P14-D1)

**Default deny.** Session identity only. No browser direct membership writes.

---

## 1. Public read RPCs (required for discovery liveness)

### `search_teams(p_game text, p_region text, p_query text, p_limit int, p_offset int)`

| Item | Contract |
| --- | --- |
| Identity | None required (`anon` + `authenticated` EXECUTE) |
| AuthZ | Returns only `is_public` (+ `lifecycle_status = active` if present) |
| Validation | Clamp limit 1..60; offset 0..1000; escape ILIKE; trim/cap query |
| Tx | Read-only `STABLE` SECURITY DEFINER `search_path=''` |
| Returns | Frozen 9 columns |
| Errors | Empty set on miss; never raise existence detail |
| Concurrency | N/A |

### `get_team_by_slug(p_slug text)`

| Item | Contract |
| --- | --- |
| Identity | None required |
| AuthZ | Public+active only |
| Validation | Slug shape; invalid → empty |
| Returns | 9 columns + `description` |
| Privacy | No owner/org/member identities |

**member_count:** count rows with `membership_status = 'active'` only.

---

## 2. Session workspace reads

**Option A (current P2 design):** authenticated SELECT on `teams` / `team_members` via RLS helpers.  
**Option B (stricter):** workspace RPCs only (`list_managed_teams`, `get_managed_team`, `list_team_roster`).

**Recommendation:** keep Option A for parity with shipped readers **or** migrate to Option B before enabling writes. Either way, roster SELECT must not leak to anon and must not expose foreign teams.

---

## 3. Mutation RPCs (design; build only after open decisions)

All mutation RPCs:

- `SECURITY DEFINER`, `search_path = ''`
- First line: `v_uid := auth.uid();` if null → raise `not_authenticated`
- Join `app_users` require `status = 'active'`
- Validate inputs with DB CHECKs + app Zod
- Write `team_audit_events`
- Grant EXECUTE to `authenticated` only
- Never accept `owner_user_id` / actor ids as authorization inputs

### `create_team(...)` — proposed signature

```
create_team(
  p_slug text,
  p_name text,
  p_game_key text,
  p_region_code text,
  p_current_level text,
  p_target_level text,
  p_description text default null,
  p_recruiting boolean default true,
  p_is_public boolean default true
) returns table (id uuid, slug text)
```

| Rule | Detail |
| --- | --- |
| AuthZ | Active user; optional email-verified gate (**OPEN**) |
| Behavior | Insert team with owner/created_by = `v_uid`; optional captain member row; audit |
| Errors | `23505` → validation conflict; suspended → permission denied |
| Concurrency | Unique slug; single transaction |

**Prefer RPC over direct INSERT** even if insert policy exists.

### `update_team_settings(p_team_id uuid, …editable fields…)`

| Rule | Detail |
| --- | --- |
| AuthZ | `is_team_owner` OR approved captain helper |
| Behavior | Update grant-list columns only; trigger blocks immutables |
| Errors | Not found / not authorized → generic operation error (no oracle) |

### `transfer_team_ownership(p_team_id uuid, p_to_user_id uuid)` — **OPEN D1-D10**

| Rule | Detail |
| --- | --- |
| AuthZ | Caller is owner + active; target active member of same team |
| Behavior | Lock team; set owner; adjust roles; audit; deny if target invalid |
| Concurrency | `SELECT … FOR UPDATE` on team row |

### `leave_team(p_team_id uuid)` / `remove_team_member(p_team_id uuid, p_member_user_id uuid)` — **OPEN**

| Rule | Detail |
| --- | --- |
| AuthZ | Self-leave: active member; remove: owner/captain per matrix |
| Behavior | Deny if removing sole owner; set status terminal |
| Concurrency | Unique + row lock |

### `appoint_captain` / `revoke_captain` — **OPEN D1-D3**

Owner-only; target must be active member; cannot revoke last operational captain if product requires one (**OPEN**).

### Recruitment / application RPCs

**Out of foundation.** When designed: captain decision RPC must atomically accept → active membership insert; withdraw-only for applicants; decided_* forge blocked.

---

## 4. RLS policy checklist

| Table | anon | authenticated |
| --- | --- | --- |
| teams SELECT | deny | owner or active member |
| teams INSERT | deny | deny **or** self-owner-only if not using RPC |
| teams UPDATE | deny | owner/captain + active + column grants |
| teams DELETE | deny | deny |
| team_members * | deny | SELECT limited; DML deny |
| team_audit_events * | deny | deny |

Helpers used in policies must be DEFINER with empty search_path.

---

## 5. Threat → control map

| Threat | Control |
| --- | --- |
| Self-promotion | No self UPDATE on role; RPC allowlists |
| Cross-team membership edits | AuthZ re-check on `p_team_id` inside RPC |
| Unauthorized role changes | Owner-only appoint; trigger/RPC checks |
| Owner lockout / last-owner delete | RESTRICT FK + RPC guards |
| Duplicate active membership | UNIQUE(team_id,user_id) + idempotent accept |
| Concurrent race on accept | Transaction + unique violation handling |
| Privilege escalation via params | Ignore/forbid ownership fields from clients |
| Private field disclosure | Masked RPC returns; workspace projection discipline |
| Suspended mutation | Active join on every write path |
| Search DoS / injection | Clamps + escape |
| Service role misuse | App never exposes service key; admin paths separate |

---

## 6. Error vocabulary (app layer)

Map DB exceptions to existing domain errors:

- `WorkspaceValidationError` / `TeamDirectoryValidationError`
- `WorkspaceOperationError` / `TeamDirectoryOperationError`
- `WorkspaceDisabledError` while kill switch false
- `UnauthenticatedError` / `SuspendedError` from `ensureAppUser`

Never return PostgREST/SQL text to clients.

---

## 7. Runtime verification note

Static SQL tests and Vitest mocks **do not** prove RLS. Runtime proof requires disposable DB replay with anon/authenticated JWTs — **not** elevated MCP SQL as a substitute for role-scoped tests (per P13 feasibility docs).
