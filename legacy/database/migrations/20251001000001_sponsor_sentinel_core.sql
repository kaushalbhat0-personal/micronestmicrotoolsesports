-- Sponsor Sentinel — Persistence Foundation (RCCF-SENTINEL-03)
-- Canonical contracts: Organization -> ConnectedChannel -> SponsorCampaign -> Deliverable -> Evidence -> Evaluation
-- Plus: Scan, WebhookEvent (future)
-- RLS: is_org_member(organization_id) for tenant tables; webhook_events system-owned
-- Idempotent where practical; no secrets; deterministic.

-- ─────────────────────────────────────────────────────────────
-- connected_channels
-- ─────────────────────────────────────────────────────────────
create table if not exists public.connected_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null check (platform in ('twitch','youtube','kick')),
  external_channel_id text not null,
  external_handle text not null,
  display_name text,
  canonical_url text not null,
  connection_mode text not null default 'discovered' check (connection_mode in ('discovered','authorized')),
  connection_status text not null default 'connected' check (connection_status in ('connected','disconnected','expired','revoked')),
  authorized_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connected_channels_org_platform_ext_unique unique (organization_id, platform, external_channel_id)
);

drop trigger if exists connected_channels_updated_at on public.connected_channels;
create trigger connected_channels_updated_at
  before update on public.connected_channels
  for each row execute function public.handle_updated_at();

create index if not exists connected_channels_org_idx on public.connected_channels(organization_id);
create index if not exists connected_channels_platform_idx on public.connected_channels(platform);
create index if not exists connected_channels_ext_idx on public.connected_channels(external_channel_id);
create index if not exists connected_channels_handle_idx on public.connected_channels(external_handle);

-- ─────────────────────────────────────────────────────────────
-- sponsor_campaigns
-- ─────────────────────────────────────────────────────────────
create table if not exists public.sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text,
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsor_campaigns_window_check check (ends_at > starts_at)
);

drop trigger if exists sponsor_campaigns_updated_at on public.sponsor_campaigns;
create trigger sponsor_campaigns_updated_at
  before update on public.sponsor_campaigns
  for each row execute function public.handle_updated_at();

create index if not exists sponsor_campaigns_org_idx on public.sponsor_campaigns(organization_id);
create index if not exists sponsor_campaigns_status_idx on public.sponsor_campaigns(status);
create index if not exists sponsor_campaigns_window_idx on public.sponsor_campaigns(starts_at, ends_at);

-- ─────────────────────────────────────────────────────────────
-- deliverables
-- ─────────────────────────────────────────────────────────────
create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.sponsor_campaigns(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  description text,
  rule jsonb not null,
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deliverables_rule_is_object check (jsonb_typeof(rule) = 'object')
);

drop trigger if exists deliverables_updated_at on public.deliverables;
create trigger deliverables_updated_at
  before update on public.deliverables
  for each row execute function public.handle_updated_at();

create index if not exists deliverables_org_idx on public.deliverables(organization_id);
create index if not exists deliverables_campaign_idx on public.deliverables(campaign_id);

-- Enforce deliverable.organization_id == campaign.organization_id
create or replace function public.check_deliverable_org()
returns trigger
language plpgsql
as $$
declare
  campaign_org uuid;
begin
  select organization_id into campaign_org from public.sponsor_campaigns where id = new.campaign_id;
  if campaign_org is null then
    raise exception 'campaign % not found', new.campaign_id;
  end if;
  if campaign_org <> new.organization_id then
    raise exception 'deliverable organization_id does not match campaign organization_id';
  end if;
  return new;
end;
$$;

drop trigger if exists deliverables_org_check on public.deliverables;
create trigger deliverables_org_check
  before insert or update on public.deliverables
  for each row execute function public.check_deliverable_org();

