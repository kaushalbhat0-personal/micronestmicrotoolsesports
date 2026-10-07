-- Tie-Breaker Resolver — Persistence Foundation (RCCF-TIEBREAKER-04)
-- Tables: tie_breaker_competitions, tie_breaker_teams, tie_breaker_results.
-- RLS: is_org_member(organization_id) for all tenant tables (Draft & Ban pattern).
-- Locked records immutable via triggers (parent + children check lock status).
-- Record numbers: TB-YYYY-NNNNN via dedicated sequence (concurrency-safe, never count()+1).
-- Public share: narrow SECURITY DEFINER function by share_token (locked only). No anon table policy.
-- Live standings are DERIVED by the pure engine; only locked_snapshot jsonb is stored (at lock).
-- Additive, deterministic, no secrets.

-- ─────────────────────────────────────────────────────────────
-- tie_breaker_competitions
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tie_breaker_competitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  status text not null default 'draft' check (status in ('draft', 'active', 'locked')),
  scoring_win smallint not null default 3 check (scoring_win between 0 and 10),
  scoring_draw smallint not null default 1 check (scoring_draw between 0 and 10),
  scoring_loss smallint not null default 0 check (scoring_loss between 0 and 10),
  draws_enabled boolean not null default false,
  round_label text not null default 'rounds' check (round_label in ('rounds', 'games')),
  rule_order text[] not null default array['points']::text[],
  preset_ref text check (preset_ref is null or preset_ref in ('round_robin', 'group_stage', 'swiss_lite')),
  share_token uuid not null unique default gen_random_uuid(),
  record_number text unique,
  locked_at timestamptz,
  locked_snapshot jsonb,
  cloned_from uuid references public.tie_breaker_competitions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tie_breaker_rule_order_length check (coalesce(array_length(rule_order, 1), 0) between 1 and 5),
  constraint tie_breaker_locked_fields_check check (
    (status = 'locked' and locked_at is not null and record_number is not null and locked_snapshot is not null)
    or (status <> 'locked')
  ),
  constraint tie_breaker_snapshot_is_object check (locked_snapshot is null or jsonb_typeof(locked_snapshot) = 'object')
);

drop trigger if exists tie_breaker_competitions_updated_at on public.tie_breaker_competitions;
create trigger tie_breaker_competitions_updated_at
  before update on public.tie_breaker_competitions
  for each row execute function public.handle_updated_at();

create index if not exists tie_breaker_competitions_org_created_idx on public.tie_breaker_competitions(organization_id, created_at desc);
create index if not exists tie_breaker_competitions_status_idx on public.tie_breaker_competitions(status);
create index if not exists tie_breaker_competitions_share_token_idx on public.tie_breaker_competitions(share_token);
create index if not exists tie_breaker_competitions_record_number_idx on public.tie_breaker_competitions(record_number);

-- ─────────────────────────────────────────────────────────────
-- tie_breaker_teams
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tie_breaker_teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.tie_breaker_competitions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  short_name text check (short_name is null or char_length(short_name) between 1 and 12),
  logo_url text check (logo_url is null or (logo_url like 'https://%' and char_length(logo_url) <= 500)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness within a competition (no CITEXT dependency).
create unique index if not exists tie_breaker_teams_competition_name_unique
  on public.tie_breaker_teams(competition_id, lower(name));

create index if not exists tie_breaker_teams_competition_idx on public.tie_breaker_teams(competition_id);
create index if not exists tie_breaker_teams_org_idx on public.tie_breaker_teams(organization_id);

drop trigger if exists tie_breaker_teams_updated_at on public.tie_breaker_teams;
create trigger tie_breaker_teams_updated_at
  before update on public.tie_breaker_teams
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────
-- tie_breaker_results
-- winner: 'team_a' | 'team_b' | 'draw'. NULL winner + is_complete=false rows
-- are stored but excluded from standings. No UNIQUE on team pairs:
-- rematches/legs are separate results; duplicates are a service warning.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tie_breaker_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.tie_breaker_competitions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_a_id uuid not null references public.tie_breaker_teams(id) on delete cascade,
  team_b_id uuid not null references public.tie_breaker_teams(id) on delete cascade,
  winner text check (winner is null or winner in ('team_a', 'team_b', 'draw')),
  maps_a smallint check (maps_a is null or maps_a >= 0),
  maps_b smallint check (maps_b is null or maps_b >= 0),
  rounds_a integer check (rounds_a is null or rounds_a >= 0),
  rounds_b integer check (rounds_b is null or rounds_b >= 0),
  played_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 500),
  is_complete boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tie_breaker_results_distinct_teams check (team_a_id <> team_b_id),
  constraint tie_breaker_results_complete_needs_winner check (is_complete = false or winner is not null)
);

