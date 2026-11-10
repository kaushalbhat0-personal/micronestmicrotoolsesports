-- OAuth token storage (RCCF OAUTH-02) — additive, nullable, no RLS change
-- Uses existing AES-256-GCM via app key (crypto.ts), no plaintext tokens.

alter table public.organization_provider_credentials
  add column if not exists encrypted_access_token text,
  add column if not exists encrypted_refresh_token text,
  add column if not exists access_token_expires_at timestamptz,
  add column if not exists scope text,
  add column if not exists external_account_id text,
  add column if not exists external_account_login text,
  add column if not exists authorized_at timestamptz;

-- Optional index for expiry checks (token refresh)
create index if not exists org_provider_credentials_expires_idx
  on public.organization_provider_credentials(access_token_expires_at)
  where access_token_expires_at is not null;

-- Note: RLS already covers entire row via is_org_member(organization_id); no new policy needed.
-- No data backfill; legacy client_id/secret/api_key rows remain valid.
