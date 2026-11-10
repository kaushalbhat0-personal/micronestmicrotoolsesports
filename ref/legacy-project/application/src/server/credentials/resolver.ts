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
  // Customer per-org clientId/secret removed — OAuth/app-token uses env only.
  void getProviderCredentialRow;
  void decryptRow;
  void supabase;
  void organizationId;
  const envId = process.env.TWITCH_CLIENT_ID;
  const envSecret = process.env.TWITCH_CLIENT_SECRET;
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret, source: "env" };
  return null;
}

export async function resolveYouTubeCredentials(supabase: SupabaseClient, organizationId: string): Promise<ResolvedYouTubeCreds> {
  // Customer per-org apiKey removed — OAuth-only. Only platform env fallback remains.
  void getProviderCredentialRow;
  void decryptRow;
  void organizationId;
  void supabase;
  const envKey = process.env.YOUTUBE_API_KEY;
  if (envKey) return { apiKey: envKey, source: "env" };
  return null;
}

export async function resolveKickCredentials(supabase: SupabaseClient, organizationId: string): Promise<ResolvedKickCreds> {
  // Customer per-org clientId/secret removed — OAuth/app-token uses env only.
  void getProviderCredentialRow;
  void decryptRow;
  void supabase;
  void organizationId;
  const envId = process.env.KICK_CLIENT_ID;
  const envSecret = process.env.KICK_CLIENT_SECRET;
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret, source: "env" };
  return null;
}
