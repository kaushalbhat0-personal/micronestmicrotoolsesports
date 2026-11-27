# 03 — Membership and Authorization Matrix (P14-D1)

**Default:** deny.  
**Identity source:** `auth.uid()` / session via `ensureAppUser` only. Never trust caller-supplied user IDs.  
**Status:** proposed matrix. Cells marked **OPEN** require owner approval before implementation (`10-open-product-decisions.md`).

---

## 1. Actors

| Actor | How established |
| --- | --- |
| Anonymous visitor | No session |
| Authenticated player | Valid session + `app_users` row |
| Active player | Authenticated + `app_users.status = active` |
| Suspended player | Authenticated + `status = suspended` |
| Team owner | `teams.owner_user_id = auth.uid()` |
| Team captain | Active `team_members` with `role = captain` **or** owner (helper dual-path) — **OPEN D1-D3** |
| Co-captain | Active member `role = co_captain` — **no elevated rights** unless OPEN subset approved |
| Team member | Active membership, non-captain |
| Platform moderator / super-admin | `is_super_admin()` (active join) — service/admin boundary only |

**Manager role:** not retained unless product explicitly adds it.

---

## 2. Capability matrix (foundation + gated futures)

Legend: **Y** = allow when implemented; **N** = deny; **RPC** = only via SECURITY DEFINER RPC; **OPEN** = product decision required; **—** = not applicable.

| Capability | Anon | Auth active | Owner | Captain | Co-captain | Member | Suspended | Super-admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| View public directory/detail | Y | Y | Y | Y | Y | Y | Y | Y |
| View private team fields | N | N | Y | Y | N* | N* | N | admin path |
| View roster identities | N | N | OPEN | OPEN | OPEN | OPEN | N | admin path |
| Create team | N | Y† | — | — | — | — | N | N‡ |
| Become initial owner | — | auto on create | — | — | — | — | — | — |
| Edit public team profile fields | N | N | Y | Y (proposed) | N | N | N | N‡ |
| Toggle recruiting / visibility | N | N | Y | Y (proposed) | N | N | N | N‡ |
| Change slug / game_key | N | N | N | N | N | N | N | N |
| Direct UPDATE owner_user_id | N | N | N | N | N | N | N | N |
| Appoint / revoke captain | N | N | RPC OPEN | N | N | N | N | N‡ |
| Add member (invite/accept) | N | N | RPC OPEN | RPC OPEN | N | N | N | N |
| Remove member | N | N | RPC OPEN | RPC OPEN | N | N | N | N |
| Self-leave | N | N | special§ | RPC OPEN | RPC OPEN | RPC OPEN | N | N |
| Transfer ownership | N | N | RPC OPEN | N | N | accept OPEN | N | OPEN |
| Delete / archive team | N | N | RPC OPEN | N | N | N | N | OPEN |
| Direct `team_members` INSERT | N | N | N | N | N | N | N | service only |
| Self-promote to captain/owner | N | N | N | N | N | N | N | N |
| Mutate another team's membership | N | N | N | N | N | N | N | N |
| Publish recruitment / decide apps | N | N | OPEN P3 | OPEN P3 | N | N | N | N |

\* Default-deny teammate roster privacy until D1-D12 visibility line approved.  
† Create also **OPEN** on email-verification requirement (see §4).  
‡ Super-admin is not a substitute team operator in D1; moderation uses separate admin surfaces.  
§ Owner self-leave only via transfer-first or archive rules — never last-owner abandonment.

---

## 3. Decision answers (proposed vs open)

