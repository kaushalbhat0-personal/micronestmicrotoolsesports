# 05 — Data Model and Migration Design

**Status:** Proposed schema for M2B.3B. **Do not create a migration in M2B.3A.**

## 1. Design goals

- Minimum viable private metadata.
- No raw image bytes in Postgres.
- Do not widen public player projection.
- Avoid unnecessary duplication of live `game_user_id` — **snapshot at submit** is intentional and required.
- Bind evidence to the BGMI ID **as claimed at submission time**.

## 2. Tables (proposed)

### 2.1 `player_bgmi_ownership_cases`

One verification application / case.

| Column | Purpose | Sensitivity | Owner | Read | Write | Constraints | Retention |
|---|---|---|---|---|---|---|---|
| `id` uuid PK | Case id | Low | System | Owner; super-admin | Insert: owner; update: owner (limited) / admin (M2B.4) | Default gen_random_uuid() | Soft-delete or hard on account delete |
| `player_id` uuid FK → profiles/auth | Subject | Medium | Player | Owner; super-admin | Insert only as self | NOT NULL; RLS | Cascade on account delete |
| `status` text/enum | Review state | Low | System | Owner (own); admin | Owner: draft→pending, withdraw; admin: decide later | CHECK allowed values | Keep history |
| `claimed_game_user_id` text | **Immutable snapshot** of BGMI Player ID at submit | **High (PII)** | Player at submit | Owner; super-admin | Set once on submit; **never update** | NOT NULL on pending+; same validation as M2B.2 (4–32, no controls) | Retain with case |
| `claimed_game_user_id_normalized` text optional | Optional compare key if trim rules evolve | High | System | Same | Set once | Optional | Same |
| `evidence_count` int | Denormalized 1..2 | Low | System | Owner; admin | Trigger/app maintained | CHECK 0–2; pending requires ≥1 | — |
| `submitted_at` timestamptz | Entered pending | Low | System | Owner; admin | Set on transition | NULL until pending | — |
| `withdrawn_at` timestamptz | Withdrawal | Low | System | Owner; admin | Owner withdraw | — | — |
| `created_at` / `updated_at` | Audit | Low | System | Owner; admin | Triggers | — | — |
| `decision_id` uuid NULL | FK future decisions (M2B.4) | Low | Admin | Admin; owner sees outcome only via status | M2B.4 | NULL in 3B | — |

**Do not** store live `game_user_id` as a FK sync. Live value remains on profile; case keeps snapshot.

**Binding rule:** Reviewers and badge logic compare evidence to `claimed_game_user_id`. If profile `game_user_id` later changes, case snapshot is unchanged → prevents mistaking a new ID for the old verified identity.

### 2.2 `player_bgmi_ownership_evidence`

Metadata for each Storage object (max 2 per case).

| Column | Purpose | Sensitivity | Owner | Read | Write | Constraints | Retention |
|---|---|---|---|---|---|---|---|
| `id` uuid PK | Evidence id (= path segment) | Low | System | Owner; admin | Insert owner | — | Delete with object |
| `case_id` uuid FK | Parent case | Low | — | Same as case | Insert with case | ON DELETE CASCADE | — |
| `player_id` uuid | Denormalized for RLS | Medium | Player | Owner; admin | = case.player_id | NOT NULL | — |
| `storage_bucket` text | Always `private-verification` | Low | System | Same | Fixed | CHECK | — |
| `storage_path` text | Full object path | Medium (path contains uid) | System | Owner; admin | Server only | UNIQUE; matches scheme | — |
| `content_type` text | Canonical MIME | Low | System | Same | Server | Allowlist | — |
| `byte_size` int | Size after sanitize | Low | System | Same | Server | >0 ≤5MiB | — |
| `width` / `height` int | Pixel size | Low | System | Same | Server | Bounds | — |
| `sha256` bytea/text | Integrity / dedupe | Low | System | Admin; optional owner | Server | — | — |
| `sort_order` smallint | 1 or 2 | Low | System | Same | Server | UNIQUE(case_id, sort_order); 1..2 | — |
| `created_at` | — | Low | — | — | — | — | — |

**No** `bytea` image payload columns.

### 2.3 Future (M2B.4, not created now)

`player_bgmi_ownership_decisions` — reviewer_id, decision, reason, decided_at; referenced by `decision_id`. Audit also via `admin_audit_logs`.

## 3. RLS conventions (proposed)

Follow existing tenant/owner patterns:

- Enable RLS on both tables.
- Owner: `player_id = auth.uid()` for SELECT; INSERT with check; UPDATE only allowed columns/status transitions.
- Super-admin SELECT via `is_super_admin()` (existing function — verify in migration apply for 3B).
- No anon policies.
- No team-membership policies.
- No SECURITY DEFINER RPC that returns other players’ evidence paths without admin check.

## 4. Indexes

- `(player_id, status)` partial unique where status in (`draft`,`pending_review`) → enforce one active case.
- `(case_id)` on evidence.
- Optional `(claimed_game_user_id)` for admin search — **careful:** PII; admin-only.

## 5. Relationship to `game_user_id`

| Store | Role |
|---|---|
| `profiles.game_user_id` (or existing column location) | Live private ID; editable per M2B.2 |
| `claimed_game_user_id` on case | Immutable claim for that submission |

Duplication is **intentional snapshotting**, not accidental denormalization of a changing field.

## 6. Migration notes (for M2B.3B only)

1. Create enums/tables/indexes/RLS.
2. Do **not** alter Storage bucket in same migration unless tightening MIME (optional separate).
3. Do not touch LMS.
4. Do not restore legacy migrations.
5. Grant only needed privileges to `authenticated`.

## 7. Reuse of existing tables

| Table | Reuse? |
|---|---|
| `admin_audit_logs` | Yes for M2B.4 decisions / sensitive admin views |
| `platform_admins` | Reviewer gate |
| Event/metadata catch-alls | Prefer dedicated tables for clear RLS — avoid stuffing evidence paths into generic JSON event blobs |
