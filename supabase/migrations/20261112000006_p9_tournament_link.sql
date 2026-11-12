-- P9 tournament link + publishing lifecycle (2/2): RLS, lifecycle enforcement,
-- and the masked tournament RPC pair.
--
-- Status: LOCAL PROPOSAL ONLY — NOT applied remotely.
--
-- Scope:
--   1. Lifecycle transition trigger on public.tournaments (draft → submitted
--      → published → unpublished → archived; rejection = submitted → draft;
--      direct draft → published blocked; republication requires moderator;
--      archival requires moderator; slug/game_key/organizer_id/created_by
--      immutable).
--   2. RLS policies for tournaments (default-deny; organizer-member-gated
--      writes; no public base reads; cross-organizer isolation via
--      organizer_members).
--   3. Narrow grants (authenticated: select/insert/update; no delete).
--   4. Masked RPCs search_tournaments / get_tournament_by_slug (14-column P3
--      contract + detail extras; lifecycle = published predicate; LIKE
--      escaping; limit/offset clamps; anon+authenticated execute).
--
-- Migration-path note (P3 contract preserved): the 14-column search contract
-- and detail extras are byte-identical to the P3 proposal (04-data-model.md
-- column order/types). Extensions are additive and documented:
-- organizer_id join prefers the registry organizer ref when present and
-- falls back to the denormalized kind/name/slug otherwise; verified stays
-- frozen false; new lifecycle values (submitted/archived) never appear in
-- public RPC output (predicate fixes lifecycle = published).
--
-- Explicitly NOT included:
--   - Moderator publish/unpublish/archive powers (authority unresolved; the
--     trigger blocks every transition the matrix reserves for moderators
--     until a separately approved migration relaxes it).
--   - Verification transitions (trust_state changes need no column here;
--     organizer trust lives on organizers.trust_state).
--   - Cascade deletion (organizer delete is RESTRICT-blocked while
--     tournaments reference it; tournament rows are never cascade-deleted).

-- 1. Lifecycle + immutability enforcement --------------------------------------
create or replace function public.enforce_tournament_lifecycle()
returns trigger
language plpgsql
as $$
begin
  -- Identity columns are immutable (P3 locked slug/game; P9 locks organizer/owner).
  if (TG_OP = 'UPDATE') then
    if (NEW.slug is distinct from OLD.slug) then
      raise exception 'tournaments.slug is immutable';
    end if;
    if (NEW.game_key is distinct from OLD.game_key) then
      raise exception 'tournaments.game_key is immutable';
    end if;
    if (NEW.organizer_id is distinct from OLD.organizer_id) then
      raise exception 'tournaments.organizer_id is immutable: create a new listing instead';
    end if;
    if (NEW.created_by is distinct from OLD.created_by) then
      raise exception 'tournaments.created_by is immutable';
    end if;
  end if;

  -- Lifecycle allowlist (defense in depth behind the CHECK).
  if (NEW.lifecycle not in ('draft', 'submitted', 'published', 'unpublished', 'archived')) then
    raise exception 'unknown tournament lifecycle %', NEW.lifecycle;
  end if;

  if (TG_OP = 'INSERT') then
    -- New listings always start as drafts (moderation is mandatory).
    if (NEW.lifecycle <> 'draft') then
      raise exception 'tournaments must be created as drafts';
    end if;
    return NEW;
  end if;

  -- Same-state updates always permitted (field edits within a state).
  if (NEW.lifecycle = OLD.lifecycle) then
    return NEW;
  end if;

  -- Approved organizer-driven transitions.
  if (OLD.lifecycle = 'draft' and NEW.lifecycle = 'submitted') then
    return NEW;
  end if;
  if (OLD.lifecycle = 'published' and NEW.lifecycle = 'unpublished') then
    return NEW;
  end if;

  -- Moderator-reserved transitions: blocked until the moderation boundary is
  -- approved by a later migration that replaces this trigger.
  if (OLD.lifecycle = 'submitted' and NEW.lifecycle = 'published') then
    raise exception 'publishing a submitted tournament requires approved moderator authority';
  end if;
  if (OLD.lifecycle = 'submitted' and NEW.lifecycle = 'draft') then
    raise exception 'returning a submission requires approved moderator authority';
  end if;
  if (OLD.lifecycle = 'unpublished' and NEW.lifecycle = 'published') then
    raise exception 're-publication requires approved moderator authority';
  end if;
  if (NEW.lifecycle = 'archived') then
    raise exception 'archival requires an approved retention rule and moderator authority';
  end if;

  raise exception 'tournament lifecycle transition % → % is not permitted', OLD.lifecycle, NEW.lifecycle;
end;
$$;

create trigger trg_tournaments_lifecycle
before insert or update on public.tournaments
for each row execute function public.enforce_tournament_lifecycle();

-- 2. RLS policies --------------------------------------------------------------
-- Base tables stay RPC-only for the public; members manage their own rows.

