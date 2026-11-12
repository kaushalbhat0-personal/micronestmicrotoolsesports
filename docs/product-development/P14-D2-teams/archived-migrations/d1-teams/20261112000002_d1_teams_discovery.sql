-- D1 teams/discovery foundation (DESIGN — pending acceptance, NOT applied in D1).
-- Scope: teams + team_members + recruitment_posts + applications + reports.
-- Integrates with app_users / player_profiles / player_game_profiles / games.
-- G1 contracts untouched (additive only). No legacy migration restore.
-- Ownership: creator is owner+captain. Org ownership reserved via
-- organization_id (text, future FK — no constraint in D1, see 05).
-- Public reads: RPC-only masked projections (no anon base-table SELECT).
-- One team supports one game in D1 (game_key FK). One user may join many teams.

-- 1. Teams ---------------------------------------------------------------
create table public.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  name text not null check (char_length(name) between 2 and 60),
  game_key text not null references public.games (key) on delete restrict,
  region_code text not null check (region_code in ('india','asia','europe','north-america','south-america','middle-east','online')),
  description text null check (description is null or char_length(description) <= 1000),
  current_level text not null check (current_level in ('casual','community','competitive','higher-tier','semi-pro','professional')),
  target_level text not null check (target_level in ('casual','community','competitive','higher-tier','semi-pro','professional')),
  recruiting boolean not null default true,
  is_public boolean not null default true,
  owner_user_id uuid not null references public.app_users (id) on delete restrict,
  organization_id text null,
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.teams is
  'D1 teams: one row per team, one game per team. owner_user_id/created_by are session-derived (auth.uid()). organization_id reserved for future orgs (no FK in D1).';

create trigger trg_teams_updated_at
before update on public.teams
for each row execute function public.handle_updated_at();

