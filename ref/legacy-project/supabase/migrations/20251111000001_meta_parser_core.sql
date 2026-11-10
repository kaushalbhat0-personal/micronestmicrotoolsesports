-- MicroNest — Meta-Parser core (RCCF-META-PARSER-IMPL-01, Dota 2 adapter)
--
-- One normalized schema for every game adapter. No per-game tables.
-- Global patch catalogue (like `tools`): public read, service_role writes.
-- There are no organization-scoped tables in this migration; if org-scoped
-- Meta-Parser data is added later it must follow the standard
-- is_org_member() RLS pattern.
-- MLBB is deliberately NOT seeded here (audit-gated).
--
-- DO NOT APPLY AUTOMATICALLY. Apply via the standard migration workflow.

-- ── Games catalog ──────────────────────────────────────────────
create table if not exists public.meta_parser_games (
  slug text primary key,
  name text not null,
  adapter_key text not null unique,
  cadence text not null default 'daily',
  version_scheme text not null,
  source_listing_url text not null,
  allowed_hosts text[] not null default '{}',
  expected_fields jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meta_parser_games enable row level security;

drop policy if exists "meta_parser_games_public_read" on public.meta_parser_games;
create policy "meta_parser_games_public_read"
  on public.meta_parser_games for select
  to anon, authenticated
  using (true);

-- Dota 2 only. No other game rows (MLBB stays gated).
insert into public.meta_parser_games
  (slug, name, adapter_key, cadence, version_scheme, source_listing_url, allowed_hosts, expected_fields, is_active)
values
  ('dota-2', 'Dota 2', 'dota-2', 'daily', 'dota-numeric',
   'https://raw.githubusercontent.com/odota/dotaconstants/master/build/patch.json',
   array['raw.githubusercontent.com', 'api.github.com', 'api.opendota.com'],
   '{"buckets": ["general", "items", "heroes"]}',
   true)
on conflict (slug) do update set
  name = excluded.name,
  adapter_key = excluded.adapter_key,
  cadence = excluded.cadence,
  version_scheme = excluded.version_scheme,
  source_listing_url = excluded.source_listing_url,
  allowed_hosts = excluded.allowed_hosts,
  expected_fields = excluded.expected_fields,
  is_active = excluded.is_active,
  updated_at = now();

-- ── Patch releases (global catalogue) ─────────────────────────
create table if not exists public.meta_parser_patches (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null references public.meta_parser_games(slug) on delete cascade,
  patch_version text not null,
  title text not null,
  source_url text not null unique,
  source_published_at timestamptz,
  content_hash text not null,
  revision integer not null default 1 check (revision >= 1),
  status text not null default 'complete'
    check (status in ('ingested', 'parse_failed', 'analysis_pending', 'complete')),
  parser_version text not null,
  adapter_version text not null,
  upstream_commit text,
  upstream_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_parser_patches_game_version_unique unique (game_slug, patch_version)
);

create index if not exists meta_parser_patches_game_idx
  on public.meta_parser_patches(game_slug, source_published_at desc nulls last);

alter table public.meta_parser_patches enable row level security;

drop policy if exists "meta_parser_patches_public_read" on public.meta_parser_patches;
create policy "meta_parser_patches_public_read"
  on public.meta_parser_patches for select
  to anon, authenticated
  using (true);

-- ── Patch changes (global catalogue) ──────────────────────────
create table if not exists public.meta_parser_changes (
  id uuid primary key default gen_random_uuid(),
  patch_id uuid not null references public.meta_parser_patches(id) on delete cascade,
  game_slug text not null,
  patch_version text not null,
  stable_key text not null,
  entity_type text not null,
  entity_name text not null,
  entity_normalized text not null,
  entity_key text,
  category text not null,
  attribute text,
  old_text text,
  new_text text,
  old_numeric numeric,
  new_numeric numeric,
  unit text,
  change_type text not null
    check (change_type in ('buff', 'nerf', 'adjustment', 'rework', 'new', 'bugfix', 'neutral')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  description text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint meta_parser_changes_patch_stable_unique unique (patch_id, stable_key)
);

create index if not exists meta_parser_changes_patch_idx
  on public.meta_parser_changes(patch_id);
create index if not exists meta_parser_changes_entity_idx
  on public.meta_parser_changes(game_slug, entity_normalized);

alter table public.meta_parser_changes enable row level security;

drop policy if exists "meta_parser_changes_public_read" on public.meta_parser_changes;
create policy "meta_parser_changes_public_read"
  on public.meta_parser_changes for select
  to anon, authenticated
  using (true);

-- ── Entity aliases (global catalogue, seeded from observed data) ──
create table if not exists public.meta_parser_aliases (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null references public.meta_parser_games(slug) on delete cascade,
  canonical_name text not null,
  entity_normalized text not null,
  created_at timestamptz not null default now(),
  constraint meta_parser_aliases_game_normalized_unique unique (game_slug, entity_normalized)
);

alter table public.meta_parser_aliases enable row level security;

drop policy if exists "meta_parser_aliases_public_read" on public.meta_parser_aliases;
create policy "meta_parser_aliases_public_read"
  on public.meta_parser_aliases for select
  to anon, authenticated
  using (true);