-- Organizer members (owner/admin/editor) read tournament rows of their
-- organizer when their account is active. This is the cross-organizer
-- isolation boundary: a caller with no membership row for the organizer
-- sees nothing.
create policy "tournaments member select"
on public.tournaments for select to authenticated
using (
  organizer_id is not null
  and exists (
    select 1 from public.organizer_members m
    where m.organizer_id = tournaments.organizer_id and m.user_id = auth.uid()
  )
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- Draft creation: active account + membership (owner/admin/editor) on the
-- target organizer. organizer_id/created_by bound to session + membership.
create policy "tournaments member insert"
on public.tournaments for insert to authenticated
with check (
  organizer_id is not null
  and created_by = auth.uid()
  and exists (
    select 1 from public.organizer_members m
    where m.organizer_id = tournaments.organizer_id and m.user_id = auth.uid()
  )
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- Draft edits: owner/admin/editor on the row's organizer, active account.
create policy "tournaments member update"
on public.tournaments for update to authenticated
using (
  organizer_id is not null
  and exists (
    select 1 from public.organizer_members m
    where m.organizer_id = tournaments.organizer_id and m.user_id = auth.uid()
  )
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
)
with check (
  organizer_id is not null
  and exists (
    select 1 from public.organizer_members m
    where m.organizer_id = tournaments.organizer_id and m.user_id = auth.uid()
  )
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- No DELETE policy: historical tournament records are never destroyed by
-- members (unpublish/archival are lifecycle transitions, not deletes).

-- 3. Narrow grants --------------------------------------------------------------
grant select, insert, update on table public.tournaments to authenticated;
revoke delete, truncate, references, trigger on table public.tournaments from authenticated;

-- 4. Masked public tournament RPCs (P3 contract, organizer-aware) ---------------
-- Column order is the frozen 14-column P3 contract. The organizer ref prefers
-- the registry (organizer_id join) and falls back to the denormalized
-- kind/name/slug for historical rows; verified is frozen false.
create or replace function public.search_tournaments(
  p_game text default null,
  p_region text default null,
  p_status text default null,
  p_query text default null,
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  slug text,
  title text,
  game_key text,
  region_code text,
  format text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  entry_fee jsonb,
  prize_pool jsonb,
  organizer jsonb,
  lifecycle text,
  registration_url text,
  registration_closes_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  return query
  select
    t.slug,
    t.title,
    t.game_key,
    t.region_code,
    t.format,
    t.starts_at,
    t.ends_at,
    t.timezone,
    case
      when t.entry_fee_minor is null then null
      else jsonb_build_object('amountMinor', t.entry_fee_minor, 'currency', t.currency)
    end as entry_fee,
    case
      when t.prize_pool_minor is null then null
      else jsonb_build_object('amountMinor', t.prize_pool_minor, 'currency', t.currency)
    end as prize_pool,
    case
      when t.organizer_id is not null then jsonb_build_object(
        'kind', case when t.organizer_kind = 'organization' then 'organization' else 'independent' end,
        'name', coalesce((select o.name from public.organizers o where o.id = t.organizer_id), t.organizer_name),
        'slug', (select o.slug from public.organizers o where o.id = t.organizer_id),
        'verified', false
      )
      else jsonb_build_object(
        'kind', case when t.organizer_kind = 'organization' then 'organization' else 'independent' end,
        'name', t.organizer_name,
        'slug', t.organizer_slug,
        'verified', false
      )
    end as organizer,
    t.lifecycle,
    t.registration_url,
    t.registration_closes_at
  from public.tournaments t
  where t.lifecycle = 'published'
    and (p_game is null or t.game_key = p_game)
    and (p_region is null or t.region_code = p_region)
    and (
      p_status is null
      or (
        case
          when v_now < t.starts_at then 'upcoming'
          when v_now < t.ends_at then 'ongoing'
          else 'completed'
        end
      ) = p_status
    )
    and (
      p_query is null
      or t.title ilike '%' || replace(replace(replace(trim(both from p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
    )
  order by t.starts_at asc
  limit least(greatest(p_limit, 1), 60)
  offset least(greatest(p_offset, 0), 1000);
end;
$$;

comment on function public.search_tournaments(text, text, text, text, int, int) is
  'P9 masked tournament directory: frozen P3 14-column contract. Only published rows. verified frozen false.';

create or replace function public.get_tournament_by_slug(p_slug text)
returns table (
  slug text,
  title text,
  game_key text,
  region_code text,
  format text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  entry_fee jsonb,
  prize_pool jsonb,
  organizer jsonb,
  lifecycle text,
  registration_url text,
  registration_closes_at timestamptz,
  description text,
  contact_instructions text,
  eligibility jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    t.slug,
    t.title,
    t.game_key,
    t.region_code,
    t.format,
    t.starts_at,
    t.ends_at,
    t.timezone,
    case
      when t.entry_fee_minor is null then null
      else jsonb_build_object('amountMinor', t.entry_fee_minor, 'currency', t.currency)
    end,
    case
      when t.prize_pool_minor is null then null
      else jsonb_build_object('amountMinor', t.prize_pool_minor, 'currency', t.currency)
    end,
    case
      when t.organizer_id is not null then jsonb_build_object(
        'kind', case when t.organizer_kind = 'organization' then 'organization' else 'independent' end,
        'name', coalesce((select o.name from public.organizers o where o.id = t.organizer_id), t.organizer_name),
        'slug', (select o.slug from public.organizers o where o.id = t.organizer_id),
        'verified', false
      )
      else jsonb_build_object(
        'kind', case when t.organizer_kind = 'organization' then 'organization' else 'independent' end,
        'name', t.organizer_name,
        'slug', t.organizer_slug,
        'verified', false
      )
    end,
    t.lifecycle,
    t.registration_url,
    t.registration_closes_at,
    t.description,
    t.contact_instructions,
    t.eligibility
  from public.tournaments t
  where t.slug = lower(trim(both from p_slug)) and t.lifecycle = 'published'
  limit 1;
end;
$$;

comment on function public.get_tournament_by_slug(text) is
  'P9 masked tournament detail: search columns + description/contact/eligibility. Missing and unpublished slugs return zero rows (404-equivalence at the reader).';

revoke all on function public.search_tournaments(text, text, text, text, int, int) from public;
grant execute on function public.search_tournaments(text, text, text, text, int, int) to anon, authenticated;

revoke all on function public.get_tournament_by_slug(text) from public;
grant execute on function public.get_tournament_by_slug(text) to anon, authenticated;
