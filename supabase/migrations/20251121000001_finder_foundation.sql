-- MicroNest — Finder foundation (RCCF-ESPORTS-FINDER-PHASE-A-IMPLEMENT-01)
--
-- User-scoped competitive discovery: player profiles, game profiles, BGMI
-- account verification evidence, teams, team members, recruitment posts,
-- applications, reports. There is deliberately NO organization_id anywhere
-- here: Finder ownership derives from profiles.id (= auth.users.id).
-- Organizations remain reserved for future tournament-organizer use.
--
-- Conventions reused: TEXT + CHECK enums (bgmi_* style), handle_updated_at()
-- trigger, is_super_admin() reviewer gate, storage path-prefix helpers
-- (org-logos can_manage_org_logo pattern), public-safe views with masked
-- PII, explicit GRANTs alongside RLS policies.
--
-- Verification semantics: public claim means ONLY "MicroNest reviewed
-- evidence that this profile controls the claimed BGMI account." No skill,
-- rank, K/D, or KRAFTON endorsement is encoded anywhere.
--
-- DO NOT APPLY AUTOMATICALLY. Apply via the standard migration workflow.

-- ─────────────────────────────────────────────────────────────
-- Helper: team membership / captaincy (SECURITY DEFINER, auth.uid())
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_finder_team_member(p_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.finder_team_members
    where team_id = p_team_id
      and user_id = auth.uid()
  );
end;
$$;

create or replace function public.is_finder_team_captain(p_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.finder_teams t
    where t.id = p_team_id
      and (t.captain_user_id = auth.uid() or t.created_by = auth.uid())
  ) or exists (
    select 1 from public.finder_team_members m
    where m.team_id = p_team_id
      and m.user_id = auth.uid()
      and m.role = 'captain'
  );
end;
$$;

create or replace function public.is_finder_post_captain(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.finder_recruitment_posts rp
    where rp.id = p_post_id
      and public.is_finder_team_captain(rp.team_id)
  );
end;
$$;

revoke all on function public.is_finder_team_member(uuid) from public;
revoke all on function public.is_finder_team_captain(uuid) from public;
revoke all on function public.is_finder_post_captain(uuid) from public;
grant execute on function public.is_finder_team_member(uuid) to authenticated;
grant execute on function public.is_finder_team_captain(uuid) to authenticated;
grant execute on function public.is_finder_post_captain(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 1. finder_profiles — one per authenticated user
-- ─────────────────────────────────────────────────────────────

create table if not exists public.finder_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  handle text not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  region text not null check (char_length(region) between 1 and 40),
  languages text[] not null default '{}',
  timezone text,
  current_level text not null
    check (current_level in ('casual','community','competitive','higher-tier','semi-pro','professional')),
  target_level text not null
    check (target_level in ('casual','community','competitive','higher-tier','semi-pro','professional')),
  primary_role text not null,
  secondary_roles text[] not null default '{}',
  availability text[] not null default '{}',
  looking_for boolean not null default true,
  open_to_tryout boolean not null default false,
  bio text check (bio is null or char_length(bio) <= 280),
  allow_indexing boolean not null default false,
  is_searchable boolean generated always as (looking_for) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive handle uniqueness (CITEXT avoided: no extra extension).
create unique index if not exists finder_profiles_handle_unique
  on public.finder_profiles(lower(handle));
create index if not exists finder_profiles_discovery_idx
  on public.finder_profiles(region, primary_role)
  where looking_for = true;

-- Normalize handle to lowercase (trigger ordering: runs before updated_at by name).
create or replace function public.finder_normalize_handle()
returns trigger
language plpgsql
as $$
begin
  new.handle = lower(new.handle);
  return new;
end;
$$;

drop trigger if exists finder_profiles_normalize on public.finder_profiles;
create trigger finder_profiles_normalize
  before insert or update of handle on public.finder_profiles
  for each row execute function public.finder_normalize_handle();

drop trigger if exists finder_profiles_updated_at on public.finder_profiles;
create trigger finder_profiles_updated_at
  before update on public.finder_profiles
  for each row execute function public.handle_updated_at();

alter table public.finder_profiles enable row level security;

drop policy if exists "finder_profiles_select_own" on public.finder_profiles;
create policy "finder_profiles_select_own"
  on public.finder_profiles for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "finder_profiles_select_searchable" on public.finder_profiles;
create policy "finder_profiles_select_searchable"
  on public.finder_profiles for select
  to authenticated
  using (is_searchable = true);

drop policy if exists "finder_profiles_insert_own" on public.finder_profiles;
create policy "finder_profiles_insert_own"
  on public.finder_profiles for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "finder_profiles_update_own" on public.finder_profiles;
create policy "finder_profiles_update_own"
  on public.finder_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "finder_profiles_delete_own" on public.finder_profiles;
create policy "finder_profiles_delete_own"
  on public.finder_profiles for delete
  to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. finder_game_profiles — one per user per game (BGMI first)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.finder_game_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null default 'bgmi' check (game in ('bgmi')),
  ign text not null check (char_length(ign) between 2 and 30),
  -- TEXT preserves leading zeroes. Numeric-only matches BGMI Character IDs.
  character_id text not null check (character_id ~ '^[0-9]{4,12}$'),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected','needs_review')),
  verification_method text check (verification_method in ('manual_evidence','api')),
  verified_at timestamptz,
  -- No FK to verification submissions (would be circular: submissions point
  -- back at game profiles). Application layer maintains the linkage.
  evidence_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finder_game_profiles_user_game_unique unique (user_id, game),
  constraint finder_game_profiles_game_character_unique unique (game, character_id),
  constraint finder_game_profiles_verified_at_check check (
    (verification_status = 'verified' and verified_at is not null) or
    (verification_status != 'verified')
  )
);

