-- Minimal organization provider credentials (RCCF 11)
-- One row per organization+provider, encrypted at rest via app key

create table if not exists public.organization_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('twitch','youtube','kick')),
  -- encrypted payloads (base64 iv+tag+ciphertext) — never plaintext
  encrypted_client_id text,
  encrypted_client_secret text,
  encrypted_api_key text,
  -- metadata for UI masking
  client_id_masked text,
  api_key_masked text,
  last_tested_at timestamptz,
  last_test_status text check (last_test_status in ('success','failed', null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_provider_unique unique (organization_id, provider)
);

create index if not exists org_provider_credentials_org_idx on public.organization_provider_credentials(organization_id);
create index if not exists org_provider_credentials_provider_idx on public.organization_provider_credentials(provider);

drop trigger if exists organization_provider_credentials_updated_at on public.organization_provider_credentials;
create trigger organization_provider_credentials_updated_at
  before update on public.organization_provider_credentials
  for each row execute function public.handle_updated_at();

alter table public.organization_provider_credentials enable row level security;

-- Tenant isolated: org members can read their own masked metadata, no secret columns
drop policy if exists "org_provider_credentials_select_member" on public.organization_provider_credentials;
create policy "org_provider_credentials_select_member"
  on public.organization_provider_credentials for select to authenticated
  using (public.is_org_member(organization_id));

-- No direct insert/update/delete for authenticated — service_role only via server actions with explicit checks
-- Intentionally no insert/update/delete policies for authenticated
