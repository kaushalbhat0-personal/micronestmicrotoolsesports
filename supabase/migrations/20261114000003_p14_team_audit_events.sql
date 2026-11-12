-- P14-D3 append-only team_audit_events.
-- Depends on: 20261114000001_p14_teams_foundation, G1 app_users.

create table public.team_audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  actor_user_id uuid null references public.app_users (id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 80),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.team_audit_events is
  'P14 append-only team audit. Written only by SECURITY DEFINER mutation RPCs. No client access.';

create index team_audit_events_team_created_idx
  on public.team_audit_events (team_id, created_at desc);

create or replace function public.prevent_team_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'team_audit_events is append-only';
  return null;
end;
$$;

revoke all on function public.prevent_team_audit_mutation() from public;
revoke all on function public.prevent_team_audit_mutation() from anon;
revoke all on function public.prevent_team_audit_mutation() from authenticated;

create trigger trg_team_audit_no_update_delete
before update or delete on public.team_audit_events
for each row execute function public.prevent_team_audit_mutation();

alter table public.team_audit_events enable row level security;

revoke all on table public.team_audit_events from public;
revoke all on table public.team_audit_events from anon;
revoke all on table public.team_audit_events from authenticated;
-- No policies: default deny for anon/authenticated.
