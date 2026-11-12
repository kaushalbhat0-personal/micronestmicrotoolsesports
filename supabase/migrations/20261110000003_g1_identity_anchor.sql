-- MicroNest Esports G1-1: application identity anchor (D-G1-01, D-G1-02).
--
-- Scope (APPROVED D-G1-01 lazy bootstrap / D-G1-02 account ownership):
--   1. public.app_users identity anchor, 1:1 with auth.users(id).
--   2. Same-transaction lazy bootstrap via SECURITY INVOKER function
--      public.ensure_app_user() (INSERT ... ON CONFLICT DO NOTHING + re-select).
--   3. RLS: owner SELECT + bootstrap INSERT only. No owner UPDATE, no owner
--      DELETE, no anonymous access, no public access.
--   4. Explicit grants (no owner UPDATE grant per D-G1-02).
--
-- Explicitly NOT included (later stages own them; see 09-implementation-plan):
--   - player_profiles, player_game_profiles, games (G1-2/G1-3).
--   - Public projection RPCs (G1-4 owns them; D-G1-03).
--   - No SECURITY DEFINER helpers (05 §6 forbids extra definers in G1).
--   - No trigger in the auth schema (D-G1-01 rejects handle_new_user pattern).
--   - No public discovery policies. No seed data.
--
-- Why an INVOKER function instead of two PostgREST calls (02 §2–§3):
--   Two sequential PostgREST requests cannot share one transaction, so the
--   approved "INSERT + re-select in the same transaction" cannot be expressed
--   from the client library. This function encapsulates exactly the two
--   approved steps atomically (one RPC = one statement = one transaction).
--   SECURITY INVOKER adds zero privilege: caller RLS policies still apply,
--   identity comes only from auth.uid(), no identity parameter is accepted.

-- 1. Identity anchor ------------------------------------------------------
create table public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  suspended_at timestamptz null,
  suspension_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'suspended') = (suspended_at is not null))
);

comment on table public.app_users is
  'G1-1 application identity anchor: id IS auth.users(id). See docs/architecture/g1-identity-player-profile/02.';

-- Foundation reuse: single canonical updated_at trigger.
create trigger trg_app_users_updated_at
before update on public.app_users
for each row execute function public.handle_updated_at();

-- 2. Same-transaction lazy bootstrap --------------------------------------
-- Least privilege: SECURITY INVOKER (default made explicit, matching the
-- foundation helper style). Runs with the caller's RLS; the WITH CHECK
-- policy below still constrains the INSERT. Returns the caller's own row
-- only (RLS SELECT policy). suspension_reason is deliberately NOT returned:
-- minimal safe application identity.
create or replace function public.ensure_app_user()
returns table (
  id uuid,
  status text,
  suspended_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
volatile
security invoker
set search_path = ''
as $$
  insert into public.app_users (id)
  values (auth.uid())
  on conflict (id) do nothing;
  select a.id, a.status, a.suspended_at, a.created_at, a.updated_at
  from public.app_users as a
  where a.id = auth.uid();
$$;

-- Trigger/function executability follows the foundation posture: revoke from
-- every API-facing role, then grant the least privilege required.
revoke all on function public.ensure_app_user() from public;
revoke all on function public.ensure_app_user() from anon;
grant execute on function public.ensure_app_user() to authenticated;

-- 3. Row Level Security ----------------------------------------------------
alter table public.app_users enable row level security;

-- Owner reads own row only (reads stay allowed when suspended: appeal/export).
create policy "app_users owner select"
on public.app_users for select to authenticated
using (id = auth.uid());

-- Owner bootstraps own row only (WITH CHECK binds the inserted id).
create policy "app_users owner insert"
on public.app_users for insert to authenticated
with check (id = auth.uid());

-- APPROVED D-G1-02: no owner UPDATE policy and no owner DELETE policy.
-- Deletion runs through the authorized server flow (service-role), never RLS.
-- No anon policies on any operation: anonymous callers reach nothing.

-- 4. Explicit grants (foundation lineage: never depend on implicit grants) --
-- No owner UPDATE grant per D-G1-02; RLS still enforces row ownership below.
grant select, insert, delete on table public.app_users to authenticated;
revoke all on table public.app_users from public;
revoke all on table public.app_users from anon;
