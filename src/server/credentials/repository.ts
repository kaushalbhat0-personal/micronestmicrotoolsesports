import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret, decryptSecret } from "./crypto";

export type Provider = "twitch" | "youtube" | "kick";

export type ProviderCredentialRow = {
  id: string;
  organization_id: string;
  provider: Provider;
  encrypted_client_id: string | null;
  encrypted_client_secret: string | null;
  encrypted_api_key: string | null;
  client_id_masked: string | null;
  api_key_masked: string | null;
  last_tested_at: string | null;
  last_test_status: "success" | "failed" | null;
  created_at: string;
  updated_at: string;
  // OAuth (nullable, additive)
  encrypted_access_token?: string | null;
  encrypted_refresh_token?: string | null;
  access_token_expires_at?: string | null;
  scope?: string | null;
  external_account_id?: string | null;
  external_account_login?: string | null;
  authorized_at?: string | null;
};

/** Server-only decrypted view — includes OAuth tokens */
export type ProviderCredentialSecretView = {
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string | null;
  scope?: string | null;
  externalAccountId?: string | null;
  externalAccountLogin?: string | null;
  authorizedAt?: string | null;
};

/** Client-safe masked view — never includes secrets/tokens */
export type ProviderCredentialMaskedView = {
  configured: boolean;
  clientIdMasked?: string | null;
  apiKeyMasked?: string | null;
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
  // OAuth masked presence (no token)
  hasOAuth?: boolean;
  externalAccountLogin?: string | null;
  authorizedAt?: string | null;
};

