# 03 — Verification Workflow (Manual BGMI Ownership Evidence)

Locked: manual review only; separate from completeness and discoverability; never “official BGMI verification.”

Public copy recommendation: **“BGMI ownership evidence reviewed”** (not “Verified by Krafton / BGMI”).

## 1. Goals

- Player proves control of the claimed IGN + BGMI Player ID via screenshot evidence.
- Reviewers decide approve/reject with internal reasons and audit.
- Public surface is minimal; evidence never appears in Share Kit or directories.

## 2. Status model (Proposed)

Canonical status names (align with existing moderation tone; may rename if conventions demand):

| Status | Meaning | Public badge? |
|---|---|---|
| `not_submitted` | No active case | No |
| `pending` | Awaiting reviewer | No |
| `approved` | Reviewer accepted current evidence + claimed IDs | Yes (minimal) |
| `rejected` | Reviewer rejected; internal reason stored | No |
| `withdrawn` | Player withdrew or system invalidated | No |

Derived UI may show `not_submitted` when no row exists (avoid storing idle rows).

## 3. State transitions (Proposed)

```
(none) ──submit──► pending
pending ──approve──► approved          [reviewer only]
pending ──reject──► rejected           [reviewer + reason]
pending ──withdraw──► withdrawn        [owner]
rejected ──resubmit──► pending         [owner; new/replaced evidence]
withdrawn ──resubmit──► pending
approved ──withdraw──► withdrawn       [owner]
approved ──invalidate──► withdrawn     [system: ID change / account delete / admin]
approved ──resubmit──► pending         [owner; optional re-verification path]
```

### Forbidden transitions

- Ordinary user → `approved`
- Self-approval (actor_user_id = subject_user_id)
- Client direct UPDATE of status columns (no PostgREST write grants)
- `rejected` → `approved` without new review of current evidence
- Unlogged status changes

## 4. Evidence submission (Proposed)

### Content rules

- Normally **one** screenshot showing both IGN and BGMI Player ID.
- Second screenshot allowed only when needed to establish both values clearly (max **2** objects per submission).
- Evidence is **private** — never a public avatar; never Share Kit input.

### Storage

Reuse existing bucket **`private-verification`** (Verified in `20261110000002_storage_foundation.sql`):

| Property | Existing / Proposed |
|---|---|
| Public | Existing: false |
| Size | Existing: 5 MB |
| MIME | Existing: images + pdf — **Proposed:** restrict player evidence to `image/png`, `image/jpeg`, `image/webp` only (reject PDF for this flow unless product insists) |
| Path | Existing convention `{auth.uid()}/{uuid}.{ext}` |
| Owner policies | INSERT/SELECT/DELETE on own folder |
| Reviewer read | Existing intent: service_role **signed URLs** after authz — not public URLs |

**Path ≠ authorization:** folder UID check is necessary but insufficient alone; every download must re-check session ownership or reviewer role server-side before minting a signed URL.

### Upload flow (Proposed)

1. Owner authenticated + active.
2. Zod validate MIME (sniff magic bytes server-side), size, extension whitelist.
3. Upload to `private-verification/{uid}/{object_id}.ext` via user session (RLS) **or** server route that uses user-scoped client.
4. Insert/update submission metadata row referencing object paths (not public URLs).
5. Set status `pending`; append audit event.
6. Replace: delete prior pending objects (owner DELETE policy) + update metadata.
7. Withdraw: status `withdrawn`; delete or retain per retention policy (Open).

### Download flow

| Actor | Allowed | Mechanism |
|---|---|---|
| Subject owner | Own evidence | Short-lived signed URL after `auth.uid()` match |
| Reviewer (`is_super_admin`) | Pending/historical for review queue | Server action: verify `is_super_admin` → create signed URL with service role **only on server** |
| Anon / other players / team owners | Never | Deny |

Signed URL TTL: Proposed **60–300 seconds**; never embed long-lived URLs in HTML/JSON caches.

## 5. Reviewer workflow (Proposed)

### Authorization (smallest secure approach)

**Verified:** `platform_admins` + `is_super_admin()` (+ active gate migration) exist.  
**Absent:** dedicated `player_reviewer` role; live `requireSuperAdmin` wiring.

**Proposed for M2:**

1. Reuse `is_super_admin()` as the only reviewer principal (no client boolean).
2. Implement `requireSuperAdmin(client)` server helper that calls the RPC / membership check each request.
3. All approve/reject via SECURITY DEFINER RPCs that:
   - Assert `is_super_admin()`
   - Assert actor ≠ subject
   - Assert current status allows transition
   - Write append-only audit (`admin_audit_logs` or dedicated `player_ownership_review_events`)
4. Grant/revoke reviewer access = insert/delete `platform_admins` (ops procedure; not self-serve).

If product later needs non-super-admin reviewers, add `platform_roles` — **out of M2 minimal path**.

### Review actions

| Action | Inputs | Effects |
|---|---|---|
| Approve | case_id, optional public note (empty/default) | status `approved`; set `reviewed_at`; set public flag source; audit |
| Reject | case_id, **internal reason** (required ≥5 chars) | status `rejected`; store reason privately; audit |
| Request info | Optional later | Prefer reject + reason for M2 |

Internal reasons: **never** in public projection, Share Kit, or owner-facing public pages (owner may see a **safe** rejection summary — Open whether full internal text is visible to owner).

### Queue UI

Extend `/workspace/moderation` (currently disabled shell) **or** add `/workspace/moderation/player-ownership` gated by `requireSuperAdmin`. No client-only hiding.

## 6. Public display (Proposed)

- Directory visibility: **unchanged requirement** — completeness + opt-in; badge **not** required.
- Profile page / Share Kit may show minimal label when approved, e.g. eyebrow “BGMI ownership evidence reviewed”.
- **Do not** add evidence URLs, reviewer names, or internal reasons publicly.
- **Do not** widen the frozen 12-column directory RPC with private fields. Prefer a separate DEFINER boolean reader (see `05-data-model-and-rls-design.md`).

## 7. Resubmission & appeals (Proposed)

- After `rejected` or `withdrawn`: owner may submit again (rate-limited).
- After `approved` ID change: auto-invalidate; new submission required.
- “Appeal” in M2 = resubmit + new review (no separate appeal entity unless volume demands).

## 8. Retention & deletion (Proposed)

| Event | Evidence objects | Metadata |
|---|---|---|
| Owner withdraw | Delete objects or mark tombstoned | status `withdrawn` |
| Account / profile delete | Delete folder `{uid}/**` | Cascade or purge job |
| Approved historical | Retain until withdraw/delete (audit needs) — **Open retention days** |

## 9. Rate limits (Proposed)

- Max 2 objects per submission; max N pending replacements per day (suggest 5).
- Reject spam resubmits while `pending` without replace semantics.
- Reviewer actions audited; no anonymous review endpoints.