-- ─────────────────────────────────────────────────────────────
-- evidence (immutable, append-only)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.sponsor_campaigns(id) on delete restrict,
  deliverable_id uuid not null references public.deliverables(id) on delete restrict,
  platform text not null check (platform in ('twitch','youtube','kick')),
  external_channel_id text not null,
  external_content_id text,
  evidence_type text not null check (evidence_type in ('live_stream','video')),
  source text not null check (source in (
    'get_streams','get_channel_info','get_videos','get_stream_tags','get_games',
    'youtube_channels_list','youtube_videos_list','youtube_search_list','youtube_video_categories',
    'kick_livestreams','kick_channels','event'
  )),
  source_id text not null,
  source_url text,
  observed_at timestamptz not null,
  observed_value text not null,
  normalized_value text not null,
  raw_ref jsonb,
  scanner_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists evidence_org_idx on public.evidence(organization_id);
create index if not exists evidence_campaign_idx on public.evidence(campaign_id);
create index if not exists evidence_deliverable_idx on public.evidence(deliverable_id);
create index if not exists evidence_platform_idx on public.evidence(platform);
create index if not exists evidence_observed_at_idx on public.evidence(observed_at);

-- ─────────────────────────────────────────────────────────────
-- evaluations (immutable audit)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_id uuid not null references public.evidence(id) on delete restrict,
  deliverable_id uuid not null references public.deliverables(id) on delete restrict,
  result text not null check (result in ('PASS','FAIL','NOT_VERIFIABLE','PENDING','NOT_SUPPORTED')),
  reason text not null,
  evaluated_at timestamptz not null default now(),
  evaluator_version text not null default '1',
  created_at timestamptz not null default now()
);

create index if not exists evaluations_org_idx on public.evaluations(organization_id);
create index if not exists evaluations_evidence_idx on public.evaluations(evidence_id);
create index if not exists evaluations_deliverable_idx on public.evaluations(deliverable_id);
create index if not exists evaluations_result_idx on public.evaluations(result);

