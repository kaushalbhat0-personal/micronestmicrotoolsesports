# 01 — Admin readiness

## Live Esports project check (`knniommcyyhbyiwljisk`)

| Check | Result |
| --- | --- |
| `platform_admins` row count | **0** |
| Active super-admins (`platform_admins` ∩ `app_users.status=active`) | **0** |
| `is_super_admin()` present | Yes |
| Decide / public-reader RPCs present | Yes |
| Intended operator email hardcoded in repo / `.env` | **No** (correct) |

## Interpretation

There is **no durable reviewer membership**. `requireSuperAdmin` and `is_super_admin()` will deny every real session until an authorized grant is performed.

Ephemeral M2B.4 integration tests insert a temporary `platform_admins` row for a test reviewer JWT and delete it in `afterAll`. That is **not** an operator grant.

## Authorized provisioning (operator-run; do not email-auto-grant)

1. Operator signs up / signs in on Esports Auth so `auth.users` + `app_users` exist and `app_users.status = 'active'`.
2. Resolve that user’s `app_users.id` (UUID) via the Supabase dashboard Auth → Users or SQL (operator-owned session), **without pasting passwords into the repo**.
3. Authorized SQL (service-role / SQL editor), Esports project only:

```sql
insert into public.platform_admins (user_id, granted_by, reason)
values (
  '<intended-operator-app-users-id>'::uuid,
  null, -- or grantor app_users.id
  'P15-E2E durable super-admin grant for BGMI ownership review'
);
```

4. Verify with the operator’s authenticated session (not service-role):

```sql
select public.is_super_admin(); -- must be true under operator JWT
```

5. Open `/workspace/moderation/bgmi-ownership` while signed in as that account.

## Explicit non-actions this acceptance

- Did **not** insert any durable `platform_admins` row for an operator email.
- Did **not** ask for or store a password.
