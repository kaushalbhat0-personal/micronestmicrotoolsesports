-- P9 tournament organizers (1/2): organizer registry + membership.
--
-- Status: LOCAL PROPOSAL ONLY — NOT applied remotely. Public reads resolve
-- through the masked RPC pair below (default-deny base tables, RPC-only
-- public access, least-privilege grants). This migration fulfills no P3
-- contract; the P3 tournament table lands in
-- 20261112000006_p9_tournament_link.
--
-- Scope:
--   1. public.organizers registry (slug immutable, type vocabulary, game
--      interests, self-declared links, trust state, visibility, session-
--      derived created_by, timestamps + handle_updated_at trigger).
--   2. public.organizer_members (organizer_id, user_id, role owner|admin|
--      editor; founding owner immutable via trigger; no transfer workflow).
--   3. Masked RPCs search_organizers / get_organizer_by_slug (8-column
--      contract + detail extras; is_public predicate; derived
--      published_tournament_count; LIKE escaping; limit/offset clamps;
--      anon+authenticated execute; base tables revoked from anon).
--   4. RLS: default-deny; owner/member-gated writes; no public base reads.
--
-- Explicitly NOT included:
--   - Logo/media columns (no accepted organizer media contract; storage
--     bucket reservation only — see media-and-verification-policy.md).
--   - Organization↔organizer linkage column (pending the unresolved
--     ownership/consent decision; organization_slug resolves only from an
--     approved future linkage, else null).
--   - Verification transitions/evidence (disabled; trust_state default
--     not_submitted, no privileged writer).
--   - Ownership transfer (no workflow; owner rows immutable).
--   - Moderation queue/takedown (separate boundary decision).

-- 1. Organizer registry -------------------------------------------------------
create table public.organizers (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80),
  name text not null check (char_length(name) between 2 and 80),
  description text null check (description is null or char_length(description) <= 1000),
  region_code text not null,
  organizer_type text not null check (organizer_type in ('independent', 'organization', 'professional')),
  game_keys text[] not null default '{}' check (
    (array_length(game_keys, 1) is null or array_length(game_keys, 1) <= 8)
  ),
  website_url text null check (
    website_url is null
    or (website_url ~ '^https://[^[:space:]@]+$' and char_length(website_url) <= 2000)
  ),
  social_links jsonb null,
  trust_state text not null default 'not_submitted' check (
    trust_state in ('not_submitted', 'submitted', 'under_review', 'confirmed', 'rejected', 'expired')
  ),
  is_public boolean not null default true,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizers is
  'P9 tournament organizer registry: publishing identity for tournament discovery. Distinct from players, organizations, brands and tournaments.';

comment on column public.organizers.trust_state is
  'P9 trust: only confirmed renders a confirmation indicator. Transitions require a separately approved verification boundary.';

comment on column public.organizers.created_by is
  'Session-derived owner (auth.uid()). Immutable: no transfer workflow exists in v1.';

create index organizers_game_keys_idx on public.organizers using gin (game_keys);
create index organizers_region_idx on public.organizers (region_code);
create index organizers_type_idx on public.organizers (organizer_type);

create trigger trg_organizers_updated_at
before update on public.organizers
for each row execute function public.handle_updated_at();

-- Slug + created_by immutability (D1.5.1 F-T01 pattern).
create or replace function public.prevent_organizer_identity_change()
returns trigger
language plpgsql
as $$
begin
  if (NEW.slug <> OLD.slug) then
    raise exception 'organizers.slug is immutable';
  end if;
  if (NEW.created_by <> OLD.created_by and NEW.created_by is not null and OLD.created_by is not null) then
    raise exception 'organizers.created_by is immutable';
  end if;
  if (NEW.created_by is distinct from OLD.created_by) then
    raise exception 'organizers.created_by is immutable';
  end if;
  return NEW;
end;
$$;

create trigger trg_organizers_no_identity_change
before update on public.organizers
for each row execute function public.prevent_organizer_identity_change();

-- 2. Membership ---------------------------------------------------------------
create table public.organizer_members (
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  user_id uuid not null references public.app_users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor')),
  created_at timestamptz not null default now(),
  primary key (organizer_id, user_id)
);

comment on table public.organizer_members is
  'P9 organizer membership: owner|admin|editor. No org-membership inheritance. Verification can never be self-approved.';

create index organizer_members_user_idx on public.organizer_members (user_id);

-- Founding owner immutability: the first owner row can never be edited or deleted in v1.
create or replace function public.prevent_owner_mutation()
returns trigger
language plpgsql
as $$
declare
  owner_count int;