create index if not exists finder_game_profiles_user_idx
  on public.finder_game_profiles(user_id);
create index if not exists finder_game_profiles_game_character_idx
  on public.finder_game_profiles(game, character_id);

drop trigger if exists finder_game_profiles_updated_at on public.finder_game_profiles;
create trigger finder_game_profiles_updated_at
  before update on public.finder_game_profiles
  for each row execute function public.handle_updated_at();

alter table public.finder_game_profiles enable row level security;

-- Owner reads own row. No anon access: public fields flow via
-- finder_public_players (masked Character ID, no evidence linkage).
drop policy if exists "finder_game_profiles_select_own" on public.finder_game_profiles;
create policy "finder_game_profiles_select_own"
  on public.finder_game_profiles for select
  to authenticated
  using (user_id = auth.uid());

-- Owner writes own row but can NEVER self-verify: RLS caps the writable
-- verification state to unverified/pending with no method/timestamp.
-- Verified state is written via service_role after reviewer approval.
drop policy if exists "finder_game_profiles_insert_own" on public.finder_game_profiles;
create policy "finder_game_profiles_insert_own"
  on public.finder_game_profiles for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and verification_status in ('unverified', 'pending')
    and verification_method is null
    and verified_at is null
    and evidence_id is null
  );

drop policy if exists "finder_game_profiles_update_own" on public.finder_game_profiles;
create policy "finder_game_profiles_update_own"
  on public.finder_game_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and verification_status in ('unverified', 'pending')
    and verification_method is null
    and verified_at is null
    and evidence_id is null
  );

drop policy if exists "finder_game_profiles_delete_own" on public.finder_game_profiles;
create policy "finder_game_profiles_delete_own"
  on public.finder_game_profiles for delete
  to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 3. finder_verification_submissions — private evidence ledger
-- ─────────────────────────────────────────────────────────────

create table if not exists public.finder_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_profile_id uuid not null references public.finder_game_profiles(id) on delete cascade,
  evidence_path text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','needs_review')),
  reason_code text,
  reviewer uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finder_verification_reviewed_at_check check (
    (status = 'pending' and reviewer is null and reviewed_at is null) or
    (status in ('approved','rejected','needs_review'))
  )
);

create index if not exists finder_verification_user_idx
  on public.finder_verification_submissions(user_id);
create index if not exists finder_verification_game_profile_idx
  on public.finder_verification_submissions(game_profile_id);
create index if not exists finder_verification_status_idx
  on public.finder_verification_submissions(status)
  where status in ('pending', 'needs_review');

drop trigger if exists finder_verification_updated_at on public.finder_verification_submissions;
create trigger finder_verification_updated_at
  before update on public.finder_verification_submissions
  for each row execute function public.handle_updated_at();

alter table public.finder_verification_submissions enable row level security;