-- 2. Membership -----------------------------------------------------------
create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.app_users (id) on delete cascade,
  role text not null check (role in ('captain','co-captain','player','sub')),
  game_role text null check (game_role is null or game_role in ('IGL','Assaulter','Support','Scout')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

comment on table public.team_members is
  'D1 team membership: PK(team_id,user_id) allows one user in many teams. Captain gate via is_team_captain().';

-- 3. Recruitment posts ----------------------------------------------------
create table public.recruitment_posts (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  game_key text not null references public.games (key) on delete restrict,
  role_needed text not null check (role_needed in ('IGL','Assaulter','Support','Scout')),
  slots integer not null check (slots between 1 and 10),
  current_level_min text not null check (current_level_min in ('casual','community','competitive','higher-tier','semi-pro','professional')),
  target_level text not null check (target_level in ('casual','community','competitive','higher-tier','semi-pro','professional')),
  region_code text not null check (region_code in ('india','asia','europe','north-america','south-america','middle-east','online')),
  availability_required text[] not null default '{}',
  tryout_required boolean not null default true,
  status text not null default 'open' check (status in ('open','paused','closed','filled')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_by uuid not null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recruitment_posts is
  'D1 recruitment posts: captain-gated writes, open posts readable via RPC only.';

create trigger trg_recruitment_posts_updated_at
before update on public.recruitment_posts
for each row execute function public.handle_updated_at();

-- 4. Applications ---------------------------------------------------------
create table public.applications (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null references public.recruitment_posts (id) on delete cascade,
  applicant_user_id uuid not null references public.app_users (id) on delete cascade,
  note text null check (note is null or char_length(note) <= 200),
  status text not null default 'applied' check (status in ('applied','shortlisted','accepted','declined','withdrawn')),
  decided_by uuid null references public.app_users (id) on delete set null,
  decided_at timestamptz null check ((decided_by is null and decided_at is null) or (decided_by is not null and decided_at is not null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.applications is
  'D1 applications: partial unique prevents duplicate active applications; accept auto-adds roster (app layer).';

create unique index applications_active_unique
  on public.applications (post_id, applicant_user_id)
  where status in ('applied', 'shortlisted');

create trigger trg_applications_updated_at
before update on public.applications
for each row execute function public.handle_updated_at();

-- 5. Reports --------------------------------------------------------------
create table public.reports (
  id uuid primary key default extensions.gen_random_uuid(),
  reporter_user_id uuid not null references public.app_users (id) on delete cascade,
  target_type text not null check (target_type in ('player','team','recruitment_post','application')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 10 and 1000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

comment on table public.reports is
  'D1 moderation queue: reporter-owned inserts, review via admin boundary.';

-- 6. Helpers (least-privilege DEFINER, auth.uidiral only) -------------------
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_team_captain(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams
    where id = p_team_id and (owner_user_id = auth.uid() or created_by = auth.uid())
  ) or exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and role = 'captain'
  );
$$;

comment on function public.is_team_member(uuid) is 'D1: caller membership in team_members.';
comment on function public.is_team_captain(uuid) is 'D1: owner/creator or member role=captain.';

-- 7. Masked public reads (RPC-only) ----------------------------------------
create or replace function public.search_teams(
  p_game text default null,
  p_region text default null,
  p_query text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  name text,
  game_key text,
  region_code text,
  current_level text,
  target_level text,
  recruiting boolean,
  member_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.slug, t.name, t.game_key, t.region_code,
         t.current_level, t.target_level, t.recruiting,
         (select count(*) from public.team_members m where m.team_id = t.id)
  from public.teams t
  where t.is_public = true
    and (p_game is null or t.game_key = p_game)
    and (p_region is null or t.region_code = p_region)
    and (p_query is null or t.name ilike '%' || p_query || '%' or t.slug ilike '%' || p_query || '%')
  order by t.created_at desc
  limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0);
$$;

create or replace function public.get_team_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  game_key text,
  region_code text,
  description text,
  current_level text,
  target_level text,
  recruiting boolean,
  member_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.slug, t.name, t.game_key, t.region_code, t.description,
         t.current_level, t.target_level, t.recruiting,
         (select count(*) from public.team_members m where m.team_id = t.id)
  from public.teams t
  where t.slug = p_slug and t.is_public = true
  limit 1;
$$;

comment on function public.search_teams(text, text, text, integer, integer) is
  'D1 masked team search: public teams only, bounded pagination, no owner/org internals.';
comment on function public.get_team_by_slug(text) is
  'D1 masked team detail: public teams only, no owner_user_id/created_by/organization_id.';

-- 8. RLS -------------------------------------------------------------------
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.recruitment_posts enable row level security;
alter table public.applications enable row level security;
alter table public.reports enable row level security;

-- teams: owner/creator full self-access; members read their teams; no anon/base public.
create policy "teams owner select"
on public.teams for select to authenticated
using (owner_user_id = auth.uid() or created_by = auth.uid() or public.is_team_member(id));

create policy "teams owner insert"
on public.teams for insert to authenticated
with check (
  owner_user_id = auth.uid() and created_by = auth.uid()
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

create policy "teams captain update"
on public.teams for update to authenticated
using (
  public.is_team_captain(id)
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
)
with check (
  public.is_team_captain(id)
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

-- team_members: members read own team roster; captain manages; user joins via application accept (app layer).
create policy "team_members member select"
on public.team_members for select to authenticated
using (public.is_team_member(team_id) or user_id = auth.uid());

create policy "team_members captain insert"
on public.team_members for insert to authenticated
with check (public.is_team_captain(team_id));

create policy "team_members captain update"
on public.team_members for update to authenticated
using (public.is_team_captain(team_id))
with check (public.is_team_captain(team_id));

create policy "team_members captain delete"
on public.team_members for delete to authenticated
using (public.is_team_captain(team_id));

-- recruitment_posts: captain writes; members of team read; open posts NOT publicly readable via base table (RPCs own discovery in later migration).
create policy "recruitment_posts captain select"
on public.recruitment_posts for select to authenticated
using (
  exists (select 1 from public.teams t where t.id = team_id and (t.owner_user_id = auth.uid() or t.created_by = auth.uid()))
  or public.is_team_member(team_id)
);

create policy "recruitment_posts captain insert"
on public.recruitment_posts for insert to authenticated
with check (public.is_team_captain(team_id) and created_by = auth.uid());

create policy "recruitment_posts captain update"
on public.recruitment_posts for update to authenticated
using (public.is_team_captain(team_id))
with check (public.is_team_captain(team_id));

create policy "recruitment_posts captain delete"
on public.recruitment_posts for delete to authenticated
using (public.is_team_captain(team_id));

-- applications: applicant owns own rows; captains read/decide their team posts.
create policy "applications applicant select"
on public.applications for select to authenticated
using (
  applicant_user_id = auth.uid()
  or exists (
    select 1 from public.recruitment_posts p where p.id = post_id and public.is_team_captain(p.team_id)
  )
);

create policy "applications applicant insert"
on public.applications for insert to authenticated
with check (
  applicant_user_id = auth.uid()
  and status = 'applied'
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

create policy "applications applicant withdraw"
on public.applications for update to authenticated
using (applicant_user_id = auth.uid())
with check (applicant_user_id = auth.uid());

-- reports: reporter inserts; no reporter update/delete; reads via admin boundary only (no select policy).
create policy "reports reporter insert"
on public.reports for insert to authenticated
with check (
  reporter_user_id = auth.uid()
  and status = 'open'
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

-- 9. Grants -----------------------------------------------------------------
revoke all on table public.teams from public;
revoke all on table public.teams from anon;
grant select, insert, update, delete on table public.teams to authenticated;
revoke truncate, references, trigger on table public.teams from authenticated;

revoke all on table public.team_members from public;
revoke all on table public.team_members from anon;
grant select, insert, update, delete on table public.team_members to authenticated;
revoke truncate, references, trigger on table public.team_members from authenticated;

revoke all on table public.recruitment_posts from public;
revoke all on table public.recruitment_posts from anon;
grant select, insert, update, delete on table public.recruitment_posts to authenticated;
revoke truncate, references, trigger on table public.recruitment_posts from authenticated;

revoke all on table public.applications from public;
revoke all on table public.applications from anon;
grant select, insert, update on table public.applications to authenticated;
revoke delete, truncate, references, trigger on table public.applications from authenticated;

revoke all on table public.reports from public;
revoke all on table public.reports from anon;
grant insert on table public.reports to authenticated;
revoke select, update, delete, truncate, references, trigger on table public.reports from authenticated;

revoke all on function public.is_team_member(uuid) from public;
grant execute on function public.is_team_member(uuid) to authenticated;
revoke all on function public.is_team_captain(uuid) from public;
grant execute on function public.is_team_captain(uuid) to authenticated;
revoke all on function public.search_teams(text, text, text, integer, integer) from public;
grant execute on function public.search_teams(text, text, text, integer, integer) to anon, authenticated;
revoke all on function public.get_team_by_slug(text) from public;
grant execute on function public.get_team_by_slug(text) to anon, authenticated;