| Question | Proposed answer | Status |
| --- | --- | --- |
| Who creates a team? | Active authenticated player | Proposed |
| Who becomes initial owner? | Creator (`auth.uid()` → `owner_user_id` + `created_by`) | Proposed |
| Can ownership transfer? | Yes, dedicated RPC: owner initiates → active member accepts → audit | **OPEN (D1-D10)** |
| Can owner appoint captains? | Yes, owner-only RPC | **OPEN (D1-D3)** |
| Can captains add/remove members? | Yes after invite/accept or remove RPC approved | **OPEN (D1-D3 + D1-D12)** |
| Can members leave? | Yes via self-leave RPC when approved | **OPEN** |
| Can owner remove themselves? | Only after successful transfer or team archive | **OPEN (D1-D10)** |
| Last owner leaves? | **Denied** — constraint/RPC error; no orphan teams | Proposed hard rule |
| Multiple teams per player? | Unlimited active memberships | **OPEN (D1-D1)** recommended unlimited |
| Roles in multiple teams? | Yes if multi-membership allowed | Depends on D1-D1 |
| Suspended users mutate? | **No** | Proposed hard rule |
| Unverified email create teams? | Default **deny create** until product says otherwise | **OPEN** |
| Public profiles before verification? | Public discovery uses `is_public` only; no “verified team” badge | Proposed (D1-D7 defer) |

---

## 4. Hard security rules

1. **Session identity exclusive** — all RPCs read `auth.uid()`; reject parameters that claim `user_id` / `owner_user_id` for authorization.
2. **Default deny** — missing policy = no access; no broad table grants for membership writes.
3. **No self-promotion** — members cannot UPDATE their own `role` to captain/owner.
4. **No cross-team manipulation** — every membership RPC takes `team_id` and re-checks caller authority on that team inside the transaction.
5. **No privilege escalation via RPC params** — role/status inputs validated against allowlists; ownership fields not client-writable.
6. **Last-owner protection** — forbid transfer/leave/delete that would leave zero owners.
7. **Duplicate active membership** — unique active membership per `(team_id, user_id)` (partial unique if historical rows retained).
8. **Concurrency** — membership mutations use row locks / unique constraints; accept RPCs idempotent on PK.
9. **Owner lockout prevention** — immutable ownership columns on direct UPDATE; transfer RPC only path.
10. **Private field non-disclosure** — public RPCs return frozen column lists only; private/missing slugs are 404-equivalent.

---

## 5. Transaction boundaries (required)

### Create team (when enabled)

Single transaction:

1. Assert `auth.uid()` present and `app_users.status = active` (+ email rule if approved).
2. Insert `teams` with `owner_user_id = created_by = auth.uid()`.
3. Optionally insert active captain roster row for creator (**OPEN** whether roster row is mandatory).
4. Insert audit event `team.created`.
5. Return public-safe `{ id, slug }` only.

### Ownership transfer (when approved)

1. Assert caller is current owner and active.
2. Assert target is active member of same team (and active account).
3. Lock team row.
4. Update `owner_user_id`; adjust roster roles per matrix.
5. Audit both parties.
6. Fail if target invalid — no partial transfer.

### Membership remove / leave

1. Assert authority (or self).
2. Deny if target is sole owner.
3. Set `membership_status` terminal + `left_at`.
4. Audit.
5. Re-check captain helpers see updated state immediately (statement-scoped).

---

## 6. Threat analysis (summary)

| Threat | Mitigation |
| --- | --- |
| IDOR on team settings | RLS + session checks; team id from trusted membership list |
| Forge `owner_user_id` on insert | WITH CHECK `owner_user_id = auth.uid()` + reject body fields in Zod |
| Captain INSERT arbitrary members | REVOKE INSERT; RPC-only after approval |
| Application decision forgery | Withdraw-only + decided_* null on insert (historical F-T02 / F-NEW-01) |
| Search injection / over-fetch | LIKE escape; limit/offset clamps |
| Existence oracle | Private/missing → identical not-found |
| Suspended admin | `is_super_admin` active join |
| Enumeration of applicants | No public applicant projection; captain-scoped reads only when built |

Full RPC/RLS contract: `07-rpc-and-rls-security-contract.md`.