-- Owner: read + submit own evidence. Updates limited to withdrawing
-- (delete) while pending; status transitions are reviewer-only.
drop policy if exists "finder_verification_select_own" on public.finder_verification_submissions;
create policy "finder_verification_select_own"
  on public.finder_verification_submissions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "finder_verification_insert_own" on public.finder_verification_submissions;
create policy "finder_verification_insert_own"
  on public.finder_verification_submissions for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "finder_verification_delete_own_pending" on public.finder_verification_submissions;
create policy "finder_verification_delete_own_pending"
  on public.finder_verification_submissions for delete
  to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- Reviewer queue reads via RLS-aware clients (writes go through
-- service_role after requireSuperAdmin + audit log).
drop policy if exists "finder_verification_select_reviewer" on public.finder_verification_submissions;
create policy "finder_verification_select_reviewer"
  on public.finder_verification_submissions for select
  to authenticated
  using (public.is_super_admin());

-- No anon policies: verification evidence is never publicly readable.

-- ─────────────────────────────────────────────────────────────
-- 4. finder_teams — identity (external contact kept private)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.finder_teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 60),
  logo_url text,
  game text not null default 'bgmi' check (game in ('bgmi')),
  region text not null check (char_length(region) between 1 and 40),
  description text check (description is null or char_length(description) <= 1000),
  current_level text not null
    check (current_level in ('casual','community','competitive','higher-tier','semi-pro','professional')),
  target_level text not null
    check (target_level in ('casual','community','competitive','higher-tier','semi-pro','professional')),
  captain_user_id uuid not null references public.profiles(id) on delete restrict,
  recruiting boolean not null default true,
  contact_mode text not null default 'application_only'
    check (contact_mode in ('application_only','external_link')),
  -- Private: revealed only through the application-acceptance flow.
  -- Base table has NO public/anon read; public directory reads the
  -- finder_public_teams view, which omits this column entirely.
  external_link text check (external_link is null or external_link ~ '^https://[^ ]{1,200}$'),
  is_public boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finder_teams_game_region_idx
  on public.finder_teams(game, region)
  where is_public = true;
create index if not exists finder_teams_captain_idx
  on public.finder_teams(captain_user_id);

drop trigger if exists finder_teams_updated_at on public.finder_teams;
create trigger finder_teams_updated_at
  before update on public.finder_teams
  for each row execute function public.handle_updated_at();

alter table public.finder_teams enable row level security;

-- Base table readable ONLY by captain/creator/members (protects
-- external_link) plus super-admin reviewers. Public discovery uses
-- finder_public_teams, which excludes private columns.
drop policy if exists "finder_teams_select_member" on public.finder_teams;
create policy "finder_teams_select_member"
  on public.finder_teams for select
  to authenticated
  using (
    captain_user_id = auth.uid()
    or created_by = auth.uid()
    or public.is_finder_team_member(id)
    or public.is_super_admin()
  );

drop policy if exists "finder_teams_insert_authenticated" on public.finder_teams;
create policy "finder_teams_insert_authenticated"
  on public.finder_teams for insert
  to authenticated
  with check (captain_user_id = auth.uid() and created_by = auth.uid());

drop policy if exists "finder_teams_update_captain" on public.finder_teams;
create policy "finder_teams_update_captain"
  on public.finder_teams for update
  to authenticated
  using (public.is_finder_team_captain(id))
  with check (public.is_finder_team_captain(id));

drop policy if exists "finder_teams_delete_captain" on public.finder_teams;
create policy "finder_teams_delete_captain"
  on public.finder_teams for delete
  to authenticated
  using (public.is_finder_team_captain(id));

-- ─────────────────────────────────────────────────────────────
-- 5. finder_team_members — roster
-- ─────────────────────────────────────────────────────────────

create table if not exists public.finder_team_members (
  team_id uuid not null references public.finder_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'player'
    check (role in ('captain','co-captain','player','sub')),
  game_role text,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists finder_team_members_user_idx
  on public.finder_team_members(user_id);

alter table public.finder_team_members enable row level security;

drop policy if exists "finder_team_members_select" on public.finder_team_members;
create policy "finder_team_members_select"
  on public.finder_team_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_finder_team_member(team_id)
    or public.is_super_admin()
  );

