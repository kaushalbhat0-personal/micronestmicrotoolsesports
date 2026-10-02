import { describe, it, expect, vi, beforeEach } from "vitest";

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
  revalidatePath: vi.fn((...a: unknown[]) => mockRevalidate(...a)),
}));
vi.mock("@/server/credentials/repository", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getProviderCredentialRow: vi.fn(async () => null),
    decryptRow: vi.fn(() => null),
    updateLastTest: vi.fn(async () => {}),
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
vi.mock("@/server/integrations/kick/oauth", () => ({
  getKickUser: vi.fn(async () => ({ id: "kickId123", slug: "kickslug", username: "kickslug" })),
}));

import { testProviderCredential } from "./integration-actions";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("integration-actions testProviderCredential OAuth Kick — RCCF-OAUTH-12A", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRevalidate.mockImplementation(() => {});
  });

  it("OAuth valid → getValidAccessToken kick → getKickUser → ok:true without legacy creds", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: true, accessToken: "kickOAuthTok", expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), provider: "kick" } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "kick" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never);
    const kickOAuth = await import("@/server/integrations/kick/oauth");
    vi.mocked(kickOAuth.getKickUser).mockResolvedValueOnce({ id: "kickId123", slug: "kickslug", username: "kickslug" } as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "kick" }));
    expect(res.ok).toBe(true);
    expect(kickOAuth.getKickUser).toHaveBeenCalledWith("kickOAuthTok");
    expect(JSON.stringify(res)).not.toContain("kickOAuthTok");
  });

  it("OAuth valid succeeds without organization-level legacy Kick credentials", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: true, accessToken: "tok2", expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), provider: "kick" } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "kick" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "kick" }));
    expect(res.ok).toBe(true);
  });

  it("OAuth unavailable → legacy credentials → legacy test", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: false, reason: "not_configured" } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "kick" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({ clientId: "legacyKickId", clientSecret: "legacyKickSecret" } as never);
    const { testKickConnection } = await import("@/server/credentials/test-connection");
    vi.mocked(testKickConnection).mockResolvedValueOnce({ ok: true } as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "kick" }));
    expect(res.ok).toBe(true);
    expect(testKickConnection).toHaveBeenCalledWith("legacyKickId", "legacyKickSecret");
  });

  it("Neither configured → not_configured", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: false, reason: "not_configured" } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "kick" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "kick" }));
    expect(res.ok).toBe(false);
    expect(res.errorKind).toBe("not_configured");
  });

  it("No tokens returned to UI", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: true, accessToken: "superSecretKick", expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), provider: "kick" } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "kick" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "kick" }));
    expect(JSON.stringify(res)).not.toContain("superSecretKick");
    expect((res as Record<string, unknown>).accessToken).toBeUndefined();
    expect((res as Record<string, unknown>).refreshToken).toBeUndefined();
  });

  it("OAuth auth failure maps to errorKind auth", async () => {
    const { getValidAccessToken } = await import("@/server/credentials/token-service");
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ ok: true, accessToken: "tok", expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), provider: "kick" } as never);
    const { getProviderCredentialRow, decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "kick" } as never);
    vi.mocked(decryptRow).mockReturnValueOnce({} as never);
    const kickOAuth = await import("@/server/integrations/kick/oauth");
    vi.mocked(kickOAuth.getKickUser).mockRejectedValueOnce(Object.assign(new Error("auth fail"), { kind: "auth" }));
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "kick" }));
    expect(res.ok).toBe(false);
    expect(res.errorKind).toBe("auth");
  });
});
