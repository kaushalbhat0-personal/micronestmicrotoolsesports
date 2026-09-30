import type { SupabaseClient } from "@supabase/supabase-js";
import { getProviderCredentialRow, decryptRow } from "./repository";

/**
 * Precedence:
 * 1. Organization credential (DB, decrypted server-side)
 * 2. Platform environment credential
 * Documented explicitly — no ambiguous fallback.
 */
export type ResolvedTwitchCreds = { clientId: string; clientSecret: string; source: "organization" | "env" } | null;
export type ResolvedYouTubeCreds = { apiKey: string; source: "organization" | "env" } | null;
export type ResolvedKickCreds = { clientId: string; clientSecret: string; source: "organization" | "env" } | null;

export async function resolveTwitchCredentials(supabase: SupabaseClient, organizationId: string): Promise<ResolvedTwitchCreds> {
  const row = await getProviderCredentialRow(supabase, organizationId, "twitch");
  const dec = decryptRow(row);
  if (dec?.clientId && dec?.clientSecret) {
    return { clientId: dec.clientId, clientSecret: dec.clientSecret, source: "organization" };
  }
  const envId = process.env.TWITCH_CLIENT_ID;
  const envSecret = process.env.TWITCH_CLIENT_SECRET;
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret, source: "env" };
  return null;
}

export async function resolveYouTubeCredentials(supabase: SupabaseClient, organizationId: string): Promise<ResolvedYouTubeCreds> {
  const row = await getProviderCredentialRow(supabase, organizationId, "youtube");
  const dec = decryptRow(row);
  if (dec?.apiKey) return { apiKey: dec.apiKey, source: "organization" };
  const envKey = process.env.YOUTUBE_API_KEY;
  if (envKey) return { apiKey: envKey, source: "env" };
  return null;
}

export async function resolveKickCredentials(supabase: SupabaseClient, organizationId: string): Promise<ResolvedKickCreds> {
  const row = await getProviderCredentialRow(supabase, organizationId, "kick");
  const dec = decryptRow(row);
  if (dec?.clientId && dec?.clientSecret) return { clientId: dec.clientId, clientSecret: dec.clientSecret, source: "organization" };
  const envId = process.env.KICK_CLIENT_ID;
  const envSecret = process.env.KICK_CLIENT_SECRET;
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret, source: "env" };
  return null;
}
