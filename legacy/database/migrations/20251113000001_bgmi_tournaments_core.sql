-- MicroNest — BGMI Tournament Hub core schema (RCCF-BGMI-TOURNAMENTS-02)
--
-- Public tournament-information product. Global catalogue (like `tools`
-- and `meta_parser_*`): public read, service_role writes. There are no
-- organization-scoped tables here; if org-scoped tournament data is added
-- later it must follow the standard is_org_member() RLS pattern.
--
-- Publication model: validate-then-publish. The ingestion pipeline fully
-- validates a stage dataset in memory BEFORE any write; a failed run
-- writes nothing, so the previous published dataset stays intact.
-- `published` flags exist as a kill-switch / future staging lever —
-- readers only ever see published = true rows.
--
-- Standings are DERIVED at read time (repositories/reads.ts):
--   stage total = stage entry starting_points + SUM(match totals)
-- No source_total / calculated_total pair is stored: Liquipedia bracket
-- wikitext does not carry per-team totals, so the single source of truth
-- is match results + starting points. Source `placement=` hints (rare and
-- partial) are validated at ingest time, never stored.
--
-- DO NOT APPLY AUTOMATICALLY. Apply via the standard migration workflow.

-- ── Tournaments ──────────────────────────────────────────────────
create table if not exists public.bgmi_tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text not null,
  season_year integer,
  organizer text,
  starts_on date,
  ends_on date,
  rulebook_url text,
  source_url text not null,
  source_page text not null,
  source_revision bigint,
  source_last_updated_at timestamptz,
  status text not null default 'completed'
    check (status in ('upcoming', 'ongoing', 'completed')),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bgmi_tournaments enable row level security;

drop policy if exists "bgmi_tournaments_public_read" on public.bgmi_tournaments;
create policy "bgmi_tournaments_public_read"
  on public.bgmi_tournaments for select
  to anon, authenticated
  using (published = true);

-- ── Stages ───────────────────────────────────────────────────────
create table if not exists public.bgmi_stages (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.bgmi_tournaments(id) on delete cascade,
  slug text not null,
  name text not null,
  format_note text,
  status text not null default 'completed'
    check (status in ('upcoming', 'ongoing', 'completed')),
  -- True when the final day(s) used a Smash Rule / match-point ending:
  -- the points table is shown as the points race, never as the decider.
  smash_rule boolean not null default false,
  match_point_threshold integer,
  source_url text,
  source_revision bigint,
  published boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bgmi_stages_tournament_slug_unique unique (tournament_id, slug)
);

create index if not exists bgmi_stages_tournament_idx
  on public.bgmi_stages(tournament_id);

alter table public.bgmi_stages enable row level security;

drop policy if exists "bgmi_stages_public_read" on public.bgmi_stages;
create policy "bgmi_stages_public_read"
  on public.bgmi_stages for select
  to anon, authenticated
  using (published = true);

-- ── Teams (global identity, no published flag: names only) ───────
create table if not exists public.bgmi_teams (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  display_name text not null,
  short_name text not null,
  logo_url text,
  created_at timestamptz not null default now()
);

alter table public.bgmi_teams enable row level security;

drop policy if exists "bgmi_teams_public_read" on public.bgmi_teams;
create policy "bgmi_teams_public_read"
  on public.bgmi_teams for select
  to anon, authenticated
  using (true);

-- ── Stage entries (starting/carryover points per team per stage) ─
create table if not exists public.bgmi_stage_entries (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.bgmi_stages(id) on delete cascade,
  team_id uuid not null references public.bgmi_teams(id) on delete cascade,
  starting_points integer not null default 0 check (starting_points >= 0),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint bgmi_stage_entries_stage_team_unique unique (stage_id, team_id)
);

create index if not exists bgmi_stage_entries_stage_idx
  on public.bgmi_stage_entries(stage_id);

alter table public.bgmi_stage_entries enable row level security;

drop policy if exists "bgmi_stage_entries_public_read" on public.bgmi_stage_entries;
create policy "bgmi_stage_entries_public_read"
  on public.bgmi_stage_entries for select
  to anon, authenticated
  using (published = true);

-- ── Matches ──────────────────────────────────────────────────────
create table if not exists public.bgmi_matches (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.bgmi_stages(id) on delete cascade,
  match_number integer not null check (match_number >= 1),
  map_name text,
  scheduled_at timestamptz,
  status text not null default 'completed'
    check (status in ('scheduled', 'completed')),
  vod_url text,
  source_ref text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint bgmi_matches_stage_number_unique unique (stage_id, match_number)
);

create index if not exists bgmi_matches_stage_idx
  on public.bgmi_matches(stage_id, match_number);

alter table public.bgmi_matches enable row level security;

drop policy if exists "bgmi_matches_public_read" on public.bgmi_matches;
create policy "bgmi_matches_public_read"
  on public.bgmi_matches for select
  to anon, authenticated
  using (published = true);

-- ── Match results ────────────────────────────────────────────────
create table if not exists public.bgmi_match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.bgmi_matches(id) on delete cascade,
  team_id uuid not null references public.bgmi_teams(id) on delete cascade,
  placement integer not null check (placement >= 1 and placement <= 32),
  finishes integer not null check (finishes >= 0 and finishes <= 64),
  placement_points integer not null check (placement_points >= 0),
  finish_points integer not null check (finish_points >= 0),
  total_points integer not null check (total_points >= 0),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint bgmi_match_results_match_team_unique unique (match_id, team_id)
);

create index if not exists bgmi_match_results_match_idx
  on public.bgmi_match_results(match_id);
create index if not exists bgmi_match_results_team_idx
  on public.bgmi_match_results(team_id);

alter table public.bgmi_match_results enable row level security;

drop policy if exists "bgmi_match_results_public_read" on public.bgmi_match_results;
create policy "bgmi_match_results_public_read"
  on public.bgmi_match_results for select
  to anon, authenticated
  using (published = true);

-- ── Ingestion run ledger (operations only, never public) ─────────
create table if not exists public.bgmi_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  run_id text not null unique,
  tournament_slug text not null,
  stage_slug text not null,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary text,
  source_revision bigint,
  published_revision bigint,
  matches_completed integer,
  teams_count integer,
  created_at timestamptz not null default now()
);

create index if not exists bgmi_ingestion_runs_tournament_stage_idx
  on public.bgmi_ingestion_runs(tournament_slug, stage_slug, started_at desc);

alter table public.bgmi_ingestion_runs enable row level security;
-- No policies: service_role only. Admin reads go through createAdminClient().

-- ── Public read grants ───────────────────────────────────────────
-- RLS policies alone do not grant table privileges: anon/authenticated
-- need explicit SELECT so the public readers work. Writes stay
-- service_role-only (no INSERT/UPDATE/DELETE grants by design).
grant select on public.bgmi_tournaments to anon, authenticated;
grant select on public.bgmi_stages to anon, authenticated;
grant select on public.bgmi_teams to anon, authenticated;
grant select on public.bgmi_stage_entries to anon, authenticated;
grant select on public.bgmi_matches to anon, authenticated;
grant select on public.bgmi_match_results to anon, authenticated;
