-- P14-D3 team_members + authorization helpers.
-- Depends on: 20261114000001_p14_teams_foundation, G1 app_users.

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.app_users (id) on delete cascade,
  role text not null check (role in ('captain','co_captain','player','sub')),
  membership_status text not null
    check (membership_status in (
      'active','invited','applied','removed','left','suspended'
    )),
  game_role text null
    check (game_role is null or game_role in ('IGL','Assaulter','Support','Scout')),
  created_at timestamptz not null default now(),
  joined_at timestamptz null,
  left_at timestamptz null,
  primary key (team_id, user_id),
  check (
    (membership_status not in ('removed','left'))
    or (left_at is not null)
  ),
  check (
    (role not in ('captain','co_captain'))
    or (membership_status = 'active')
  )
);

comment on table public.team_members is
  'P14 membership: role separate from membership_status. Client DML denied; mutations via RPC only.';

create index team_members_user_id_idx on public.team_members (user_id);
create index team_members_team_active_idx
  on public.team_members (team_id)
  where membership_status = 'active';

create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams
    where id = p_team_id and owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_team_active_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
      and membership_status = 'active'
  );
$$;

-- A1 settings path: owner OR active role=captain. Co-captain never qualifies.
create or replace function public.is_team_captain(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_team_owner(p_team_id)
    or exists (
      select 1 from public.team_members
      where team_id = p_team_id
        and user_id = auth.uid()
        and membership_status = 'active'
        and role = 'captain'
    );
$$;

comment on function public.is_team_owner(uuid) is 'P14: caller owns team via teams.owner_user_id.';
comment on function public.is_team_active_member(uuid) is 'P14: caller has active membership row.';
comment on function public.is_team_captain(uuid) is
  'P14 A1: owner or active captain role. Co-captain has no admin rights.';

revoke all on function public.is_team_owner(uuid) from public;
revoke all on function public.is_team_active_member(uuid) from public;
revoke all on function public.is_team_captain(uuid) from public;
grant execute on function public.is_team_owner(uuid) to authenticated;
grant execute on function public.is_team_active_member(uuid) to authenticated;
grant execute on function public.is_team_captain(uuid) to authenticated;

alter table public.team_members enable row level security;

revoke all on table public.team_members from public;
revoke all on table public.team_members from anon;
revoke all on table public.team_members from authenticated;

grant select on table public.teams to authenticated;
grant select on table public.team_members to authenticated;

create policy "teams member or owner select"
on public.teams
for select
to authenticated
using (
  public.is_team_owner(id)
  or public.is_team_active_member(id)
);

create policy "team_members same-team select"
on public.team_members
for select
to authenticated
using (
  public.is_team_owner(team_id)
  or public.is_team_active_member(team_id)
);
