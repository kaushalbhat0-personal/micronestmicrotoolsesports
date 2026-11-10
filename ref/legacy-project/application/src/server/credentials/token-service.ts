import type { SupabaseClient } from "@supabase/supabase-js";
import type { Provider } from "./repository";
import { getProviderCredentialRow, decryptRow } from "./repository";
import { isPlatform } from "@/features/sponsor-sentinel/types/platform";
import { encryptSecret } from "./crypto";

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export type ValidAccessTokenResult =
  | { ok: true; accessToken: string; expiresAt: string | null; provider: Provider }
  | { ok: false; reason: "not_configured" | "expired" | "invalid_provider"; error?: string };

/**
 * Provider-neutral token accessor with Twitch refresh (optimistic concurrency).
 * Other providers (YouTube/Kick) currently return expired without refresh —
 * they will be added in later phases.
 *
 * Concurrency: uses optimistic `updated_at` check (`UPDATE ... WHERE id=... AND updated_at=old`)
 * so multi-instance Vercel refreshes do not overwrite each other; loser re-reads
 * fresh token. This is multi-instance safe without Redis, without holding a
 * long-lived advisory lock. Future hard lock via `SELECT ... FOR UPDATE` RPC
 * can be added if needed.
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
    // Attempt provider-specific refresh if applicable
    if (provider === "twitch") {
      const refreshToken = dec?.refreshToken;
      if (!refreshToken) return { ok: false, reason: "expired", error: "Token expired, no refresh token" };
      const refreshed = await attemptTwitchRefresh(supabase, row, refreshToken, nowMs);
      if (refreshed) return refreshed;
      return { ok: false, reason: "expired", error: "Token refresh failed" };
    }
    if (provider === "youtube") {
      const refreshToken = dec?.refreshToken;
      if (!refreshToken) return { ok: false, reason: "expired", error: "Token expired, no refresh token" };
      const refreshed = await attemptYouTubeRefresh(supabase, row, refreshToken, nowMs);
      if (refreshed) return refreshed;
      return { ok: false, reason: "expired", error: "Token refresh failed" };
    }
    if (provider === "kick") {
      const refreshToken = dec?.refreshToken;
      if (!refreshToken) return { ok: false, reason: "expired", error: "Token expired, no refresh token" };
      const refreshed = await attemptKickRefresh(supabase, row, refreshToken, nowMs);
      if (refreshed) return refreshed;
      return { ok: false, reason: "expired", error: "Token refresh failed" };
    }
    return { ok: false, reason: "expired", error: "Token expired or near expiry, refresh required" };
  }

  return { ok: true, accessToken, expiresAt, provider };
}

async function attemptTwitchRefresh(
  supabase: SupabaseClient,
  row: NonNullable<Awaited<ReturnType<typeof getProviderCredentialRow>>>,
  refreshToken: string,
  nowMs: number,
): Promise<ValidAccessTokenResult | null> {
  // Single-flight in-process map to avoid duplicate refreshes in same instance
  const key = `${row.organization_id}:${row.provider}`;
  const pending = refreshInFlight.get(key);
  if (pending) {
    try {
      const res = await pending;
      return res;
    } catch {
      // fall through to try again
    }
  }
  const promise = (async (): Promise<ValidAccessTokenResult | null> => {
    // Re-read to see if another instance already refreshed while we waited
    const freshRow = await getProviderCredentialRow(supabase, row.organization_id, row.provider as Provider);
    if (freshRow && freshRow.id === row.id && freshRow.updated_at !== row.updated_at) {
      const dec2 = decryptRow(freshRow);
      const at2 = dec2?.accessToken;
      const exp2 = dec2?.accessTokenExpiresAt ?? freshRow.access_token_expires_at ?? null;
      if (at2 && exp2) {
        const expMs2 = new Date(exp2).getTime();
        if (!Number.isNaN(expMs2) && expMs2 - nowMs > EXPIRY_BUFFER_MS) {
          return { ok: true, accessToken: at2, expiresAt: exp2, provider: row.provider as Provider };
        }
      }
    }

    let tokenData: { access_token: string; refresh_token?: string; expires_in: number };
    try {
      const { refreshTwitchToken } = await import("@/server/integrations/twitch/oauth");
      tokenData = await refreshTwitchToken(refreshToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
      console.warn(`[twitch refresh failed] ${msg}`);
      // If refresh failed due to rotation (invalid_grant), another instance may have already refreshed — re-read fresh token
      const reReadAfterFail = await getProviderCredentialRow(supabase, row.organization_id, row.provider as Provider);
      if (reReadAfterFail && reReadAfterFail.updated_at !== row.updated_at) {
        const decFail = decryptRow(reReadAfterFail);
        if (decFail?.accessToken) {
          const expFail = decFail.accessTokenExpiresAt ?? reReadAfterFail.access_token_expires_at ?? null;
          if (expFail) {
            const expMsFail = new Date(expFail).getTime();
            if (!Number.isNaN(expMsFail) && expMsFail - nowMs > EXPIRY_BUFFER_MS) {
              return { ok: true, accessToken: decFail.accessToken, expiresAt: expFail, provider: row.provider as Provider };
            }
          } else {
            return { ok: true, accessToken: decFail.accessToken, expiresAt: null, provider: row.provider as Provider };
          }
        }
      }
      return null;
    }

    const newExpiresAt = new Date(nowMs + tokenData.expires_in * 1000).toISOString();
    const newAccessEncrypted = encryptSecret(tokenData.access_token);
    const newRefreshEncrypted = tokenData.refresh_token ? encryptSecret(tokenData.refresh_token) : row.encrypted_refresh_token;

    // Optimistic update: only if updated_at still matches old
    const admin = await getAdminClientSafe(supabase);
    const client = admin ?? supabase;

    const { data: updated, error } = await (client as SupabaseClient)
      .from("organization_provider_credentials")
      .update({
        encrypted_access_token: newAccessEncrypted,
        encrypted_refresh_token: newRefreshEncrypted,
        access_token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("updated_at", row.updated_at)
      .select("*")
      .maybeSingle();

    if (error || !updated) {
      // Lost race — re-read fresh
      const reRead = await getProviderCredentialRow(supabase, row.organization_id, row.provider as Provider);
      if (reRead) {
        const dec3 = decryptRow(reRead);
        if (dec3?.accessToken) {
          const exp3 = dec3.accessTokenExpiresAt ?? reRead.access_token_expires_at ?? null;
          if (exp3) {
            const expMs3 = new Date(exp3).getTime();
            if (!Number.isNaN(expMs3) && expMs3 - nowMs > EXPIRY_BUFFER_MS) {
              return { ok: true, accessToken: dec3.accessToken ?? "", expiresAt: exp3, provider: row.provider as Provider };
            }
          } else {
            return { ok: true, accessToken: dec3.accessToken ?? "", expiresAt: null, provider: row.provider as Provider };
          }
        }
      }
      return null;
    }

    const upd = updated as unknown as typeof row;
    return {
      ok: true,
      accessToken: tokenData.access_token,
      expiresAt: (upd as unknown as { access_token_expires_at: string | null }).access_token_expires_at ?? newExpiresAt,
      provider: row.provider as Provider,
    };
  })();

  refreshInFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    refreshInFlight.delete(key);
  }
}

async function attemptYouTubeRefresh(
  supabase: SupabaseClient,
  row: NonNullable<Awaited<ReturnType<typeof getProviderCredentialRow>>>,
  refreshToken: string,
  nowMs: number,
): Promise<ValidAccessTokenResult | null> {
  const key = `${row.organization_id}:${row.provider}`;
  const pending = refreshInFlight.get(key);
  if (pending) {
    try {
      const res = await pending;
      return res;
    } catch {}
  }
  const promise = (async (): Promise<ValidAccessTokenResult | null> => {
    const freshRow = await getProviderCredentialRow(supabase, row.organization_id, row.provider as Provider);
    if (freshRow && freshRow.id === row.id && freshRow.updated_at !== row.updated_at) {
      const dec2 = decryptRow(freshRow);
      const at2 = dec2?.accessToken;
      const exp2 = dec2?.accessTokenExpiresAt ?? freshRow.access_token_expires_at ?? null;
      if (at2 && exp2) {
        const expMs2 = new Date(exp2).getTime();
        if (!Number.isNaN(expMs2) && expMs2 - nowMs > EXPIRY_BUFFER_MS) {
          return { ok: true, accessToken: at2, expiresAt: exp2, provider: row.provider as Provider };
        }
      }
    }
    let tokenData: { access_token: string; refresh_token?: string; expires_in: number };
    try {
      const { refreshYouTubeToken } = await import("@/server/integrations/youtube/oauth");
      tokenData = await refreshYouTubeToken(refreshToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
      console.warn(`[youtube refresh failed] ${msg}`);
      const reReadAfterFail = await getProviderCredentialRow(supabase, row.organization_id, row.provider as Provider);
      if (reReadAfterFail && reReadAfterFail.updated_at !== row.updated_at) {
        const decFail = decryptRow(reReadAfterFail);
        if (decFail?.accessToken) {
          const expFail = decFail.accessTokenExpiresAt ?? reReadAfterFail.access_token_expires_at ?? null;
          if (expFail) {
            const expMsFail = new Date(expFail).getTime();
            if (!Number.isNaN(expMsFail) && expMsFail - nowMs > EXPIRY_BUFFER_MS) {
              return { ok: true, accessToken: decFail.accessToken, expiresAt: expFail, provider: row.provider as Provider };
            }
          } else {
            return { ok: true, accessToken: decFail.accessToken, expiresAt: null, provider: row.provider as Provider };
          }
        }
      }
      return null;
    }
    const newExpiresAt = new Date(nowMs + tokenData.expires_in * 1000).toISOString();
    const newAccessEncrypted = encryptSecret(tokenData.access_token);
    const newRefreshEncrypted = tokenData.refresh_token ? encryptSecret(tokenData.refresh_token) : row.encrypted_refresh_token;
    const admin = await getAdminClientSafe(supabase);
    const client = admin ?? supabase;
    const { data: updated, error } = await (client as SupabaseClient)
      .from("organization_provider_credentials")
      .update({
        encrypted_access_token: newAccessEncrypted,
        encrypted_refresh_token: newRefreshEncrypted,
        access_token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("updated_at", row.updated_at)
      .select("*")
      .maybeSingle();
    if (error || !updated) {
      const reRead = await getProviderCredentialRow(supabase, row.organization_id, row.provider as Provider);
      if (reRead) {
        const dec3 = decryptRow(reRead);
        if (dec3?.accessToken) {
          const exp3 = dec3.accessTokenExpiresAt ?? reRead.access_token_expires_at ?? null;
          if (exp3) {
            const expMs3 = new Date(exp3).getTime();
            if (!Number.isNaN(expMs3) && expMs3 - nowMs > EXPIRY_BUFFER_MS) {
              return { ok: true, accessToken: dec3.accessToken ?? "", expiresAt: exp3, provider: row.provider as Provider };
            }
          } else {
            return { ok: true, accessToken: dec3.accessToken ?? "", expiresAt: null, provider: row.provider as Provider };
          }
        }
      }
      return null;
    }
    const upd = updated as unknown as typeof row;
    return {
      ok: true,
      accessToken: tokenData.access_token,
      expiresAt: (upd as unknown as { access_token_expires_at: string | null }).access_token_expires_at ?? newExpiresAt,
      provider: row.provider as Provider,
    };
  })();
  refreshInFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    refreshInFlight.delete(key);
  }
}

async function attemptKickRefresh(
  supabase: SupabaseClient,
  row: NonNullable<Awaited<ReturnType<typeof getProviderCredentialRow>>>,
  refreshToken: string,
  nowMs: number,
): Promise<ValidAccessTokenResult | null> {
  const key = `${row.organization_id}:${row.provider}`;
  const pending = refreshInFlight.get(key);
  if (pending) {
    try {
      const res = await pending;
      return res;
    } catch {}
  }
  const promise = (async (): Promise<ValidAccessTokenResult | null> => {
    const freshRow = await getProviderCredentialRow(supabase, row.organization_id, row.provider as Provider);
    if (freshRow && freshRow.id === row.id && freshRow.updated_at !== row.updated_at) {
      const dec2 = decryptRow(freshRow);
      const at2 = dec2?.accessToken;
      const exp2 = dec2?.accessTokenExpiresAt ?? freshRow.access_token_expires_at ?? null;
      if (at2 && exp2) {
        const expMs2 = new Date(exp2).getTime();
        if (!Number.isNaN(expMs2) && expMs2 - nowMs > EXPIRY_BUFFER_MS) {
          return { ok: true, accessToken: at2, expiresAt: exp2, provider: row.provider as Provider };
        }
      }
    }
    let tokenData: { access_token: string; refresh_token?: string; expires_in: number };
    try {
      const { refreshKickToken } = await import("@/server/integrations/kick/oauth");
      tokenData = await refreshKickToken(refreshToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
      console.warn(`[kick refresh failed] ${msg}`);
      const reReadAfterFail = await getProviderCredentialRow(supabase, row.organization_id, row.provider as Provider);
      if (reReadAfterFail && reReadAfterFail.updated_at !== row.updated_at) {
        const decFail = decryptRow(reReadAfterFail);
        if (decFail?.accessToken) {
          const expFail = decFail.accessTokenExpiresAt ?? reReadAfterFail.access_token_expires_at ?? null;
          if (expFail) {
            const expMsFail = new Date(expFail).getTime();
            if (!Number.isNaN(expMsFail) && expMsFail - nowMs > EXPIRY_BUFFER_MS) {
              return { ok: true, accessToken: decFail.accessToken, expiresAt: expFail, provider: row.provider as Provider };
            }
          } else {
            return { ok: true, accessToken: decFail.accessToken, expiresAt: null, provider: row.provider as Provider };
          }
        }
      }
      return null;
    }
    const newExpiresAt = new Date(nowMs + tokenData.expires_in * 1000).toISOString();
    const newAccessEncrypted = encryptSecret(tokenData.access_token);
    const newRefreshEncrypted = tokenData.refresh_token ? encryptSecret(tokenData.refresh_token) : row.encrypted_refresh_token;
    const admin = await getAdminClientSafe(supabase);
    const client = admin ?? supabase;
    const { data: updated, error } = await (client as SupabaseClient)
      .from("organization_provider_credentials")
      .update({
        encrypted_access_token: newAccessEncrypted,
        encrypted_refresh_token: newRefreshEncrypted,
        access_token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("updated_at", row.updated_at)
      .select("*")
      .maybeSingle();
    if (error || !updated) {
      const reRead = await getProviderCredentialRow(supabase, row.organization_id, row.provider as Provider);
      if (reRead) {
        const dec3 = decryptRow(reRead);
        if (dec3?.accessToken) {
          const exp3 = dec3.accessTokenExpiresAt ?? reRead.access_token_expires_at ?? null;
          if (exp3) {
            const expMs3 = new Date(exp3).getTime();
            if (!Number.isNaN(expMs3) && expMs3 - nowMs > EXPIRY_BUFFER_MS) {
              return { ok: true, accessToken: dec3.accessToken ?? "", expiresAt: exp3, provider: row.provider as Provider };
            }
          } else {
            return { ok: true, accessToken: dec3.accessToken ?? "", expiresAt: null, provider: row.provider as Provider };
          }
        }
      }
      return null;
    }
    const upd = updated as unknown as typeof row;
    return {
      ok: true,
      accessToken: tokenData.access_token,
      expiresAt: (upd as unknown as { access_token_expires_at: string | null }).access_token_expires_at ?? newExpiresAt,
      provider: row.provider as Provider,
    };
  })();
  refreshInFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    refreshInFlight.delete(key);
  }
}

const refreshInFlight = new Map<string, Promise<ValidAccessTokenResult | null>>();

async function getAdminClientSafe(_supabase: SupabaseClient): Promise<SupabaseClient | null> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    return createAdminClient() as unknown as SupabaseClient;
  } catch {
    return null;
  }
}

export const TOKEN_EXPIRY_BUFFER_MS = EXPIRY_BUFFER_MS;
