-- MicroNest — Initial Schema
-- Foundations for multi-tenant micro-SaaS
-- Idempotent where practical

-- Enable pgcrypto for gen_random_uuid
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- Helper: updated_at trigger
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- profiles — extends auth.users
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- organizations
-- ─────────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.handle_updated_at();

create index if not exists organizations_owner_id_idx on public.organizations(owner_id);
create index if not exists organizations_slug_idx on public.organizations(slug);

-- ─────────────────────────────────────────────────────────────
-- organization_members
-- ─────────────────────────────────────────────────────────────
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists org_members_org_idx on public.organization_members(organization_id);
create index if not exists org_members_user_idx on public.organization_members(user_id);

-- Auto-add owner as member when organization is created
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (organization_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- ─────────────────────────────────────────────────────────────
-- tools — catalog of microtools
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists tools_slug_idx on public.tools(slug);
create index if not exists tools_active_idx on public.tools(is_active) where is_active = true;

-- ─────────────────────────────────────────────────────────────
-- subscriptions — provider-agnostic
-- ─────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('stripe','razorpay')),
  provider_customer_id text,
  provider_subscription_id text unique,
  status text not null check (status in ('active','past_due','canceled','incomplete','trialing','unpaid','paused')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

create index if not exists subscriptions_org_idx on public.subscriptions(organization_id);
create index if not exists subscriptions_provider_sub_idx on public.subscriptions(provider_subscription_id);

-- ─────────────────────────────────────────────────────────────
-- tool_entitlements — org ↔ tool grants
-- Supports: per-tool AND all-access (is_all_access = true, tool_id = null)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tool_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tool_id uuid references public.tools(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  is_all_access boolean not null default false,
  source text not null default 'subscription' check (source in ('subscription','manual','promo')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  -- Enforce: all-access => tool_id must be null; per-tool => tool_id required
  constraint entitlements_all_access_check check (
    (is_all_access = true and tool_id is null) or
    (is_all_access = false and tool_id is not null)
  ),
  -- One row per org per tool; one all-access per org
  unique (organization_id, tool_id),
  unique (organization_id, is_all_access) -- prevents duplicate all-access; partial unique via trick: but need to allow only one true. Use partial index instead.
);

-- Partial unique indexes for correctness (drop the flawed unique above if exists, replace with indexes)
-- Remove the second unique if it blocks multiple per-tool rows: we need conditional uniqueness.
alter table public.tool_entitlements drop constraint if exists tool_entitlements_organization_id_is_all_access_key;

-- One all-access per org
create unique index if not exists tool_entitlements_all_access_unique
  on public.tool_entitlements(organization_id)
  where is_all_access = true;

-- One per org per tool (when not all-access)
create unique index if not exists tool_entitlements_per_tool_unique
  on public.tool_entitlements(organization_id, tool_id)
  where is_all_access = false;

create index if not exists tool_entitlements_org_idx on public.tool_entitlements(organization_id);
create index if not exists tool_entitlements_tool_idx on public.tool_entitlements(tool_id) where tool_id is not null;

-- ─────────────────────────────────────────────────────────────
-- webhook_events — idempotency for Stripe/Razorpay/Discord/Twitch
-- ─────────────────────────────────────────────────────────────
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe','razorpay','twitch','discord')),
  provider_event_id text not null unique,
  payload jsonb,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists webhook_events_provider_idx on public.webhook_events(provider);
create index if not exists webhook_events_processed_idx on public.webhook_events(processed) where processed = false;