-- Captain adds members; members cannot self-add to arbitrary teams.
drop policy if exists "finder_team_members_insert_captain" on public.finder_team_members;
create policy "finder_team_members_insert_captain"
  on public.finder_team_members for insert
  to authenticated
  with check (public.is_finder_team_captain(team_id));

drop policy if exists "finder_team_members_update_captain" on public.finder_team_members;
create policy "finder_team_members_update_captain"
  on public.finder_team_members for update
  to authenticated
  using (public.is_finder_team_captain(team_id))
  with check (public.is_finder_team_captain(team_id));

-- Leave (self) or remove (captain).
drop policy if exists "finder_team_members_delete" on public.finder_team_members;
create policy "finder_team_members_delete"
  on public.finder_team_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_finder_team_captain(team_id)
  );

-- ─────────────────────────────────────────────────────────────
-- 6. finder_recruitment_posts — team seeking player
-- ─────────────────────────────────────────────────────────────

create table if not exists public.finder_recruitment_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.finder_teams(id) on delete cascade,
  game text not null default 'bgmi' check (game in ('bgmi')),
  role_needed text not null,
  slots integer not null default 1 check (slots >= 1 and slots <= 10),
  current_level_min text not null
    check (current_level_min in ('casual','community','competitive','higher-tier','semi-pro','professional')),
  target_level text not null
    check (target_level in ('casual','community','competitive','higher-tier','semi-pro','professional')),
  region text not null check (char_length(region) between 1 and 40),
  availability_required text[] not null default '{}',
  experience_min text,
  tryout_required boolean not null default true,
  status text not null default 'open'
    check (status in ('open','paused','closed','filled')),
  -- Expiry reserved for the Phase C cron-ledger sweep; no cron yet.
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finder_recruitment_open_idx
  on public.finder_recruitment_posts(game, status, role_needed, region, expires_at)
  where status = 'open';
create index if not exists finder_recruitment_team_idx
  on public.finder_recruitment_posts(team_id);

drop trigger if exists finder_recruitment_posts_updated_at on public.finder_recruitment_posts;
create trigger finder_recruitment_posts_updated_at
  before update on public.finder_recruitment_posts
  for each row execute function public.handle_updated_at();

alter table public.finder_recruitment_posts enable row level security;

-- Open posts are publicly readable (anon + authenticated): the SEO surface.
drop policy if exists "finder_recruitment_select_open" on public.finder_recruitment_posts;
create policy "finder_recruitment_select_open"
  on public.finder_recruitment_posts for select
  to anon, authenticated
  using (status = 'open');

-- Team members can read their own non-open posts.
drop policy if exists "finder_recruitment_select_member" on public.finder_recruitment_posts;
create policy "finder_recruitment_select_member"
  on public.finder_recruitment_posts for select
  to authenticated
  using (public.is_finder_team_member(team_id) or public.is_finder_team_captain(team_id));

drop policy if exists "finder_recruitment_insert_captain" on public.finder_recruitment_posts;
create policy "finder_recruitment_insert_captain"
  on public.finder_recruitment_posts for insert
  to authenticated
  with check (
    public.is_finder_team_captain(team_id)
    and created_by = auth.uid()
  );

drop policy if exists "finder_recruitment_update_captain" on public.finder_recruitment_posts;
create policy "finder_recruitment_update_captain"
  on public.finder_recruitment_posts for update
  to authenticated
  using (public.is_finder_team_captain(team_id))
  with check (public.is_finder_team_captain(team_id) and slots >= 1);

drop policy if exists "finder_recruitment_delete_captain" on public.finder_recruitment_posts;
create policy "finder_recruitment_delete_captain"
  on public.finder_recruitment_posts for delete
  to authenticated
  using (public.is_finder_team_captain(team_id));

-- ─────────────────────────────────────────────────────────────
-- 7. finder_applications — player applies to post (no chat)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.finder_applications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.finder_recruitment_posts(id) on delete cascade,
  applicant_user_id uuid not null references public.profiles(id) on delete cascade,
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'applied'
    check (status in ('applied','shortlisted','accepted','declined','withdrawn')),
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint finder_applications_decided_at_check check (
    (status in ('applied','withdrawn') and decided_at is null) or
    (status in ('shortlisted','accepted','declined'))
  )
);

-- One active application per player per post (withdrawn/declined/accepted
-- rows are terminal and do not block re-application).
create unique index if not exists finder_applications_active_unique
  on public.finder_applications(post_id, applicant_user_id)
  where status in ('applied', 'shortlisted');

