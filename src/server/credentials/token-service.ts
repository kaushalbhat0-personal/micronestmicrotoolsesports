import type { SupabaseClient } from "@supabase/supabase-js";
import type { Provider } from "./repository";
import { getProviderCredentialRow, decryptRow } from "./repository";
import { isPlatform } from "@/features/sponsor-sentinel/types/platform";

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export type ValidAccessTokenResult =
  | { ok: true; accessToken: string; expiresAt: string | null; provider: Provider }
  | { ok: false; reason: "not_configured" | "expired" | "invalid_provider"; error?: string };

/**
 * Provider-neutral token accessor — no provider-specific refresh yet.
 * Later phases will inject refresh logic via `refreshFn` param or separate
 * provider registry. For now, it only checks validity and returns token or
 * controlled error, without inventing refresh.
 *
 * Concurrency note (OAUTH-02): No DB row-level lock is taken here because
 * refresh is not yet implemented. A multi-instance `SELECT ... FOR UPDATE`
 * or `pg_advisory_xact_lock` via RPC will be added in OAUTH-03 when
 * provider-specific `POST /oauth/token grant_type=refresh_token` is implemented.
 * In-memory single-flight alone is insufficient for Vercel multi-instance,
 * so the future refresh must be serialized via Postgres transaction.
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  organizationId: string,
  provider: Provider,
  opts?: { nowMs?: number },
): Promise<ValidAccessTokenResult> {
  if (!organizationId || typeof organizationId !== "string") {
    return { ok: false, reason: "invalid_provider", error: "Invalid organization" };
  }
  if (!isPlatform(provider)) {
    return { ok: false, reason: "invalid_provider", error: "Invalid provider" };
  }

  const nowMs = opts?.nowMs ?? Date.now();
  const row = await getProviderCredentialRow(supabase, organizationId, provider);
  if (!row) return { ok: false, reason: "not_configured" };

  const dec = decryptRow(row);
  // decryptRow now returns null only if no material at all; for OAuth we need accessToken
  const accessToken = dec?.accessToken;
  const expiresAt = dec?.accessTokenExpiresAt ?? row.access_token_expires_at ?? null;

  if (!accessToken) return { ok: false, reason: "not_configured" };

  if (!expiresAt) {
    // No expiry stored — treat as valid (some providers without expiry), but log?
    return { ok: true, accessToken, expiresAt: null, provider };
  }

  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return { ok: false, reason: "expired", error: "Invalid expiry" };

  if (expiresMs - nowMs <= EXPIRY_BUFFER_MS) {
    return { ok: false, reason: "expired", error: "Token expired or near expiry, refresh required" };
  }

  return { ok: true, accessToken, expiresAt, provider };
}

export const TOKEN_EXPIRY_BUFFER_MS = EXPIRY_BUFFER_MS;
