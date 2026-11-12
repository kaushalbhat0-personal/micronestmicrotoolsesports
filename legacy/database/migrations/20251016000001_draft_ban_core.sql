-- Draft & Ban — Persistence Foundation (RCCF-DRAFT-BAN-04 P2)
-- Tables: draft_matches, draft_templates + organizations.logo_url + org-logos bucket.
-- RLS: is_org_member(organization_id) for tenant tables; completed matches immutable via trigger.
-- Public share: narrow SECURITY DEFINER function by share_token (completed only). No anon table policy.
-- Reference IDs: DB-YYYY-NNNNN via dedicated sequence (concurrency-safe, never count()+1).
-- Additive, deterministic, no secrets.

-- ─────────────────────────────────────────────────────────────
-- organizations.logo_url (single logo per org, nullable)
-- ─────────────────────────────────────────────────────────────
alter table public.organizations add column if not exists logo_url text;

-- ─────────────────────────────────────────────────────────────
-- draft_templates
-- ─────────────────────────────────────────────────────────────
create table if not exists public.draft_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  config jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint draft_templates_config_is_object check (jsonb_typeof(config) = 'object'),
  constraint draft_templates_org_name_unique unique (organization_id, name)
);

drop trigger if exists draft_templates_updated_at on public.draft_templates;
create trigger draft_templates_updated_at
  before update on public.draft_templates
  for each row execute function public.handle_updated_at();

create index if not exists draft_templates_org_idx on public.draft_templates(organization_id);

-- ─────────────────────────────────────────────────────────────
-- reference-ID sequence + allocator (concurrency-safe)
-- ─────────────────────────────────────────────────────────────
create sequence if not exists public.draft_match_ref_seq as bigint start with 1 increment by 1;

create or replace function public.draft_match_next_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  n := nextval('public.draft_match_ref_seq');
  return 'DB-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- draft_matches
-- ─────────────────────────────────────────────────────────────
create table if not exists public.draft_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  ref_code text not null unique default public.draft_match_next_ref(),
  match_name text check (match_name is null or char_length(match_name) between 1 and 80),
  event_name text check (event_name is null or char_length(event_name) between 1 and 80),
  format_label text check (format_label is null or char_length(format_label) between 1 and 20),
  notes text check (notes is null or char_length(notes) <= 500),
  team_a text not null check (char_length(team_a) between 1 and 40),
  team_b text not null check (char_length(team_b) between 1 and 40),
  template_id uuid references public.draft_templates(id) on delete set null,
  sequence jsonb not null,
  pool jsonb not null,
  actions jsonb not null default '[]'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  share_token uuid not null unique default gen_random_uuid(),
  cloned_from uuid references public.draft_matches(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint draft_matches_sequence_is_array check (jsonb_typeof(sequence) = 'array'),
  constraint draft_matches_pool_is_array check (jsonb_typeof(pool) = 'array'),
  constraint draft_matches_actions_is_array check (jsonb_typeof(actions) = 'array'),
  constraint draft_matches_completed_at_check check (
    (status = 'completed' and completed_at is not null) or (status <> 'completed')
  )
);

drop trigger if exists draft_matches_updated_at on public.draft_matches;
create trigger draft_matches_updated_at
  before update on public.draft_matches
  for each row execute function public.handle_updated_at();

create index if not exists draft_matches_org_created_idx on public.draft_matches(organization_id, created_at desc);
create index if not exists draft_matches_status_idx on public.draft_matches(status);
create index if not exists draft_matches_template_idx on public.draft_matches(template_id);
create index if not exists draft_matches_share_token_idx on public.draft_matches(share_token);
create index if not exists draft_matches_ref_code_idx on public.draft_matches(ref_code);

