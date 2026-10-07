# Super Admin Bootstrap — First Admin

> Do not hardcode emails, do not use env allowlist, do not auto-promote first user.
> Bootstrap is via controlled SQL using service_role / Supabase SQL editor.

## Prerequisites

- Supabase project access (SQL editor or `psql` with service_role).
- Known user UUID of the intended first Super Admin (from `auth.users` or `profiles.id`).

## Step 1 — Identify user UUID

```sql
select id, email, display_name
from auth.users
where email = 'operator@micronest.example'; -- replace with real ops email, query only

-- or
select id, email from public.profiles where email = 'operator@micronest.example';
```

Use the returned `id` (UUID).

## Step 2 — Insert into platform_admins

Run as service_role (Supabase SQL editor is service_role):

```sql
insert into public.platform_admins (user_id, granted_by, reason)
values (
  '00000000-0000-0000-0000-000000000000', -- replace with real user UUID
  '00000000-0000-0000-0000-000000000000', -- same UUID for self-grant, or null
  'bootstrap: initial platform operator'
)
on conflict (user_id) do nothing;
```

`granted_by` may be same as `user_id` for bootstrap, or `null` if granted by system.

## Step 3 — Verify

```sql
select user_id, granted_at, reason from public.platform_admins;

select public.is_super_admin(); -- when run as that user (via authenticated JWT), returns true
```

Application verification (as that user, logged in):

- `GET /admin` should not redirect to login.
- `select * from admin_audit_logs` should succeed (policy uses `is_super_admin()`).
- Non-admin user should receive 403 and cannot read `platform_admins` or `admin_audit_logs`.

## Future grants

After bootstrap, Super Admins can grant others via future admin UI which calls a service_role RPC that inserts into `platform_admins` and writes `admin_audit_logs` with `action=platform_admin.grant` (UI not in this phase).

Do not insert production UUIDs into source control.