begin
  if (TG_OP = 'INSERT') then
    if (NEW.role = 'owner') then
      select count(*) into owner_count
      from public.organizer_members
      where organizer_id = NEW.organizer_id and role = 'owner';
      if (owner_count >= 1) then
        raise exception 'organizer owner is immutable in v1: no transfer workflow exists';
      end if;
    end if;
    return NEW;
  end if;
  if (OLD.role = 'owner') then
    raise exception 'organizer owner rows are immutable in v1';
  end if;
  if (TG_OP = 'UPDATE' and NEW.role = 'owner') then
    raise exception 'organizer owner assignment requires an approved transfer workflow';
  end if;
  return coalesce(NEW, OLD);
end;
$$;

create trigger trg_organizer_members_owner_insert
before insert on public.organizer_members
for each row execute function public.prevent_owner_mutation();

create trigger trg_organizer_members_owner_update
before update on public.organizer_members
for each row execute function public.prevent_owner_mutation();

create trigger trg_organizer_members_owner_delete
before delete on public.organizer_members
for each row execute function public.prevent_owner_mutation();

-- 3. Row Level Security -------------------------------------------------------
alter table public.organizers enable row level security;
alter table public.organizer_members enable row level security;

-- No anon policies on any operation (public reads go through the RPC pair).
-- Owner/member self-reads when the account is active.
create policy "organizers member select"
on public.organizers for select to authenticated
using (
  exists (
    select 1 from public.organizer_members m
    where m.organizer_id = organizers.id and m.user_id = auth.uid()
  )
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- Organizer creation: active accounts only; created_by bound to the session.
create policy "organizers owner insert"
on public.organizers for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- Profile edits: owner/admin only, active account. Column allowlists enforced
-- at the application boundary; RLS binds the row.
create policy "organizers admin update"
on public.organizers for update to authenticated
using (
  exists (
    select 1 from public.organizer_members m
    where m.organizer_id = organizers.id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
)
with check (
  exists (
    select 1 from public.organizer_members m
    where m.organizer_id = organizers.id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- No owner DELETE policy (organizers with tournaments must never vanish;
-- deletion arrives with an approved retention rule, if ever).

-- Members read their own rows only (active account).
create policy "organizer_members self select"
on public.organizer_members for select to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- No member INSERT/UPDATE/DELETE policies: membership changes require an
-- approved invitation/transfer workflow (separate decision). The founding
-- owner row is inserted by the gated writer under RLS after approval.

-- 4. Explicit grants (never depend on implicit grants) ------------------------
revoke all on table public.organizers from public;
revoke all on table public.organizers from anon;
grant select, insert, update on table public.organizers to authenticated;
revoke delete, truncate, references, trigger on table public.organizers from authenticated;

revoke all on table public.organizer_members from public;
revoke all on table public.organizer_members from anon;
grant select on table public.organizer_members to authenticated;
revoke insert, update, delete, truncate, references, trigger
on table public.organizer_members
from authenticated;

-- 5. Tournaments table (structure only; RLS policies + public RPCs land in
-- 20261112000006_p9_tournament_link). Created here so the organizer RPCs
-- above resolve their derived published_tournament_count against a real
-- target. RLS is enabled immediately (default-deny, no policies yet) so no
-- migration state ever exposes an unprotected table.
-- This table FULFILLS the P3 data-model proposal (04-data-model.md) with two
-- documented extensions: organizer_id FK (explicit relationship) and an
-- extended lifecycle (submitted/archived). See database-and-migration-design.md.
create table public.tournaments (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 80),
  title text not null check (char_length(title) between 2 and 120),
  game_key text not null references public.games (key) on delete restrict,
  region_code text not null,
  format text not null check (format in ('team', 'individual', 'both')),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  timezone text not null check (char_length(timezone) between 1 and 64),
  entry_fee_minor int null check (entry_fee_minor is null or (entry_fee_minor >= 0 and entry_fee_minor <= 1000000000000)),
  prize_pool_minor int null check (prize_pool_minor is null or (prize_pool_minor >= 0 and prize_pool_minor <= 1000000000000)),
  currency char(3) null check (currency is null or currency ~ '^[A-Z]{3}$'),
  description text null check (description is null or char_length(description) <= 4000),
  organizer_kind text not null check (organizer_kind in ('independent', 'organization')),
  organizer_name text not null check (char_length(organizer_name) between 2 and 80),
  organizer_slug text null check (organizer_slug is null or (organizer_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(organizer_slug) between 2 and 80)),
  organizer_id uuid null references public.organizers (id) on delete set null,
  lifecycle text not null default 'draft' check (lifecycle in ('draft', 'submitted', 'published', 'unpublished', 'archived')),
  registration_url text null check (
    registration_url is null
    or (registration_url ~ '^https://[^[:space:]@]+$' and char_length(registration_url) <= 2000)
  ),
  contact_instructions text null check (contact_instructions is null or char_length(contact_instructions) <= 500),
  registration_closes_at timestamptz null,
  eligibility jsonb null,
  created_by uuid not null references public.app_users (id) on delete restrict,
  updated_by uuid null references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz null
);

comment on table public.tournaments is
  'P9 tournament listings (fulfills the P3 proposal + organizer_id FK + submitted/archived lifecycle). Public reads via masked RPCs only.';

comment on column public.tournaments.organizer_id is
  'Explicit relationship to the organizer registry. Historical rows may carry only the denormalized kind/name/slug; new rows require this FK at the application boundary.';

create index tournaments_organizer_idx on public.tournaments (organizer_id);
create index tournaments_lifecycle_idx on public.tournaments (lifecycle);
create index tournaments_game_idx on public.tournaments (game_key);

create trigger trg_tournaments_updated_at
before update on public.tournaments
for each row execute function public.handle_updated_at();

-- Default-deny immediately; policies + grants + public RPCs in 06.
alter table public.tournaments enable row level security;

revoke all on table public.tournaments from public;
revoke all on table public.tournaments from anon;
revoke all on table public.tournaments from authenticated;

-- 6. Masked public RPCs -------------------------------------------------------
-- LIKE escaping parity (G1): trim, 120-cap, backslash-escape %, _, \.
create or replace function public.escape_organizer_like(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(trim(both from raw), '\', '\\'), '%', '\%'), '_', '\_');
$$;

revoke all on function public.escape_organizer_like(text) from public;
revoke all on function public.escape_organizer_like(text) from anon;
revoke all on function public.escape_organizer_like(text) from authenticated;

create or replace function public.search_organizers(
  p_game text default null,
  p_region text default null,
  p_organizer_type text default null,
  p_query text default null,
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  slug text,
  name text,
  region_code text,
  organizer_type text,
  game_keys text[],
  trust_state text,
  published_tournament_count bigint,
  is_public boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.slug,
    o.name,
    o.region_code,
    o.organizer_type,
    o.game_keys,
    o.trust_state,
    (
      select count(*)
      from public.tournaments t
      where t.organizer_id = o.id and t.lifecycle = 'published'
    ) as published_tournament_count,
    o.is_public
  from public.organizers o
  where o.is_public = true
    and (p_game is null or p_game = any(o.game_keys))
    and (p_region is null or o.region_code = p_region)
    and (p_organizer_type is null or o.organizer_type = p_organizer_type)
    and (
      p_query is null
      or o.name ilike '%' || public.escape_organizer_like(p_query) || '%' escape '\'
    )
  order by o.created_at desc
  limit least(greatest(p_limit, 1), 60)
  offset least(greatest(p_offset, 0), 1000);
$$;

comment on function public.search_organizers(text, text, text, text, int, int) is
  'P9 masked organizer directory: 8 public columns only. No owner/membership/verification internals.';

create or replace function public.get_organizer_by_slug(p_slug text)
returns table (
  slug text,
  name text,
  region_code text,
  organizer_type text,
  game_keys text[],
  trust_state text,
  published_tournament_count bigint,
  is_public boolean,
  description text,
  website_url text,
  social_links jsonb,
  organization_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.slug,
    o.name,
    o.region_code,
    o.organizer_type,
    o.game_keys,
    o.trust_state,
    (
      select count(*)
      from public.tournaments t
      where t.organizer_id = o.id and t.lifecycle = 'published'
    ) as published_tournament_count,
    o.is_public,
    o.description,
    o.website_url,
    coalesce(o.social_links, '[]'::jsonb),
    null::text as organization_slug
  from public.organizers o
  where o.slug = lower(trim(both from p_slug)) and o.is_public = true
  limit 1;
$$;

comment on function public.get_organizer_by_slug(text) is
  'P9 masked organizer detail: directory columns + description/website/socials/organization_slug. organization_slug is null until an approved linkage lands.';

revoke all on function public.search_organizers(text, text, text, text, int, int) from public;
grant execute on function public.search_organizers(text, text, text, text, int, int) to anon, authenticated;

revoke all on function public.get_organizer_by_slug(text) from public;
grant execute on function public.get_organizer_by_slug(text) to anon, authenticated;