create index if not exists finder_applications_post_idx
  on public.finder_applications(post_id);
create index if not exists finder_applications_applicant_idx
  on public.finder_applications(applicant_user_id);

alter table public.finder_applications enable row level security;

-- Applicant reads own applications.
drop policy if exists "finder_applications_select_applicant" on public.finder_applications;
create policy "finder_applications_select_applicant"
  on public.finder_applications for select
  to authenticated
  using (applicant_user_id = auth.uid());

-- Team captain/member reads the queue for their own posts.
drop policy if exists "finder_applications_select_team" on public.finder_applications;
create policy "finder_applications_select_team"
  on public.finder_applications for select
  to authenticated
  using (public.is_finder_post_captain(post_id));

-- Reviewers audit via service_role; RLS read for RLS-aware admin clients.
drop policy if exists "finder_applications_select_reviewer" on public.finder_applications;
create policy "finder_applications_select_reviewer"
  on public.finder_applications for select
  to authenticated
  using (public.is_super_admin());

-- Apply: applicant only, forced to own user_id, starts as applied.
drop policy if exists "finder_applications_insert_own" on public.finder_applications;
create policy "finder_applications_insert_own"
  on public.finder_applications for insert
  to authenticated
  with check (applicant_user_id = auth.uid() and status = 'applied' and decided_by is null);

-- Withdraw: applicant moves own active application to withdrawn only.
drop policy if exists "finder_applications_withdraw_own" on public.finder_applications;
create policy "finder_applications_withdraw_own"
  on public.finder_applications for update
  to authenticated
  using (applicant_user_id = auth.uid() and status in ('applied', 'shortlisted'))
  with check (applicant_user_id = auth.uid() and status = 'withdrawn');

-- Decide: team captain shortlists/accepts/declines.
drop policy if exists "finder_applications_decide_team" on public.finder_applications;
create policy "finder_applications_decide_team"
  on public.finder_applications for update
  to authenticated
  using (public.is_finder_post_captain(post_id))
  with check (status in ('shortlisted', 'accepted', 'declined'));

-- No anon policies: applications are never publicly readable.

-- ─────────────────────────────────────────────────────────────
-- 8. finder_reports — marketplace safety (private/admin-only)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.finder_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null
    check (target_type in ('player','team','recruitment_post','application')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 10 and 1000),
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists finder_reports_status_idx
  on public.finder_reports(status)
  where status = 'open';
create index if not exists finder_reports_target_idx
  on public.finder_reports(target_type, target_id);

alter table public.finder_reports enable row level security;

drop policy if exists "finder_reports_select_own" on public.finder_reports;
create policy "finder_reports_select_own"
  on public.finder_reports for select
  to authenticated
  using (reporter_user_id = auth.uid() or public.is_super_admin());

drop policy if exists "finder_reports_insert_own" on public.finder_reports;
create policy "finder_reports_insert_own"
  on public.finder_reports for insert
  to authenticated
  with check (reporter_user_id = auth.uid() and status = 'open');

-- No update/delete for reporters: triage happens via service_role after
-- requireSuperAdmin. No anon policies.

-- ─────────────────────────────────────────────────────────────
-- Grants — RLS policies need matching table privileges
-- ─────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.finder_profiles to authenticated;
grant select, insert, update, delete on public.finder_game_profiles to authenticated;
grant select, insert, update, delete on public.finder_verification_submissions to authenticated;
grant select, insert, update, delete on public.finder_teams to authenticated;
grant select, insert, update, delete on public.finder_team_members to authenticated;
grant select on public.finder_recruitment_posts to anon;
grant select, insert, update, delete on public.finder_recruitment_posts to authenticated;
grant select, insert, update, delete on public.finder_applications to authenticated;
grant select, insert on public.finder_reports to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Public-safe views — the ONLY anon-readable Finder surface
-- ─────────────────────────────────────────────────────────────

-- Player directory: masked Character ID, no evidence linkage, no user_id,
-- no contact data. Owned by the migration role so anon reads bypass base
-- RLS through this masked projection only.
create or replace view public.finder_public_players as
select
  p.handle,
  p.display_name,
  p.avatar_url,
  p.region,
  p.current_level,
  p.target_level,
  p.primary_role,
  p.secondary_roles,
  p.availability,
  p.looking_for,
  p.open_to_tryout,
  g.game,
  g.ign,
  ('****' || right(g.character_id, 4)) as character_id_masked,
  g.verification_status,
  (g.verification_status = 'verified') as bgmi_verified
