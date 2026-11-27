# 05 — Data Model & RLS / Storage Design

Documentation only — **do not apply** migrations in M2A.

## Design principles

1. Minimal additive schema.
2. Do not put sensitive columns on public-readable tables/RPCs.
3. Reuse `game_user_id`, `private-verification`, `platform_admins`, `admin_audit_logs` patterns.
4. Preserve frozen 12-field player projection (`get_player_by_handle` / `search_player_directory`).

## 1. Reused existing objects (Verified)

| Object | Role in M2 |
|---|---|
| `player_profiles` | Display identity + discoverability consent |
| `player_game_profiles.game_user_id` | Private BGMI Player ID |
| `public-avatars` | Public portrait only |
| `private-verification` | Evidence blobs |
| `platform_admins` / `is_super_admin()` | Reviewer principal |
| `admin_audit_logs` | Optional shared audit sink |

## 2. Proposed new tables

### 2.1 `player_bgmi_ownership_cases`

Purpose: one logical verification case per player+game (start with `game_key='bgmi'`).

| Column | Type | Purpose | Sensitivity |
|---|---|---|---|
| `id` | uuid PK | Case id | internal |
| `subject_user_id` | uuid FK → `app_users` | Owner | internal |
| `game_key` | text FK → `games` | Title scope | internal |
| `status` | text check | `pending\|approved\|rejected\|withdrawn` | internal (public derived separately) |
| `claimed_ign` | text | Snapshot at submit | private |
| `claimed_game_user_id` | text | Snapshot at submit | **private** |
| `internal_reject_reason` | text null | Reviewer-only | **private** |
| `reviewed_by` | uuid null FK | Reviewer | internal |
| `reviewed_at` | timestamptz null | Decision time | internal |
| `created_at` / `updated_at` | timestamptz | Audit | internal |

**Uniqueness (Proposed):** at most one **non-terminal** pending row per `(subject_user_id, game_key)`; approved may be unique current via partial unique index `where status = 'approved'`.

| Concern | Rule |
|---|---|
| Owner | `subject_user_id` |
| Read | Owner: own rows minus maybe redacted reason policy; Reviewer: via DEFINER/RPC only |
| Write | Owner: insert/resubmit/withdraw via RPC; Reviewer: approve/reject via RPC; **no** direct authenticated UPDATE of `status` |
| Retention | Cascade on user delete; soft-withdraw keeps audit |
| Indexes | `(subject_user_id, game_key)`, `(status, created_at)` for queue |

### 2.2 `player_bgmi_ownership_evidence`

Purpose: metadata for 1–2 storage objects per case.

| Column | Type | Purpose | Sensitivity |
|---|---|---|---|
| `id` | uuid PK | Evidence id | internal |
| `case_id` | uuid FK | Parent case | internal |
| `storage_bucket` | text | Always `private-verification` | internal |
| `storage_path` | text | `{uid}/{object}.ext` | **private** |
| `content_type` | text | MIME | internal |
| `byte_size` | int | Size | internal |
| `sha256` | text null | Optional integrity | internal |
| `sort_order` | smallint | 1..2 | internal |
| `created_at` | timestamptz | | internal |

| Concern | Rule |
|---|---|
| Read/Write | No anon; owner select own via join; reviewers via signed-URL RPC only |
| Deletion | Owner withdraw / replace; cascade with case |

### 2.3 Public reviewed flag (Proposed — choose one)

**Option A (recommended):** Generated/secured column on private case table only; public read via new DEFINER:

`get_player_bgmi_ownership_public(p_handle text) → { handle, ownership_evidence_reviewed boolean }`

- Returns row only when player would be publicly visible (same predicates as profile) **or** simply boolean false when not.
- Does **not** alter the 12-column freeze.

**Option B:** Add `bgmi_ownership_reviewed boolean` to a side table `player_public_trust_flags(user_id)` readable only through that DEFINER.

**Rejected:** Adding columns into `search_player_directory` / `get_player_by_handle` return tables without an explicit freeze-break decision.

### 2.4 Discord (if ever persisted)

Separate table `player_discord_links` — see `06-discord-integration-design.md`. Not required for M2B.1–4.

## 3. RLS requirements (Proposed documentation)

### Cases / evidence tables

```
enable row level security;

-- Owner select own cases
USING (subject_user_id = auth.uid())

-- No owner update of status/reviewed_* columns (REVOKE UPDATE or column grants)
-- Owner insert only via SECURITY DEFINER submit RPC preferred

-- Reviewer: NO broad table SELECT policy for authenticated
-- Reviewer access exclusively through SECURITY DEFINER functions
-- that check is_super_admin()
```

Default deny for `anon`. No grants of UPDATE on status to `authenticated`.

### Storage policies (existing + tighten)

**Existing (Verified):** owner INSERT/SELECT/DELETE on `private-verification` where folder = `auth.uid()`.

**Proposed additions (docs only):**

1. Optionally remove owner DELETE after `approved` (force withdraw RPC to delete) — reduces tampering.
2. Keep **no** public SELECT.
3. Do **not** add authenticated SELECT for reviewers on storage — use service-role signed URLs after `is_super_admin`.
4. App validates MIME magic bytes + extension; bucket MIME is defense-in-depth.

### Signed URL strategy

| Step | Actor |
|---|---|
| 1. Browser calls Server Action `getEvidencePreviewUrl(evidenceId)` | User session cookie |
| 2. Server loads metadata with user client; checks owner **or** `is_super_admin` | |
| 3. If reviewer/owner OK, server uses **service role** storage client to `createSignedUrl(path, ttl)` | Server only |
| 4. Return short-lived URL to caller | Never log full URL |

Service role never shipped to browser.

## 4. RPCs (Proposed)

| RPC | Who | Effect |
|---|---|---|
| `submit_bgmi_ownership_case(...)` | owner | create/replace pending + evidence refs |
| `withdraw_bgmi_ownership_case(case_id)` | owner | withdrawn + optional storage cleanup |
| `review_bgmi_ownership_case(case_id, decision, reason)` | super-admin | approve/reject + audit |
| `get_player_bgmi_ownership_public(handle)` | anon/auth | boolean only |
| `set_player_discoverability` (extend) | owner | **add** directoryEligible guard |

## 5. Discoverability gate change (Proposed)

Extend `set_player_discoverability(true)` to fail unless directory-eligible completeness holds. Disabling always allowed.

Remediation for already-discoverable incomplete profiles: one-time SQL report + optional forced off (Open).

## 6. Audit

Prefer append-only rows:

- Either insert into `admin_audit_logs` via DEFINER `record_admin_audit` (**note:** app/DB writer wiring incomplete today — Verified gap)
- Or dedicated `player_bgmi_ownership_events` append-only with mutation-prevention trigger (mirrors `admin_audit_logs` / `team_audit_events`)

Every approve/reject/withdraw/invalidate/ID-change must emit an event with actor, before/after status, **no** raw evidence bytes, **no** tokens.

## 7. Sensitivity classification summary

| Data | Class | Public? |
|---|---|---|
| display_name, ign, handle, … (12 fields) | Public-when-consented | Yes via RPC |
| game_user_id | Confidential | Never public |
| Evidence images + paths | Confidential | Never public |
| Internal reject reason | Confidential (ops) | Never public |
| ownership_evidence_reviewed boolean | Public-when-approved+visible | Separate reader |
| Discord tokens | Secret | Never |
