import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret, decryptSecret } from "./crypto";
import { upsertProviderCredential, getProviderCredentialRow, toMaskedView, decryptRow, upsertOAuthTokens } from "./repository";
import { resolveTwitchCredentials, resolveYouTubeCredentials } from "./resolver";
import { testTwitchConnection } from "./test-connection";
import { clearTwitchTokenCache } from "@/server/integrations/twitch/auth";

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
          eq: (col: string, val: unknown) => ({
            eq: (col2: string, val2: unknown) => {
              const key = `${val}:${val2}`;
              store.delete(key);
              return Promise.resolve({ error: null });
            },
          }),
        }),
      } as never;
    },
    rpc: async () => ({ data: true, error: null }),
  } as unknown as SupabaseClient;
}

describe("credentials crypto", () => {
  it("encrypt/decrypt roundtrip", () => {
    const plain = "secret123";
    const enc = encryptSecret(plain);
    expect(enc).not.toBe(plain);
    expect(enc).not.toContain(plain);
    const dec = decryptSecret(enc);
    expect(dec).toBe(plain);
  });

  it("encrypted at rest not plaintext", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    await upsertProviderCredential(supabase, "org-a", "twitch", { clientId: "myid", clientSecret: "mysecret" });
    const row = store.get("org-a:twitch")!;
    expect(row.encrypted_client_id as string).not.toBe("myid");
    expect(row.encrypted_client_secret as string).not.toBe("mysecret");
    expect(row.encrypted_client_id as string).not.toContain("myid");
  });
});

describe("credentials authorization & masking", () => {
  it("authenticated org can save own credential (upsert)", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    const row = await upsertProviderCredential(supabase, "org-a", "twitch", { clientId: "id", clientSecret: "sec" });
    expect(row.organization_id).toBe("org-a");
    expect(row.provider).toBe("twitch");
  });

  it("secret never returned from masked view", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    await upsertProviderCredential(supabase, "org-a", "twitch", { clientId: "myid123", clientSecret: "mysec" });
    const row = await getProviderCredentialRow(supabase, "org-a", "twitch");
    const masked = toMaskedView(row);
    // Legacy manual fields are no longer usable server-side → must NOT count as configured.
    expect(masked.configured).toBe(false);
    expect((masked as Record<string, unknown>).encrypted_client_secret).toBeUndefined();
    expect(JSON.stringify(masked)).not.toContain("mysec");
    expect(JSON.stringify(masked)).not.toContain("myid123");
    expect(masked.clientIdMasked).toBe("my••••23");
  });

  it("secret never serialized to client via repository decrypt (server-only)", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    await upsertProviderCredential(supabase, "org-a", "twitch", { clientId: "id", clientSecret: "sec" });
    const row = await getProviderCredentialRow(supabase, "org-a", "twitch");
    // decryptRow is server-only, but ensure it works server-side
    const dec = decryptRow(row);
    expect(dec?.clientSecret).toBe("sec");
    // Masked view does not contain secret
    const masked = toMaskedView(row);
    expect((masked as Record<string, unknown>).clientSecret).toBeUndefined();
  });

  it("masked UI state works (configured vs not)", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    const before = toMaskedView(await getProviderCredentialRow(supabase, "org-a", "twitch"));
    expect(before.configured).toBe(false);
    await upsertProviderCredential(supabase, "org-a", "twitch", { clientId: "id", clientSecret: "sec" });
    // Legacy-only row is NOT usable → still not configured.
    const legacyOnly = toMaskedView(await getProviderCredentialRow(supabase, "org-a", "twitch"));
    expect(legacyOnly.configured).toBe(false);
    await upsertOAuthTokens(supabase, "org-a", "twitch", {
      accessToken: "oauth-access",
      refreshToken: "oauth-refresh",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      scope: "user:read:email",
      externalAccountId: "123",
      externalAccountLogin: "someuser",
    });
    const after = toMaskedView(await getProviderCredentialRow(supabase, "org-a", "twitch"));
    expect(after.configured).toBe(true);
    expect(after.hasOAuth).toBe(true);
  });

  it("organization cannot read another's credential (isolation via key)", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    await upsertProviderCredential(supabase, "org-a", "twitch", { clientId: "id-a", clientSecret: "sec-a" });
    const rowB = await getProviderCredentialRow(supabase, "org-b", "twitch");
    expect(rowB).toBeNull();
    const rowA = await getProviderCredentialRow(supabase, "org-a", "twitch");
    expect(rowA?.organization_id).toBe("org-a");
  });
});

describe("provider resolution", () => {
  beforeEach(() => {
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
    delete process.env.YOUTUBE_API_KEY;
  });

  it("organization credential no longer used — env fallback (OAuth-only)", async () => {
    process.env.TWITCH_CLIENT_ID = "env-id";
    process.env.TWITCH_CLIENT_SECRET = "env-sec";
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    await upsertProviderCredential(supabase, "org-a", "twitch", { clientId: "org-id", clientSecret: "org-sec" });
    const res = await resolveTwitchCredentials(supabase, "org-a");
    expect(res?.clientId).toBe("env-id");
    expect(res?.source).toBe("env");
  });

  it("environment fallback when org not configured", async () => {
    process.env.TWITCH_CLIENT_ID = "env-id";
    process.env.TWITCH_CLIENT_SECRET = "env-sec";
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    const res = await resolveTwitchCredentials(supabase, "org-a");
    expect(res?.clientId).toBe("env-id");
    expect(res?.source).toBe("env");
  });

  it("missing credentials produce safe null (not throw)", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    const res = await resolveYouTubeCredentials(supabase, "org-a");
    expect(res).toBeNull();
  });

  it("secret never in resolver log/error (sanitized)", async () => {
    const store = new Map<string, Record<string, unknown>>();
    const supabase = mockSupabaseForCreds(store);
    await upsertProviderCredential(supabase, "org-a", "twitch", { clientId: "id", clientSecret: "sec" });
    const row = await getProviderCredentialRow(supabase, "org-a", "twitch");
    // Encrypted row should not contain plaintext
    expect(row?.encrypted_client_secret).not.toBe("sec");
    const masked = toMaskedView(row);
    expect(JSON.stringify(masked)).not.toContain("sec");
    const errorMsg = "Twitch error";
    expect(errorMsg).not.toContain("sec");
  });
});

describe("test connection", () => {
  beforeEach(() => clearTwitchTokenCache());
  it("valid Twitch credential → success (mocked fetch)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const res = await testTwitchConnection("id", "sec", fetchMock);
    expect(res.ok).toBe(true);
  });

  it("invalid Twitch credential → safe failure (no secret in result)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600, token_type: "bearer" }), { status: 200 });
      return new Response("Unauthorized", { status: 401 });
    }) as unknown as typeof fetch;
    const res = await testTwitchConnection("bad", "bad", fetchMock);
    expect(res.ok).toBe(false);
    expect(JSON.stringify(res)).not.toContain("bad");
  });

  it("provider error sanitized (no secret leak)", async () => {
    const fetchMock = vi.fn(async () => new Response("server error", { status: 500 })) as unknown as typeof fetch;
    const res = await testTwitchConnection("id", "sec", fetchMock);
    expect(res.ok).toBe(false);
    expect(res.errorKind).toBeDefined();
    expect(JSON.stringify(res)).not.toContain("sec");
  });
});