create index if not exists tie_breaker_results_competition_idx on public.tie_breaker_results(competition_id, created_at);
create index if not exists tie_breaker_results_pair_idx on public.tie_breaker_results(competition_id, team_a_id, team_b_id);
create index if not exists tie_breaker_results_org_idx on public.tie_breaker_results(organization_id);

drop trigger if exists tie_breaker_results_updated_at on public.tie_breaker_results;
create trigger tie_breaker_results_updated_at
  before update on public.tie_breaker_results
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────
-- reference-ID sequence + allocator (concurrency-safe, TB-YYYY-NNNNN)
-- Assigned at lock, not at creation. Gaps from failed locks are acceptable.
-- ─────────────────────────────────────────────────────────────
create sequence if not exists public.tie_breaker_ref_seq as bigint start with 1 increment by 1;

create or replace function public.tie_breaker_next_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  n := nextval('public.tie_breaker_ref_seq');
  return 'TB-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
end;
$$;

revoke all on function public.tie_breaker_next_ref() from public;
grant execute on function public.tie_breaker_next_ref() to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- locked-record immutability guards (service layer enforces first; DB is backstop)
-- ─────────────────────────────────────────────────────────────
create or replace function public.tie_breaker_guard_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status = 'locked' then
    if NEW.id is distinct from OLD.id
      or NEW.organization_id is distinct from OLD.organization_id
      or NEW.created_by is distinct from OLD.created_by
      or NEW.name is distinct from OLD.name
      or NEW.description is distinct from OLD.description
      or NEW.status is distinct from OLD.status
      or NEW.scoring_win is distinct from OLD.scoring_win
      or NEW.scoring_draw is distinct from OLD.scoring_draw
      or NEW.scoring_loss is distinct from OLD.scoring_loss
      or NEW.draws_enabled is distinct from OLD.draws_enabled
      or NEW.round_label is distinct from OLD.round_label
      or NEW.rule_order is distinct from OLD.rule_order
      or NEW.preset_ref is distinct from OLD.preset_ref
      or NEW.share_token is distinct from OLD.share_token
      or NEW.record_number is distinct from OLD.record_number
      or NEW.locked_at is distinct from OLD.locked_at
      or NEW.locked_snapshot is distinct from OLD.locked_snapshot
      or NEW.cloned_from is distinct from OLD.cloned_from
    then
      raise exception 'Locked tie-breaker records are immutable (record_number=%)', OLD.record_number;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists tie_breaker_competitions_locked_guard on public.tie_breaker_competitions;
create trigger tie_breaker_competitions_locked_guard
  before update on public.tie_breaker_competitions
  for each row execute function public.tie_breaker_guard_locked();

-- Child rows inherit the lock: no team/result writes once the parent is locked.
create or replace function public.tie_breaker_guard_child_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_status text;
begin
  select status into parent_status
  from public.tie_breaker_competitions
  where id = coalesce(NEW.competition_id, OLD.competition_id);
  if parent_status = 'locked' then
    raise exception 'Locked tie-breaker records are immutable (competition=%)', coalesce(NEW.competition_id, OLD.competition_id);
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists tie_breaker_teams_locked_guard on public.tie_breaker_teams;
create trigger tie_breaker_teams_locked_guard
  before insert or update or delete on public.tie_breaker_teams
  for each row execute function public.tie_breaker_guard_child_locked();

