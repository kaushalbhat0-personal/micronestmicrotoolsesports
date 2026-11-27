# 07 — C1D reviewer operations audit

**Audit date:** 2026-11-28  
**Scope:** Esports Supabase `knniommcyyhbyiwljisk` (`micronestmicrotoolsesports`) only  
**Method:** Code + prior P15-E2E docs + **live read-only count query** (no grants, no DML)

## Live readiness snapshot (read-only)

| Metric | Live value |
| --- | --- |
| `platform_admins` row count | **0** |
| Active super-admins (`platform_admins` ∩ `app_users.status = 'active'`) | **0** |
| Cases `pending_review` | **0** |
| Cases `approved` / `rejected` / `id_mismatch` | **0 / 0 / 0** |

**Interpretation:** Engineering review path is implemented and test-proven. **No durable operator reviewer exists.** Real ownership submissions cannot be processed by a human until an authorized grant is performed.

## Authorization model (verified in code)

| Primitive | Role | Evidence |
| --- | --- | --- |
| `platform_admins` | Membership; `user_id` = `app_users.id` | Migrations + P15-E2E `01-admin-readiness.md` |
| `is_super_admin()` | `SECURITY DEFINER`; membership ∩ active `app_users` | RPC + `require-super-admin.ts` |
| App gate | `requireSuperAdmin` → `getUser()` then `rpc('is_super_admin')` | `src/lib/auth/require-super-admin.ts` |
| Queue page | `/workspace/moderation/bgmi-ownership` | `requireSuperAdmin` before render |
| Decide / list RPCs | Re-check `is_super_admin()` + `auth.uid()` | M2B.4 migrations |
| Self-review ban | Cannot decide own case | RPC + decisions CHECK |

**No email-auto-grant.** Intended reviewer identity is **not** hardcoded in repo or `.env` (correct).

## Queue, evidence, decide, audit

| Capability | Status | Notes |
| --- | --- | --- |
| Pending queue (`list_pending_bgmi_ownership_cases`) | Implemented | Page loads up to 50 pending cases |
| Evidence metadata for review | Implemented | Content-type / dimensions; Storage path not exposed in public UI |
| Signed URL mint for reviewers | Implemented | TTL **60s** (`BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS`); server action after `requireSuperAdmin` |
| Approve / reject | Implemented | RPC-only; row lock; approve requires live ID = claimed ID |
| Internal reason + player-facing reject message | Implemented | Internal notes never on public reader |
| `admin_audit_logs` | Implemented | Actions `bgmi_ownership.approve` / `bgmi_ownership.reject` |
| ID mismatch | Implemented | Flags case; approve blocked; badge clears when live ID diverges |
| Rejection → resubmit | Implemented via withdraw lifecycle | Player withdraws / restarts case; evidence cleaned through withdraw path |
| Ordinary user access | Denied | Integration + static tests |

## Intended reviewer account

| Question | Finding |
| --- | --- |
| Does an intended reviewer account exist in Auth/`app_users`? | **Unknown from repo** — not named in configuration (by design) |
| Does it have super-admin access? | **No durable grant** — live `platform_admin_count = 0` |
| Can it open the queue / mint evidence URLs? | **Not until grant** — every real session denied by `is_super_admin()` |
| Does approve/reject lifecycle work? | **Yes in ephemeral tests**; not operable for production operators today |

Ephemeral integration tests insert a temporary `platform_admins` row and delete it in `afterAll`. That is **not** an operator grant.

## Operational steps remaining (owner-run — do not auto-provision)

1. Choose intended reviewer(s); ensure each has signed up on **Esports** Auth with `app_users.status = 'active'`.
2. Resolve each `app_users.id` via dashboard/SQL **without** pasting passwords into chat/repo.
3. Authorized insert (service-role / SQL editor), Esports only:

```sql
insert into public.platform_admins (user_id, granted_by, reason)
values (
  '<intended-operator-app-users-id>'::uuid,
  null,
  'C1D durable super-admin for BGMI ownership review'
);
```

4. As that user: `select public.is_super_admin();` → must be `true`.
5. Open `/workspace/moderation/bgmi-ownership` while signed in.
6. Dry-run: submit a throwaway pending case → mint preview URL → reject with player-facing message → confirm player UI → withdraw/resubmit path → approve a second case → confirm public badge + registry eligibility.
7. Document on-call reviewer rotation + SLA (see `10-c1d-campaign-operations.md`).

## Explicit non-actions this audit

- Did **not** insert any `platform_admins` row.
- Did **not** print emails, UUIDs, tokens, or signed URLs.
- Did **not** access LMS Supabase.

## Provisioning attempt #1 (2026-11-28) — stopped

Target email had **0** Auth matches. No insert. Owner signed up afterward.

## Provisioning attempt #2 (authorized, 2026-11-28) — **PASS**

| Check | Result |
| --- | --- |
| Linked project | `knniommcyyhbyiwljisk` confirmed |
| Target email | `kaushalbhat0@gmail.com` |
| Auth + `app_users` | Exactly **1** match; `status=active`; ids aligned |
| UUID (membership key) | `2116126e-517d-43b3-9375-185bcd819d27` |
| Operation | `insert into public.platform_admins (user_id, granted_by, reason)` for **that UUID only** |
| `granted_by` | `null` |
| `reason` | `C1D durable super-admin grant for BGMI ownership review` |
| Password | Not used / not printed (session via admin magic-link token hash → `verifyOtp`) |
| Live counts after grant | `platform_admins=1`, `active_super_admin_count=1` |
| `is_super_admin()` under target session | **true** |
| `list_pending_bgmi_ownership_cases` under target session | OK · pending_count **0** |
| Anon `is_super_admin()` | Denied (`permission denied` / not true) |
| Approve/reject / badge / registry E2E | **Not exercised** — no pending production cases; fabrication forbidden |

## Ops verdict (this area)

**READY for reviewer staffing.** Queue is empty; process real submissions when they arrive. Create/share remain ungated.
