-- P14-D3 teams foundation (local only — NOT applied remotely in this phase).
-- Contract: docs/product-development/P14-D2-teams/04-schema-and-rpc-contract.md
-- Depends on: G1 app_users, games, handle_updated_at. No archived D1 teams SQL.

create table public.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  name text not null check (char_length(name) between 2 and 60),
  description text null check (description is null or char_length(description) <= 1000),
  game_key text not null references public.games (key) on delete restrict,
  region_code text not null
    check (region_code in (
      'india','asia','europe','north-america','south-america','middle-east','online'
    )),
  current_level text not null
    check (current_level in (
      'casual','community','competitive','higher-tier','semi-pro','professional'
    )),
  target_level text not null
    check (target_level in (
      'casual','community','competitive','higher-tier','semi-pro','professional'
    )),
  recruiting boolean not null default true,
  is_public boolean not null default true,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active','archived')),
  owner_user_id uuid not null references public.app_users (id) on delete restrict,
  created_by uuid not null references public.app_users (id) on delete restrict,
  organization_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.teams is
  'P14 teams: one game per team. owner_user_id is authoritative (A4). organization_id inert (never RLS).';

create index teams_game_region_idx on public.teams (game_key, region_code);
create index teams_owner_user_id_idx on public.teams (owner_user_id);
create index teams_public_active_created_idx
  on public.teams (is_public, lifecycle_status, created_at desc)
  where is_public = true and lifecycle_status = 'active';

create trigger trg_teams_updated_at
before update on public.teams
for each row execute function public.handle_updated_at();

create or replace function public.enforce_teams_immutable_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    NEW.slug is distinct from OLD.slug
    or NEW.game_key is distinct from OLD.game_key
    or NEW.owner_user_id is distinct from OLD.owner_user_id
    or NEW.created_by is distinct from OLD.created_by
    or NEW.organization_id is distinct from OLD.organization_id
  ) then
    raise exception 'teams protected columns are immutable';
  end if;
  return NEW;
end;
$$;

revoke all on function public.enforce_teams_immutable_columns() from public;
revoke all on function public.enforce_teams_immutable_columns() from anon;
revoke all on function public.enforce_teams_immutable_columns() from authenticated;

create trigger trg_teams_immutable_columns
before update on public.teams
for each row execute function public.enforce_teams_immutable_columns();

alter table public.teams enable row level security;

revoke all on table public.teams from public;
revoke all on table public.teams from anon;
revoke all on table public.teams from authenticated;
-- SELECT granted after helpers exist (team_members migration). No INSERT/UPDATE/DELETE to clients.
