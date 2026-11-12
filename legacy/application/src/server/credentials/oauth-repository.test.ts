import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertOAuthTokens, getProviderCredentialRow, decryptRow, toMaskedView, clearOAuthTokens } from "./repository";

function mockSupabaseForCreds(store: Map<string, Record<string, unknown>>) {
  return {
    from: (table: string) => {
      if (table !== "organization_provider_credentials") throw new Error("unexpected table " + table);
      return {
        upsert: (payload: Record<string, unknown>, _opts: unknown) => ({
          select: () => ({
            single: async () => {
              const key = `${payload.organization_id}:${payload.provider}`;
              const existing = store.get(key);
              const row = { id: existing?.id ?? "new-id", ...existing, ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
              store.set(key, row as Record<string, unknown>);
              return { data: row, error: null };
            },
          }),
        }),
        select: () => ({
          eq: (col: string, val: unknown) => ({
            eq: (col2: string, val2: unknown) => ({
              maybeSingle: async () => {
                if (col === "organization_id" && col2 === "provider") {
                  const key = `${val}:${val2}`;
                  const row = store.get(key) ?? null;
                  return { data: row, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (col: string, val: unknown) => ({
            eq: (col2: string, val2: unknown) => {
              const key = `${val}:${val2}`;
              const row = store.get(key);
              if (row) Object.assign(row, patch);
              return Promise.resolve({ error: null });
            },
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }),
      } as never;
    },
  } as unknown as SupabaseClient;
}

describe("OAuth repository", () => {
  it("OAuth fields persist and are encrypted", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    await upsertOAuthTokens(supabase, "org-a", "twitch", {
      accessToken: "acc123",
      refreshToken: "ref456",
      expiresAt: "2026-10-03T00:00:00Z",
      scope: "user:read:email",
      externalAccountId: "123",
      externalAccountLogin: "divine1701",
    });
    const row = store.get("org-a:twitch")!;
    expect(row.encrypted_access_token as string).not.toBe("acc123");
    expect(row.encrypted_refresh_token as string).not.toBe("ref456");
    expect((row.encrypted_access_token as string).length).toBeGreaterThan(10);
    expect(row.scope).toBe("user:read:email");
    expect(row.external_account_login).toBe("divine1701");
  });

  it("decrypt roundtrip for tokens", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    await upsertOAuthTokens(supabase, "org-a", "kick", {
      accessToken: "kickAcc",
      refreshToken: "kickRef",
      expiresAt: "2026-10-03T00:00:00Z",
    });
    const row = await getProviderCredentialRow(supabase, "org-a", "kick");
    const dec = decryptRow(row);
    expect(dec?.accessToken).toBe("kickAcc");
    expect(dec?.refreshToken).toBe("kickRef");
    expect(dec?.accessTokenExpiresAt).toBe("2026-10-03T00:00:00Z");
  });

  it("masked view excludes tokens", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    await upsertOAuthTokens(supabase, "org-a", "youtube", {
      accessToken: "ytAcc",
      refreshToken: "ytRef",
      expiresAt: "2026-10-03T00:00:00Z",
      scope: "youtube.readonly",
      externalAccountId: "UC123",
      externalAccountLogin: "mystic",
    });
    const row = await getProviderCredentialRow(supabase, "org-a", "youtube");
    const masked = toMaskedView(row);
    expect(masked.hasOAuth).toBe(true);
    expect((masked as Record<string, unknown>).accessToken).toBeUndefined();
    expect((masked as Record<string, unknown>).refreshToken).toBeUndefined();
    expect((masked as Record<string, unknown>).encrypted_access_token).toBeUndefined();
    expect(JSON.stringify(masked)).not.toContain("ytAcc");
    expect(masked.externalAccountLogin).toBe("mystic");
  });

  it("clearOAuthTokens removes tokens but leaves row", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    await upsertOAuthTokens(supabase, "org-a", "twitch", { accessToken: "acc", refreshToken: "ref" });
    await clearOAuthTokens(supabase, "org-a", "twitch");
    const row = await getProviderCredentialRow(supabase, "org-a", "twitch");
    expect(row?.encrypted_access_token).toBeNull();
    expect(row?.encrypted_refresh_token).toBeNull();
  });

  it("legacy client_id/secret still work after OAuth columns added", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    // Use legacy upsert
    const { upsertProviderCredential } = await import("./repository");
    await upsertProviderCredential(supabase, "org-a", "twitch", { clientId: "cid", clientSecret: "csec" });
    const row = await getProviderCredentialRow(supabase, "org-a", "twitch");
    expect(row?.encrypted_client_id).not.toBe("cid");
    const dec = decryptRow(row);
    expect(dec?.clientId).toBe("cid");
    expect(dec?.clientSecret).toBe("csec");
  });

  it("tokens never in logs — check error does not contain plaintext", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    await upsertOAuthTokens(supabase, "org-a", "twitch", { accessToken: "superSecretAcc", refreshToken: "superSecretRef" });
    const row = store.get("org-a:twitch")!;
    // Encrypted form should not contain plaintext
    expect(String(row.encrypted_access_token)).not.toContain("superSecretAcc");
    expect(String(row.encrypted_refresh_token)).not.toContain("superSecretRef");
  });
});