drop trigger if exists tie_breaker_results_locked_guard on public.tie_breaker_results;
create trigger tie_breaker_results_locked_guard
  before insert or update or delete on public.tie_breaker_results
  for each row execute function public.tie_breaker_guard_child_locked();

-- ─────────────────────────────────────────────────────────────
-- RLS (organization-scoped, same model as Draft & Ban)
-- ─────────────────────────────────────────────────────────────
alter table public.tie_breaker_competitions enable row level security;
alter table public.tie_breaker_teams enable row level security;
alter table public.tie_breaker_results enable row level security;

drop policy if exists tie_breaker_competitions_select_member on public.tie_breaker_competitions;
create policy tie_breaker_competitions_select_member on public.tie_breaker_competitions
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists tie_breaker_competitions_insert_member on public.tie_breaker_competitions;
create policy tie_breaker_competitions_insert_member on public.tie_breaker_competitions
  for insert to authenticated with check (public.is_org_member(organization_id));

drop policy if exists tie_breaker_competitions_update_member on public.tie_breaker_competitions;
create policy tie_breaker_competitions_update_member on public.tie_breaker_competitions
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists tie_breaker_competitions_delete_member on public.tie_breaker_competitions;
create policy tie_breaker_competitions_delete_member on public.tie_breaker_competitions
  for delete to authenticated using (public.is_org_member(organization_id));

drop policy if exists tie_breaker_teams_select_member on public.tie_breaker_teams;
create policy tie_breaker_teams_select_member on public.tie_breaker_teams
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists tie_breaker_teams_insert_member on public.tie_breaker_teams;
create policy tie_breaker_teams_insert_member on public.tie_breaker_teams
  for insert to authenticated with check (public.is_org_member(organization_id));

drop policy if exists tie_breaker_teams_update_member on public.tie_breaker_teams;
create policy tie_breaker_teams_update_member on public.tie_breaker_teams
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists tie_breaker_teams_delete_member on public.tie_breaker_teams;
create policy tie_breaker_teams_delete_member on public.tie_breaker_teams
  for delete to authenticated using (public.is_org_member(organization_id));

drop policy if exists tie_breaker_results_select_member on public.tie_breaker_results;
create policy tie_breaker_results_select_member on public.tie_breaker_results
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists tie_breaker_results_insert_member on public.tie_breaker_results;
create policy tie_breaker_results_insert_member on public.tie_breaker_results
  for insert to authenticated with check (public.is_org_member(organization_id));

drop policy if exists tie_breaker_results_update_member on public.tie_breaker_results;
create policy tie_breaker_results_update_member on public.tie_breaker_results
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists tie_breaker_results_delete_member on public.tie_breaker_results;
create policy tie_breaker_results_delete_member on public.tie_breaker_results
  for delete to authenticated using (public.is_org_member(organization_id));

-- ─────────────────────────────────────────────────────────────
-- Public share: locked-only, allowlisted fields, single record by token.
-- Reads the frozen locked_snapshot — never live tables, never private notes,
-- never organization_id / created_by / internal IDs. No anonymous table policy.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_completed_tie_breaker_share(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'record_number', c.record_number,
    'competition_name', c.name,
    'description', c.description,
    'locked_at', c.locked_at,
    'rule_order', to_jsonb(c.rule_order),
    'scoring', jsonb_build_object(
      'win', c.scoring_win,
      'draw', c.scoring_draw,
      'loss', c.scoring_loss,
      'draws_enabled', c.draws_enabled,
      'round_label', c.round_label
    ),
    'snapshot', c.locked_snapshot,
    'organization_name', o.name,
    'organization_logo_url', o.logo_url
  )
  from public.tie_breaker_competitions c
  join public.organizations o on o.id = c.organization_id
  where c.share_token = p_token
    and c.status = 'locked'
  limit 1;
$$;

revoke all on function public.get_completed_tie_breaker_share(uuid) from public;
grant execute on function public.get_completed_tie_breaker_share(uuid) to anon, authenticated;