-- ─────────────────────────────────────────────────────────────
-- scans
-- ─────────────────────────────────────────────────────────────
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.sponsor_campaigns(id) on delete restrict,
  platform text not null check (platform in ('twitch','youtube','kick')),
  status text not null check (status in ('pending','running','success','failed','partial')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  scanner_version text not null,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists scans_org_idx on public.scans(organization_id);
create index if not exists scans_campaign_idx on public.scans(campaign_id);
create index if not exists scans_platform_idx on public.scans(platform);
create index if not exists scans_status_idx on public.scans(status);

-- ─────────────────────────────────────────────────────────────
-- webhook_events (extend existing)
-- ─────────────────────────────────────────────────────────────
-- Existing table has provider/provider_event_id/payload/processed/created_at.
-- Add new columns for multi-platform + organization scoping; keep old columns for compatibility.

alter table public.webhook_events add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.webhook_events add column if not exists platform text check (platform in ('twitch','youtube','kick','stripe','razorpay','discord'));
alter table public.webhook_events add column if not exists external_event_id text;
alter table public.webhook_events add column if not exists event_type text;
alter table public.webhook_events add column if not exists received_at timestamptz default now();
alter table public.webhook_events add column if not exists processed_at timestamptz;
alter table public.webhook_events add column if not exists status text default 'pending' check (status in ('pending','processing','succeeded','failed'));

-- Backfill platform from provider where possible
update public.webhook_events set platform = provider::text
where platform is null and provider in ('twitch','youtube','kick');

-- Backfill external_event_id from provider_event_id
update public.webhook_events set external_event_id = provider_event_id
where external_event_id is null and provider_event_id is not null;

-- Ensure provider check includes new platforms
alter table public.webhook_events drop constraint if exists webhook_events_provider_check;
alter table public.webhook_events add constraint webhook_events_provider_check
  check (provider in ('stripe','razorpay','twitch','discord','youtube','kick'));

-- Indexes for webhook_events
create index if not exists webhook_events_org_idx on public.webhook_events(organization_id);
create index if not exists webhook_events_platform_idx on public.webhook_events(platform);
create index if not exists webhook_events_external_event_idx on public.webhook_events(external_event_id);
create unique index if not exists webhook_events_provider_event_unique
  on public.webhook_events(provider, external_event_id) where external_event_id is not null;

-- ─────────────────────────────────────────────────────────────
-- RLS enablement
-- ─────────────────────────────────────────────────────────────
alter table public.connected_channels enable row level security;
alter table public.sponsor_campaigns enable row level security;
alter table public.deliverables enable row level security;
alter table public.evidence enable row level security;
alter table public.evaluations enable row level security;
alter table public.scans enable row level security;
alter table public.webhook_events enable row level security;

-- ─────────────────────────────────────────────────────────────
-- RLS policies: tenant tables use is_org_member(organization_id)
-- ─────────────────────────────────────────────────────────────

-- connected_channels
drop policy if exists "connected_channels_select_member" on public.connected_channels;
create policy "connected_channels_select_member"
  on public.connected_channels for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "connected_channels_insert_member" on public.connected_channels;
create policy "connected_channels_insert_member"
  on public.connected_channels for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "connected_channels_update_member" on public.connected_channels;
create policy "connected_channels_update_member"
  on public.connected_channels for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "connected_channels_delete_member" on public.connected_channels;
create policy "connected_channels_delete_member"
  on public.connected_channels for delete to authenticated
  using (public.is_org_member(organization_id));

-- sponsor_campaigns
drop policy if exists "sponsor_campaigns_select_member" on public.sponsor_campaigns;
create policy "sponsor_campaigns_select_member"
  on public.sponsor_campaigns for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "sponsor_campaigns_insert_member" on public.sponsor_campaigns;
create policy "sponsor_campaigns_insert_member"
  on public.sponsor_campaigns for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "sponsor_campaigns_update_member" on public.sponsor_campaigns;
create policy "sponsor_campaigns_update_member"
  on public.sponsor_campaigns for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "sponsor_campaigns_delete_member" on public.sponsor_campaigns;
create policy "sponsor_campaigns_delete_member"
  on public.sponsor_campaigns for delete to authenticated
  using (public.is_org_member(organization_id));

-- deliverables
drop policy if exists "deliverables_select_member" on public.deliverables;
create policy "deliverables_select_member"
  on public.deliverables for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "deliverables_insert_member" on public.deliverables;
create policy "deliverables_insert_member"
  on public.deliverables for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "deliverables_update_member" on public.deliverables;
create policy "deliverables_update_member"
  on public.deliverables for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "deliverables_delete_member" on public.deliverables;
create policy "deliverables_delete_member"
  on public.deliverables for delete to authenticated
  using (public.is_org_member(organization_id));

-- evidence (append-only: no update/delete for authenticated)
drop policy if exists "evidence_select_member" on public.evidence;
create policy "evidence_select_member"
  on public.evidence for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "evidence_insert_member" on public.evidence;
create policy "evidence_insert_member"
  on public.evidence for insert to authenticated
  with check (public.is_org_member(organization_id));

-- No update/delete policies for evidence on authenticated -> enforced append-only.
-- service_role bypasses RLS for system inserts if needed.

-- evaluations (append-only)
drop policy if exists "evaluations_select_member" on public.evaluations;
create policy "evaluations_select_member"
  on public.evaluations for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "evaluations_insert_member" on public.evaluations;
create policy "evaluations_insert_member"
  on public.evaluations for insert to authenticated
  with check (public.is_org_member(organization_id));

-- No update/delete for evaluations on authenticated.

-- scans
drop policy if exists "scans_select_member" on public.scans;
create policy "scans_select_member"
  on public.scans for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "scans_insert_member" on public.scans;
create policy "scans_insert_member"
  on public.scans for insert to authenticated
  with check (public.is_org_member(organization_id));

drop policy if exists "scans_update_member" on public.scans;
create policy "scans_update_member"
  on public.scans for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "scans_delete_member" on public.scans;
create policy "scans_delete_member"
  on public.scans for delete to authenticated
  using (public.is_org_member(organization_id));

-- webhook_events: tenant-owned when organization_id present, else system-owned (service_role only)
drop policy if exists "webhook_events_select_member" on public.webhook_events;
create policy "webhook_events_select_member"
  on public.webhook_events for select to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

-- No insert/update/delete for authenticated on webhook_events -> service_role only for system events.
-- Existing policies for stripe etc. remain locked to service_role.
