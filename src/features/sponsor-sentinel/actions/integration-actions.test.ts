import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be hoisted before imports
const mockUpsert = vi.fn();
const mockRevalidate = vi.fn();

vi.mock("@/lib/auth/organization-context", () => ({
  requireOrganizationContext: vi.fn(async (slug: string) => ({
    organization: { id: "org-a", slug, name: "Test Org" },
    membership: { role: "owner", id: "mem-1" },
    user: { id: "user-1" },
  })),
}));
vi.mock("@/lib/auth/require-entitlement", () => ({
  requireEntitlement: vi.fn(async () => ({ hasAccess: true })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn((...args: unknown[]) => mockRevalidate(...args)),
}));
vi.mock("@/server/credentials/repository", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    upsertProviderCredential: (...args: unknown[]) => mockUpsert(...args),
    getProviderCredentialRow: vi.fn(async () => null),
    updateLastTest: vi.fn(async () => {}),
    decryptRow: vi.fn(() => null),
    deleteProviderCredential: vi.fn(async () => {}),
  };
});
vi.mock("@/server/credentials/test-connection", () => ({
  testTwitchConnection: vi.fn(async () => ({ ok: true })),
  testKickConnection: vi.fn(async () => ({ ok: true })),
  testYouTubeConnection: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/credentials/token-service", () => ({
  getValidAccessToken: vi.fn(async () => ({ ok: false, reason: "not_configured" })),
}));
vi.mock("@/server/integrations/twitch/client", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    TwitchClient: vi.fn(function (this: unknown) {
      return { getUsersByLogin: vi.fn(async () => ({ data: [] })) };
    }),
  };
});
vi.mock("@/server/integrations/youtube/oauth", () => ({
  getYouTubeChannelForToken: vi.fn(async () => ({ id: "UC123", title: "Mystic Minutes" })),
  exchangeYouTubeCode: vi.fn(async () => ({ access_token: "tok", refresh_token: "ref", expires_in: 3600 })),
  refreshYouTubeToken: vi.fn(async () => ({ access_token: "newTok", expires_in: 3600 })),
}));

import { saveProviderCredential, testProviderCredential, deleteProviderCredential } from "./integration-actions";
import { requireOrganizationContext } from "@/lib/auth/organization-context";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("integration-actions saveProviderCredential — RCCF-SPONSOR-PROVIDER-E2E-00", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ id: "cred-1" });
    mockRevalidate.mockImplementation(() => {});
  });

  it("1. Twitch manual credentials no longer supported → rejected", async () => {
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id123", clientSecret: "sec123" }));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/no longer supported|OAuth/i);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(JSON.stringify(res)).not.toContain("sec123");
  });

  it("1b. YouTube customer apiKey no longer supported → rejected", async () => {
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "youtube", apiKey: "yt-key-123" }));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/OAuth|no longer supported/i);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(JSON.stringify(res)).not.toContain("yt-key-123");
  });

  it("2. Twitch manual entry rejected → safe error, no persistence", async () => {
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id123", clientSecret: "" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no longer supported|OAuth/i);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(JSON.stringify(res)).not.toContain("sec");
  });

  it("2b. Invalid provider → safe error", async () => {
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "bad", clientId: "a", clientSecret: "b" }));
    expect(res.ok).toBe(false);
  });

  it("3. Manual entry rejected before persistence → no DB call", async () => {
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id", clientSecret: "sec" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no longer supported|OAuth/i);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(JSON.stringify(res)).not.toContain("sec");
  });

  it("4. Post-save revalidate not applicable — manual entry rejected", async () => {
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id", clientSecret: "sec" }));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/no longer supported|OAuth/i);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("5. NEXT_REDIRECT is not swallowed — rethrows (auth check)", async () => {
    vi.mocked(requireOrganizationContext).mockRejectedValueOnce(new Error("NEXT_REDIRECT /login") as never);
    await expect(saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch" }))).rejects.toThrow(/NEXT_REDIRECT/);
    vi.mocked(requireOrganizationContext).mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports", name: "Test Org" }, membership: { role: "owner", id: "mem-1" }, user: { id: "user-1" } } as never);
  });

  it("5b. Save no longer persists — manual entry rejected", async () => {
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id", clientSecret: "sec" }));
    expect(res.ok).toBe(false);
  });

  it("6. Auth failure → safe error, no secret leak", async () => {
    vi.mocked(requireOrganizationContext).mockRejectedValueOnce(new Error("NEXT_REDIRECT /login") as never);
    await expect(saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id", clientSecret: "sec" }))).rejects.toThrow(/NEXT_REDIRECT/);
    // restore
    vi.mocked(requireOrganizationContext).mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports", name: "Test Org" }, membership: { role: "owner", id: "mem-1" }, user: { id: "user-1" } } as never);
  });

  it("7. Security — error messages never contain secrets", async () => {
    mockUpsert.mockRejectedValueOnce(new Error("secret leak should not bubble"));
    const secret = "mySuperSecret123";
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "myId", clientSecret: secret }));
    expect(res.ok).toBe(false);
    expect(JSON.stringify(res)).not.toContain(secret);
    expect(JSON.stringify(res)).not.toContain("myId");
  });

  it("8. testProviderCredential OAuth still works and never returns secret", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: true, accessToken: "oauthTok", expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), provider: "twitch" } as never);
    const { TwitchClient } = await import("@/server/integrations/twitch/client");
    vi.mocked(TwitchClient).mockImplementationOnce(function (this: unknown) {
      return { getUsersByLogin: vi.fn(async () => ({ data: [] })) } as unknown as never;
    } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "twitch" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch" }));
    expect(res.ok).toBe(true);
    expect(JSON.stringify(res)).not.toContain("oauthTok");
  });

  it("9. deleteProviderCredential success → ok:true", async () => {
    const res = await deleteProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch" }));
    expect(res).toEqual({ ok: true });
    expect(mockRevalidate).toHaveBeenCalledWith("/dashboard/tag-esports/settings/integrations");
  });

  it("10. delete revalidate failure still ok:true", async () => {
    mockRevalidate.mockImplementationOnce(() => {
      throw new Error("revalidate fail");
    });
    const res = await deleteProviderCredential(fd({ orgSlug: "tag-esports", provider: "youtube" }));
    expect(res).toEqual({ ok: true });
  });
});

