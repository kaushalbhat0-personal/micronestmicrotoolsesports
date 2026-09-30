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

/** Decrypts only server-side — never call from client components */
export function decryptRow(row: ProviderCredentialRow | null): { clientId?: string; clientSecret?: string; apiKey?: string } | null {
  if (!row) return null;
  const out: Record<string, string> = {};
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
  if (Object.keys(out).length === 0) return null;
  return out as { clientId?: string; clientSecret?: string; apiKey?: string };
}

/** Safe view for UI — never includes secrets */
export function toMaskedView(row: ProviderCredentialRow | null): { configured: boolean; clientIdMasked?: string | null; apiKeyMasked?: string | null; lastTestedAt?: string | null; lastTestStatus?: string | null } {
  if (!row) return { configured: false };
  const hasTwitchKick = !!(row.encrypted_client_id || row.encrypted_client_secret);
  const hasYouTube = !!row.encrypted_api_key;
  return {
    configured: hasTwitchKick || hasYouTube,
    clientIdMasked: row.client_id_masked ?? null,
    apiKeyMasked: row.api_key_masked ?? null,
    lastTestedAt: row.last_tested_at ?? null,
    lastTestStatus: row.last_test_status ?? null,
  };
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