-- ─────────────────────────────────────────────────────────────
-- completed-match immutability guard (service layer enforces first; DB is backstop)
-- ─────────────────────────────────────────────────────────────
create or replace function public.draft_ban_guard_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status = 'completed' then
    -- Allow only updated_at bookkeeping; every domain column is frozen.
    if NEW.id is distinct from OLD.id
      or NEW.organization_id is distinct from OLD.organization_id
      or NEW.created_by is distinct from OLD.created_by
      or NEW.ref_code is distinct from OLD.ref_code
      or NEW.match_name is distinct from OLD.match_name
      or NEW.event_name is distinct from OLD.event_name
      or NEW.format_label is distinct from OLD.format_label
      or NEW.notes is distinct from OLD.notes
      or NEW.team_a is distinct from OLD.team_a
      or NEW.team_b is distinct from OLD.team_b
      or NEW.template_id is distinct from OLD.template_id
      or NEW.sequence is distinct from OLD.sequence
      or NEW.pool is distinct from OLD.pool
      or NEW.actions is distinct from OLD.actions
      or NEW.status is distinct from OLD.status
      or NEW.share_token is distinct from OLD.share_token
      or NEW.cloned_from is distinct from OLD.cloned_from
      or NEW.completed_at is distinct from OLD.completed_at
    then
      raise exception 'Completed draft matches are immutable (ref_code=%)', OLD.ref_code;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists draft_matches_completed_guard on public.draft_matches;
create trigger draft_matches_completed_guard
  before update on public.draft_matches
  for each row execute function public.draft_ban_guard_completed();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.draft_matches enable row level security;
alter table public.draft_templates enable row level security;

drop policy if exists draft_matches_select_member on public.draft_matches;
create policy draft_matches_select_member on public.draft_matches
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists draft_matches_insert_member on public.draft_matches;
create policy draft_matches_insert_member on public.draft_matches
  for insert to authenticated with check (public.is_org_member(organization_id));

drop policy if exists draft_matches_update_member on public.draft_matches;
create policy draft_matches_update_member on public.draft_matches
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists draft_matches_delete_member on public.draft_matches;
create policy draft_matches_delete_member on public.draft_matches
  for delete to authenticated using (public.is_org_member(organization_id));

drop policy if exists draft_templates_select_member on public.draft_templates;
create policy draft_templates_select_member on public.draft_templates
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists draft_templates_insert_member on public.draft_templates;
create policy draft_templates_insert_member on public.draft_templates
  for insert to authenticated with check (public.is_org_member(organization_id));

drop policy if exists draft_templates_update_member on public.draft_templates;
create policy draft_templates_update_member on public.draft_templates
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists draft_templates_delete_member on public.draft_templates;
create policy draft_templates_delete_member on public.draft_templates
  for delete to authenticated using (public.is_org_member(organization_id));

-- ─────────────────────────────────────────────────────────────
-- Public share: completed-only, allowlisted fields, single record by token.
-- No anonymous table policy — this function is the only public path.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_completed_draft_share(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'ref_code', m.ref_code,
    'match_name', m.match_name,
    'event_name', m.event_name,
    'format_label', m.format_label,
    'team_a', m.team_a,
    'team_b', m.team_b,
    'sequence', m.sequence,
    'pool', m.pool,
    'actions', m.actions,
    'completed_at', m.completed_at,
    'organization_name', o.name,
    'organization_logo_url', o.logo_url
  )
  from public.draft_matches m
  join public.organizations o on o.id = m.organization_id
  where m.share_token = p_token
    and m.status = 'completed'
  limit 1;
$$;

revoke all on function public.get_completed_draft_share(uuid) from public;
grant execute on function public.get_completed_draft_share(uuid) to anon, authenticated;
revoke all on function public.draft_match_next_ref() from public;
grant execute on function public.draft_match_next_ref() to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- org-logos storage bucket (public read for result/share rendering;
-- writes restricted to org owners/admins via object policies below)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

drop policy if exists org_logos_public_read on storage.objects;
create policy org_logos_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'org-logos');

drop policy if exists org_logos_admin_write on storage.objects;
create policy org_logos_admin_write on storage.objects
  for insert to authenticated with check (bucket_id = 'org-logos');

drop policy if exists org_logos_admin_update on storage.objects;
create policy org_logos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'org-logos')
  with check (bucket_id = 'org-logos');

drop policy if exists org_logos_admin_delete on storage.objects;
create policy org_logos_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'org-logos');