describe("integration-actions testProviderCredential OAuth — RCCF-OAUTH-08", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRevalidate.mockImplementation(() => {});
    process.env.TWITCH_CLIENT_ID = "testClientId";
  });

  it("Test 1 — OAuth success → ok:true", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: true, accessToken: "oauthAcc", expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), provider: "twitch" } as never);
    const { TwitchClient } = await import("@/server/integrations/twitch/client");
    const mockGetUsers = vi.fn(async () => ({ data: [{ id: "1", login: "divine1701" }] }));
    vi.mocked(TwitchClient).mockImplementationOnce(function (this: unknown) {
      return { getUsersByLogin: mockGetUsers } as unknown as never;
    } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "twitch" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch" }));
    expect(res.ok).toBe(true);
    expect(mockGetUsers).toHaveBeenCalled();
  });

  it("Test 2 — OAuth success does not require legacy credentials", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: true, accessToken: "oauthAcc2", expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), provider: "twitch" } as never);
    const { TwitchClient } = await import("@/server/integrations/twitch/client");
    vi.mocked(TwitchClient).mockImplementationOnce(function (this: unknown) {
      return { getUsersByLogin: vi.fn(async () => ({ data: [] })) } as unknown as never;
    } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "twitch" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never); // no clientId/secret
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch" }));
    expect(res.ok).toBe(true);
  });

  it("Test 3 — OAuth refresh → succeeds", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    // First call simulates near-expiry then refresh inside getValidAccessToken returns new token
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: true, accessToken: "refreshedAcc", expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), provider: "twitch" } as never);
    const { TwitchClient } = await import("@/server/integrations/twitch/client");
    vi.mocked(TwitchClient).mockImplementationOnce(function (this: unknown) {
      return { getUsersByLogin: vi.fn(async () => ({ data: [] })) } as unknown as never;
    } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "twitch" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch" }));
    expect(res.ok).toBe(true);
  });

  it("Test 4 — OAuth unavailable → not_configured (legacy removed)", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: false, reason: "not_configured" } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "twitch" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({ clientId: "legacyId", clientSecret: "legacySecret" } as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch" }));
    expect(res.ok).toBe(false);
    expect(res.errorKind).toBe("not_configured");
  });

  it("Test 5 — Neither configured → not_configured", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: false, reason: "not_configured" } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "twitch" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch" }));
    expect(res.ok).toBe(false);
    expect(res.errorKind).toBe("not_configured");
  });

  it("Test 6 — OAuth token never returned to browser", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: true, accessToken: "superSecretOAuth", expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), provider: "twitch" } as never);
    const { TwitchClient } = await import("@/server/integrations/twitch/client");
    vi.mocked(TwitchClient).mockImplementationOnce(function (this: unknown) {
      return { getUsersByLogin: vi.fn(async () => ({ data: [] })) } as unknown as never;
    } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "twitch" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch" }));
    expect(JSON.stringify(res)).not.toContain("superSecretOAuth");
    expect((res as Record<string, unknown>).accessToken).toBeUndefined();
    expect((res as Record<string, unknown>).refreshToken).toBeUndefined();
  });
});

describe("integration-actions testProviderCredential OAuth YouTube — RCCF-OAUTH-10", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRevalidate.mockImplementation(() => {});
    process.env.YOUTUBE_CLIENT_ID = "ytClient";
    process.env.YOUTUBE_CLIENT_SECRET = "ytSecret";
  });

  it("YouTube OAuth success without API key", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: true, accessToken: "ytOAuth", expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), provider: "youtube" } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "youtube" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never);
    const youtubeOAuth = await import("@/server/integrations/youtube/oauth");
    vi.mocked(youtubeOAuth.getYouTubeChannelForToken).mockResolvedValueOnce({ id: "UC123", title: "Mystic Minutes" } as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "youtube" }));
    expect(res.ok).toBe(true);
    expect(JSON.stringify(res)).not.toContain("ytOAuth");
  });

  it("YouTube without OAuth → not_configured (legacy apiKey removed)", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: false, reason: "not_configured" } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "youtube" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({ apiKey: "ytApiKey" } as never);
    const { testYouTubeConnection } = await import("@/server/credentials/test-connection");
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "youtube" }));
    expect(res.ok).toBe(false);
    expect(res.errorKind).toBe("not_configured");
    expect(vi.mocked(testYouTubeConnection)).not.toHaveBeenCalled();
  });
});