function mask(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

export async function upsertProviderCredential(
  supabase: SupabaseClient,
  organizationId: string,
  provider: Provider,
  input: { clientId?: string; clientSecret?: string; apiKey?: string },
): Promise<ProviderCredentialRow> {
  const payload: Record<string, unknown> = {
    organization_id: organizationId,
    provider,
    updated_at: new Date().toISOString(),
  };
  if (input.clientId !== undefined) {
    payload.encrypted_client_id = input.clientId ? encryptSecret(input.clientId) : null;
    payload.client_id_masked = input.clientId ? mask(input.clientId) : null;
  }
  if (input.clientSecret !== undefined) {
    payload.encrypted_client_secret = input.clientSecret ? encryptSecret(input.clientSecret) : null;
  }
  if (input.apiKey !== undefined) {
    payload.encrypted_api_key = input.apiKey ? encryptSecret(input.apiKey) : null;
    payload.api_key_masked = input.apiKey ? mask(input.apiKey) : null;
  }

  const { data, error } = await supabase
    .from("organization_provider_credentials")
    .upsert(payload, { onConflict: "organization_id,provider" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProviderCredentialRow;
}

export async function getProviderCredentialRow(
  supabase: SupabaseClient,
  organizationId: string,
  provider: Provider,
): Promise<ProviderCredentialRow | null> {
  const { data, error } = await supabase
    .from("organization_provider_credentials")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) return null;
  return (data as ProviderCredentialRow | null) ?? null;
}

/** Batched fetch — single query for all providers of an org (replaces ×3 round-trips) */
export async function listProviderCredentialsByOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Record<Provider, ProviderCredentialRow | null>> {
  const { data, error } = await supabase
    .from("organization_provider_credentials")
    .select("*")
    .eq("organization_id", organizationId)
    .in("provider", ["twitch", "youtube", "kick"]);
  if (error || !data) return { twitch: null, youtube: null, kick: null };
  const byProvider: Record<Provider, ProviderCredentialRow | null> = { twitch: null, youtube: null, kick: null };
  for (const row of data as ProviderCredentialRow[]) {
    if (row.provider === "twitch" || row.provider === "youtube" || row.provider === "kick") {
      byProvider[row.provider as Provider] = row;
    }
  }
  return byProvider;
}

/** Decrypts only server-side — never call from client components */
export function decryptRow(row: ProviderCredentialRow | null): ProviderCredentialSecretView | null {
  if (!row) return null;
  const out: ProviderCredentialSecretView = {};
  if (row.encrypted_client_id) {
    try {
      out.clientId = decryptSecret(row.encrypted_client_id);
    } catch {}
  }
  if (row.encrypted_client_secret) {
    try {
      out.clientSecret = decryptSecret(row.encrypted_client_secret);
    } catch {}
  }
  if (row.encrypted_api_key) {
    try {
      out.apiKey = decryptSecret(row.encrypted_api_key);
    } catch {}
  }
  if (row.encrypted_access_token) {
    try {
      out.accessToken = decryptSecret(row.encrypted_access_token);
    } catch {}
  }
  if (row.encrypted_refresh_token) {
    try {
      out.refreshToken = decryptSecret(row.encrypted_refresh_token);
    } catch {}
  }
  out.accessTokenExpiresAt = row.access_token_expires_at ?? null;
  out.scope = row.scope ?? null;
  out.externalAccountId = row.external_account_id ?? null;
  out.externalAccountLogin = row.external_account_login ?? null;
  out.authorizedAt = row.authorized_at ?? null;
  // Return null only if no legacy secret and no OAuth token material
  const hasSecret = out.clientId || out.clientSecret || out.apiKey || out.accessToken || out.refreshToken;
  if (!hasSecret && !out.accessTokenExpiresAt && !out.scope && !out.externalAccountId) return null;
  // For legacy callers that only check clientId/secret/apiKey, still return object with those fields
  if (!out.clientId && !out.clientSecret && !out.apiKey && (out.accessToken || out.refreshToken)) return out;
  if (Object.keys(out).length === 0) return null;
  return out;
}

/** Safe view for UI — never includes secrets/tokens */
export function toMaskedView(row: ProviderCredentialRow | null): ProviderCredentialMaskedView {
  if (!row) return { configured: false };
  const hasTwitchKick = !!(row.encrypted_client_id || row.encrypted_client_secret);
  const hasYouTube = !!row.encrypted_api_key;
  const hasOAuth = !!(row.encrypted_access_token || row.encrypted_refresh_token);
  return {
    configured: hasTwitchKick || hasYouTube || hasOAuth,
    clientIdMasked: row.client_id_masked ?? null,
    apiKeyMasked: row.api_key_masked ?? null,
    lastTestedAt: row.last_tested_at ?? null,
    lastTestStatus: row.last_test_status ?? null,
    hasOAuth,
    externalAccountLogin: row.external_account_login ?? null,
    authorizedAt: row.authorized_at ?? null,
  };
}

/** OAuth: persist encrypted tokens — server-only */
export async function upsertOAuthTokens(
  supabase: SupabaseClient,
  organizationId: string,
  provider: Provider,
  input: {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: string | null;
    scope?: string | null;
    externalAccountId?: string | null;
    externalAccountLogin?: string | null;
  },
): Promise<ProviderCredentialRow> {
  const payload: Record<string, unknown> = {
    organization_id: organizationId,
    provider,
    encrypted_access_token: encryptSecret(input.accessToken),
    access_token_expires_at: input.expiresAt ?? null,
    scope: input.scope ?? null,
    external_account_id: input.externalAccountId ?? null,
    external_account_login: input.externalAccountLogin ?? null,
    authorized_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.refreshToken !== undefined) {
    payload.encrypted_refresh_token = input.refreshToken ? encryptSecret(input.refreshToken) : null;
  }
  const { data, error } = await supabase
    .from("organization_provider_credentials")
    .upsert(payload, { onConflict: "organization_id,provider" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProviderCredentialRow;
}

export async function clearOAuthTokens(supabase: SupabaseClient, organizationId: string, provider: Provider): Promise<void> {
  const { error } = await supabase
    .from("organization_provider_credentials")
    .update({
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      access_token_expires_at: null,
      scope: null,
      external_account_id: null,
      external_account_login: null,
      authorized_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("provider", provider);
  if (error) throw error;
}

export async function updateLastTest(
  supabase: SupabaseClient,
  organizationId: string,
  provider: Provider,
  status: "success" | "failed",
): Promise<void> {
  await supabase
    .from("organization_provider_credentials")
    .update({ last_tested_at: new Date().toISOString(), last_test_status: status })
    .eq("organization_id", organizationId)
    .eq("provider", provider);
}

export async function deleteProviderCredential(supabase: SupabaseClient, organizationId: string, provider: Provider): Promise<void> {
  const { error } = await supabase.from("organization_provider_credentials").delete().eq("organization_id", organizationId).eq("provider", provider);
  if (error) throw error;
}
