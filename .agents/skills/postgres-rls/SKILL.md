---
name: postgres-rls
description: "Must be loaded BEFORE any schema, index, RLS policy, function, or tenant-isolation change. Covers query performance, schema design, RLS, and diagnostics for Postgres 15 + Supabase."
---

# Postgres + RLS — Supabase Best Practices

**When to use:** Any DB change: schema, indexes, migrations, RLS policies, `SECURITY DEFINER` functions, tenant isolation, query optimization. **Load before** touching `supabase/migrations/` or `src/server/repositories/`.

**When not to use:** UI-only changes with no DB.

**Source:** Adapted from Supabase Agent Skills — https://github.com/supabase/agent-skills (`supabase-postgres-best-practices` skill, MIT). Project DB: Postgres `15` (`supabase/config.toml:1`).

## Rules

**Rule: Tenant isolation is RLS, not app filtering**
Why: DB is last line.
Good: Every tenant table (`organizations`, `organization_members`, `tool_entitlements`, etc.) `enable row level security` + policy `using (is_org_member(organization_id))` `supabase/migrations/20250930000002_rls.sql:1`. Helpers `is_org_member`/`has_tool_access` are `SECURITY DEFINER` with `set search_path=public`, `stable`, granted to `authenticated` only.
Bad: `SELECT * FROM organizations` without RLS + filtering in `DashboardPage` — IDOR.

**Rule: Functions — constrained SECURITY DEFINER**
Why: Privilege escalation.
Good: `create or replace function public.is_org_member(org_id uuid) returns boolean language sql security definer set search_path=public stable as $$ ... $$; grant execute on function ... to authenticated;` `supabase/migrations/20250930000002_rls.sql:12`.
Bad: `SECURITY DEFINER` on view/table, or `search_path` not set — search_path hijack.

**Rule: Schema — explicit, small**
Why: Performance + clarity.
Good: `create table public.my_table (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, created_at timestamptz not null default now()); create index my_table_org_idx on my_table(organization_id);` `ARCHITECTURE.md` §17.
Bad: Missing `on delete cascade`, missing index on `organization_id` for 1000+ orgs, `text` without check for `slug ^[a-z0-9]+(-[a-z0-9]+)*$` `supabase/migrations/20250930000001_initial_schema.sql:1`.

**Rule: Indexes — for tenant queries**
Why: `is_org_member` checks per row.
Good: `create index organizations_slug_idx on organizations(slug); create index tool_entitlements_org_idx ...;` Partial indexes for `is_all_access` `supabase/migrations/20250930000001_initial_schema.sql:1`.
Bad: No index on `organization_members(organization_id, user_id)` unique — full scan.

**Rule: Diagnostics before optimization**
Why: Avoid premature.
Good: `explain analyze select ... where organization_id = ...;` via `npx supabase` SQL. Check `pg_stat_user_tables` for seq scans before adding index.
Bad: Adding 5 indexes speculative before `explain`.

## Checklist (load this skill first)

- [ ] Every new table has `organization_id uuid not null` + `enable row level security` + `is_org_member` policy in same migration?
- [ ] `SECURITY DEFINER` only on narrow helper, `search_path=public`, `stable`, least privilege grant?
- [ ] Indexes on `organization_id` / `slug` / FKs, unique where needed?
- [ ] Tested with `supabase db reset` and as `authenticated` vs `anon` vs `service_role`?

See `supabase/migrations/`, `ARCHITECTURE.md` §6/§7/§17.