from public.finder_profiles p
join public.finder_game_profiles g on g.user_id = p.user_id;

comment on view public.finder_public_players is 'Public-safe Finder directory projection. Character ID is masked (**** + last 4); evidence paths, user IDs, and contact data are never exposed. Verification means account-control evidence only, never skill/rank.';

-- Team directory: excludes external_link, captain_user_id, created_by.
create or replace view public.finder_public_teams as
select
  t.id,
  t.slug,
  t.name,
  t.logo_url,
  t.game,
  t.region,
  t.description,
  t.current_level,
  t.target_level,
  t.recruiting,
  t.contact_mode,
  t.is_public,
  t.created_at
from public.finder_teams t
where t.is_public = true;

comment on view public.finder_public_teams is 'Public-safe team directory projection. Omits external_link, captain_user_id, and created_by: contact is revealed only through the application-acceptance flow.';

grant select on public.finder_public_players to anon, authenticated;
grant select on public.finder_public_teams to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Storage — buckets + path-prefix policies
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('finder-avatars', 'finder-avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('finder-verification', 'finder-verification', false)
on conflict (id) do nothing;

-- Avatar/logo manager: own user folder ({auth.uid()}/...) or a team the
-- caller captains ({team_id}/logo.*). Mirrors can_manage_org_logo().
create or replace function public.can_manage_finder_avatar(object_name text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  first_segment text := split_part(object_name, '/', 1);
begin
  if first_segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;
  if first_segment::uuid = auth.uid() then
    return true;
  end if;
  return public.is_finder_team_captain(first_segment::uuid);
end;
$$;

-- Evidence manager: own user folder only. Reviewers read via service_role
-- (admin client) or the is_super_admin RLS policy below — never anon.
create or replace function public.can_manage_finder_evidence(object_name text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  first_segment text := split_part(object_name, '/', 1);
begin
  if first_segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;
  return first_segment::uuid = auth.uid();
end;
$$;

revoke all on function public.can_manage_finder_avatar(text) from public;
revoke all on function public.can_manage_finder_evidence(text) from public;
grant execute on function public.can_manage_finder_avatar(text) to authenticated;
grant execute on function public.can_manage_finder_evidence(text) to authenticated;

-- finder-avatars: public read, owner/captain writes.
drop policy if exists "finder_avatars_public_read" on storage.objects;
create policy "finder_avatars_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'finder-avatars');

drop policy if exists "finder_avatars_owner_insert" on storage.objects;
create policy "finder_avatars_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'finder-avatars'
    and public.can_manage_finder_avatar(name)
  );

drop policy if exists "finder_avatars_owner_update" on storage.objects;
create policy "finder_avatars_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'finder-avatars'
    and public.can_manage_finder_avatar(name)
  )
  with check (
    bucket_id = 'finder-avatars'
    and public.can_manage_finder_avatar(name)
  );

drop policy if exists "finder_avatars_owner_delete" on storage.objects;
create policy "finder_avatars_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'finder-avatars'
    and public.can_manage_finder_avatar(name)
  );

-- finder-verification: NO public/anon access. Owner submits and reads own;
-- super-admin reviewers read via RLS-aware clients; writes otherwise go
-- through service_role after requireSuperAdmin + audit log.
drop policy if exists "finder_verification_owner_insert" on storage.objects;
create policy "finder_verification_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'finder-verification'
    and public.can_manage_finder_evidence(name)
  );

drop policy if exists "finder_verification_owner_select" on storage.objects;
create policy "finder_verification_owner_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'finder-verification'
    and (
      public.can_manage_finder_evidence(name)
      or public.is_super_admin()
    )
  );

drop policy if exists "finder_verification_owner_update" on storage.objects;
create policy "finder_verification_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'finder-verification'
    and public.can_manage_finder_evidence(name)
  )
  with check (
    bucket_id = 'finder-verification'
    and public.can_manage_finder_evidence(name)
  );

drop policy if exists "finder_verification_owner_delete" on storage.objects;
create policy "finder_verification_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'finder-verification'
    and public.can_manage_finder_evidence(name)
  );
