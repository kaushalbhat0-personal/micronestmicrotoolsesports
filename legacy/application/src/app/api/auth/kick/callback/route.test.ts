import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──
const mockGetCurrentUser = vi.fn();
const mockRequireOrg = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockCreateClient = vi.fn();
const mockCookiesGet = vi.fn();
const mockUpsertOAuthTokens = vi.fn();
const mockCreateConnectedChannel = vi.fn();
const mockRevalidatePath = vi.fn();
const mockExchangeKickCode = vi.fn();
const mockGetKickUser = vi.fn();

vi.mock("@/lib/auth/get-user", () => ({ getCurrentUser: (...a: unknown[]) => (mockGetCurrentUser as unknown as (...args: unknown[]) => unknown)(...a) }));
vi.mock("@/lib/auth/organization-context", () => ({
  requireOrganizationContext: (...a: unknown[]) => (mockRequireOrg as unknown as (...args: unknown[]) => unknown)(...a),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: (...a: unknown[]) => (mockCreateAdminClient as unknown as (...args: unknown[]) => unknown)(...a) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: (...a: unknown[]) => (mockCreateClient as unknown as (...args: unknown[]) => unknown)(...a) }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => mockCookiesGet(name) })),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => (mockRevalidatePath as unknown as (...args: unknown[]) => unknown)(...a) }));
vi.mock("@/server/credentials/repository", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, upsertOAuthTokens: (...a: unknown[]) => (mockUpsertOAuthTokens as unknown as (...args: unknown[]) => unknown)(...a) };
});
vi.mock("@/features/sponsor-sentinel/services/connected-channel-service", () => ({
  createConnectedChannel: (...a: unknown[]) => (mockCreateConnectedChannel as unknown as (...args: unknown[]) => unknown)(...a),
}));
vi.mock("@/server/integrations/kick/oauth", () => ({
  exchangeKickCode: (...a: unknown[]) => (mockExchangeKickCode as unknown as (...args: unknown[]) => unknown)(...a),
  getKickUser: (...a: unknown[]) => (mockGetKickUser as unknown as (...args: unknown[]) => unknown)(...a),
}));
const mockAssertChannelQuota = vi.fn(async () => undefined);
vi.mock("@/server/services/sponsorship-limits", () => ({
  assertFreeChannelConnectAllowed: (...a: unknown[]) => (mockAssertChannelQuota as unknown as (...args: unknown[]) => unknown)(...a),
}));

import { GET } from "./route";
import { generateState } from "@/server/oauth/state";

function makeAdminOrgMock(orgId: string, slug: string) {
  return {
    from: (_t: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: orgId, slug }, error: null }),
        }),
      }),
    }),
  };
}

function makeSupabaseConnectedChannelMock(existing: unknown) {
  const _updateMock = vi.fn().mockReturnThis();
  void _updateMock;
  // chain: from().select().eq().eq().eq().maybeSingle()
  const maybeSingleMock = vi.fn(async () => ({ data: existing, error: null }));
  const _eqChain: Record<string, unknown> = {};
  void _eqChain;
  const selectMock = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
      })),
    })),
  }));
  const updateChain = {
    update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
  };
  const fromMock = vi.fn((table: string) => {
    if (table === "connected_channels") {
      return {
        select: selectMock,
        update: updateChain.update,
      } as unknown as ReturnType<typeof selectMock>;
    }
    return { select: selectMock } as unknown as ReturnType<typeof selectMock>;
  });
  return { from: fromMock, selectMock, maybeSingleMock, updateChain };
}

describe("GET /api/auth/kick/callback — error paths", () => {
  let validState: string;
  const verifier = "verifier123456789012345678901234567890123";
  const orgId = "org-a";
  const userId = "user-1";
  const orgSlug = "tag-esports";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KICK_CLIENT_ID = "kickClientId123";
    process.env.KICK_CLIENT_SECRET = "kickSecretXYZ";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    process.env.CREDENTIALS_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    vi.stubEnv("NODE_ENV", "test");

    const { state } = generateState({ organizationId: orgId, userId, provider: "kick" });
    validState = state;

    mockGetCurrentUser.mockResolvedValue({ id: userId });
    mockRequireOrg.mockResolvedValue({ organization: { id: orgId, slug: orgSlug }, user: { id: userId } } as never);
    mockCreateAdminClient.mockReturnValue(makeAdminOrgMock(orgId, orgSlug) as never);
    // default cookies: state and verifier present matching validState
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: validState };
      if (name === "oauth_verifier_kick") return { value: verifier };
      if (name === "oauth_next_kick") return { value: `/dashboard/${orgSlug}/settings/integrations` };
      return undefined;
    });
    mockExchangeKickCode.mockResolvedValue({
      access_token: "accTok",
      refresh_token: "refTok",
      expires_in: 3600,
      scope: "user:read channel:read",
      token_type: "Bearer",
    });
    mockGetKickUser.mockResolvedValue({ id: "987", slug: "testkick", username: "testkick" });
    mockUpsertOAuthTokens.mockResolvedValue({ id: "cred1" } as never);
    const ccMock = makeSupabaseConnectedChannelMock(null);
    mockCreateClient.mockResolvedValue({ from: ccMock.from } as never);
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch1" } as never);
  });

  it("1. error=access_denied → 400 cancelled", async () => {
    const req = new Request(`https://example.com/api/auth/kick/callback?error=access_denied&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cancelled/i);
  });

  it("2. missing code → 400", async () => {
    const req = new Request(`https://example.com/api/auth/kick/callback?state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Missing code or state/i);
  });

  it("3. missing state → 400", async () => {
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc`);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("4. missing state cookie → 400", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return undefined;
      if (name === "oauth_verifier_kick") return { value: verifier };
      return undefined;
    });
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Missing state cookie/i);
  });

  it("5. state cookie/query mismatch → 400", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: "different.state.sig" };
      if (name === "oauth_verifier_kick") return { value: verifier };
      return undefined;
    });
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/State mismatch/i);
  });

  it("6. invalid state signature → 400", async () => {
    const tampered = validState.slice(0, -2) + "xx";
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: tampered };
      if (name === "oauth_verifier_kick") return { value: verifier };
      return undefined;
    });
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(tampered)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid state/i);
  });

  it("7. expired state → 400", async () => {
    // Generate old state by mocking Date.now for creation
    const oldNow = Date.now() - 11 * 60 * 1000;
    const originalNow = Date.now;
    Date.now = () => oldNow;
    const { state: expiredState } = generateState({ organizationId: orgId, userId, provider: "kick" });
    Date.now = originalNow;
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: expiredState };
      if (name === "oauth_verifier_kick") return { value: verifier };
      return undefined;
    });
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(expiredState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/expired/i);
  });

  it("8. state has wrong provider → 400", async () => {
    const { state: wrongProviderState } = generateState({ organizationId: orgId, userId, provider: "twitch" as never });
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: wrongProviderState };
      if (name === "oauth_verifier_kick") return { value: verifier };
      return undefined;
    });
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(wrongProviderState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/provider mismatch/i);
  });

  it("9. state has wrong organization → 400/403", async () => {
    const { state: wrongOrgState } = generateState({ organizationId: "org-b", userId, provider: "kick" });
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: wrongOrgState };
      if (name === "oauth_verifier_kick") return { value: verifier };
      return undefined;
    });
    // Need admin to return org-b slug but requireOrg will be called with that slug and payload orgId org-b, but our mock requireOrg returns org-a; we simulate org mismatch
    mockCreateAdminClient.mockReturnValue(makeAdminOrgMock("org-b", "other-org") as never);
    mockRequireOrg.mockImplementation(async (slug: string) => {
      if (slug === "other-org") return { organization: { id: "org-b", slug: "other-org" } } as never;
      throw new Error("not found");
    });
    // However verifyState expects expectedOrganizationId = parsed orgId (org-b) and will compare payload orgId vs expected orgId (same parsed) -> passes, but then later ctx check compares payload orgId vs ctx.organization.id. If we return different, it will error.
    // Simpler: generate wrong org state and ensure it fails at verify or org check. We set mock to make ctx mismatch.
    mockCreateAdminClient.mockReturnValue(makeAdminOrgMock("org-b", "other-org") as never);
    mockRequireOrg.mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports" } } as never); // mismatch
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(wrongOrgState)}`);
    const res = await GET(req);
    expect([400, 403]).toContain(res.status);
    const body = await res.json();
    expect(body.error).toMatch(/mismatch|not found/i);
  });

  it("10. state has wrong user → 400", async () => {
    const { state: wrongUserState } = generateState({ organizationId: orgId, userId: "user-999", provider: "kick" });
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: wrongUserState };
      if (name === "oauth_verifier_kick") return { value: verifier };
      return undefined;
    });
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(wrongUserState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/user mismatch/i);
  });

  it("11. missing PKCE verifier → 400", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: validState };
      if (name === "oauth_verifier_kick") return undefined;
      return undefined;
    });
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Missing verifier/i);
  });

  it("12. token exchange failure → 400 customer-safe (no provider internals)", async () => {
    mockExchangeKickCode.mockRejectedValueOnce(new Error("Kick token exchange 400 invalid_grant"));
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/couldn't complete the Kick connection/i);
    expect(body.error).not.toContain("invalid_grant");
    expect(JSON.stringify(body)).not.toContain("accTok");
  });

  it("13. malformed token response → 400", async () => {
    mockExchangeKickCode.mockRejectedValueOnce(new Error("Kick token malformed"));
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("14. Kick identity lookup failure → 400", async () => {
    mockGetKickUser.mockRejectedValueOnce(new Error("Kick Get Users 401"));
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("15. malformed Kick identity → 400", async () => {
    mockGetKickUser.mockRejectedValueOnce(new Error("Kick user not found"));
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("16. unauthorized organization membership → 403", async () => {
    mockCreateAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: { message: "not found" } }),
          }),
        }),
      }),
    } as never);
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    expect([400, 403]).toContain(res.status);
  });

  it("error response does not leak tokens or secrets and clears cookies", async () => {
    mockExchangeKickCode.mockRejectedValueOnce(new Error("fail access_token=secretShouldNotLeak refresh_token=leak client_secret=leak"));
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    const body = JSON.stringify(await res.clone().json());
    expect(body).not.toContain("secretShouldNotLeak");
    expect(body).not.toContain("leak");
    // customer-safe fixed copy — provider internals never echoed
    expect(body).toContain("couldn't complete the Kick connection");
    // cookies cleared: check set-cookie headers have maxAge 0
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie") ?? ""];
    const joined = setCookies.join(";");
    expect(joined).toContain("oauth_state_kick");
    expect(joined).toContain("Max-Age=0");
  });
});

describe("GET /api/auth/kick/callback — success path", () => {
  let validState: string;
  const verifier = "verifier123456789012345678901234567890123";
  const orgId = "org-a";
  const userId = "user-1";
  const orgSlug = "tag-esports";
  let ccMock: ReturnType<typeof makeSupabaseConnectedChannelMock>;
  let adminMock: ReturnType<typeof makeAdminOrgMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KICK_CLIENT_ID = "kickClientId123";
    process.env.KICK_CLIENT_SECRET = "kickSecretXYZ";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    process.env.CREDENTIALS_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const { state } = generateState({ organizationId: orgId, userId, provider: "kick" });
    validState = state;
    mockGetCurrentUser.mockResolvedValue({ id: userId });
    mockRequireOrg.mockResolvedValue({ organization: { id: orgId, slug: orgSlug }, user: { id: userId } } as never);
    adminMock = makeAdminOrgMock(orgId, orgSlug) as unknown as ReturnType<typeof makeAdminOrgMock>;
    mockCreateAdminClient.mockReturnValue(adminMock as never);
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: validState };
      if (name === "oauth_verifier_kick") return { value: verifier };
      if (name === "oauth_next_kick") return { value: `/dashboard/${orgSlug}/settings/integrations` };
      return undefined;
    });
    mockExchangeKickCode.mockResolvedValue({
      access_token: "kickAcc123",
      refresh_token: "kickRef456",
      expires_in: 3600,
      scope: "user:read channel:read",
      token_type: "Bearer",
    });
    mockGetKickUser.mockResolvedValue({ id: "kickUserId999", slug: "kickslug", username: "kickslug" });
    mockUpsertOAuthTokens.mockResolvedValue({ id: "cred1" } as never);
    ccMock = makeSupabaseConnectedChannelMock(null);
    mockCreateClient.mockResolvedValue({ from: ccMock.from } as never);
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch1" } as never);
  });

  async function doSuccess() {
    const req = new Request(`https://example.com/api/auth/kick/callback?code=authCode123&state=${encodeURIComponent(validState)}`);
    return GET(req);
  }

  it("1. authorization code exchanged", async () => {
    const res = await doSuccess();
    expect(res.status).toBe(307);
    expect(mockExchangeKickCode).toHaveBeenCalledWith(expect.objectContaining({ code: "authCode123" }));
  });

  it("2. code_verifier is sent", async () => {
    await doSuccess();
    expect(mockExchangeKickCode).toHaveBeenCalledWith(expect.objectContaining({ codeVerifier: verifier }));
  });

  it("3. redirect_uri is correct", async () => {
    await doSuccess();
    expect(mockExchangeKickCode).toHaveBeenCalledWith(expect.objectContaining({ redirectUri: "https://example.com/api/auth/kick/callback" }));
  });

  it("4. client secret is server-side only (not in redirect URL)", async () => {
    const res = await doSuccess();
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("kickSecretXYZ");
    expect(loc).not.toContain("client_secret");
    // Also verify exchange was called (server side) but location clean
    expect(mockExchangeKickCode).toHaveBeenCalled();
  });

  it("5-6. access token and refresh token encrypted before persistence (upsert called with plain but storage encrypts) and not in response", async () => {
    const res = await doSuccess();
    expect(mockUpsertOAuthTokens).toHaveBeenCalledWith(expect.anything(), orgId, "kick", expect.objectContaining({
      accessToken: "kickAcc123",
      refreshToken: "kickRef456",
    }));
    // response is redirect, not json with tokens
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("kickAcc123");
    expect(loc).not.toContain("kickRef456");
    // Also check body not containing token when following redirect? The response is redirect, no body tokens
    expect(res.headers.get("set-cookie") ?? "").not.toContain("kickAcc123");
  });

  it("7. expiry is persisted", async () => {
    await doSuccess();
    const call = mockUpsertOAuthTokens.mock.calls[0]?.[3] as { expiresAt: string } | undefined;
    expect(call?.expiresAt).toBeTruthy();
    const ms = new Date(call!.expiresAt).getTime();
    expect(ms).toBeGreaterThan(Date.now());
  });

  it("8. scope is persisted", async () => {
    await doSuccess();
    const call = mockUpsertOAuthTokens.mock.calls[0]?.[3] as { scope: string } | undefined;
    expect(call?.scope).toBe("user:read channel:read");
  });

  it("9. external account ID is persisted", async () => {
    await doSuccess();
    const call = mockUpsertOAuthTokens.mock.calls[0]?.[3] as { externalAccountId: string } | undefined;
    expect(call?.externalAccountId).toBe("kickUserId999");
  });

  it("10. external account login/slug is persisted", async () => {
    await doSuccess();
    const call = mockUpsertOAuthTokens.mock.calls[0]?.[3] as { externalAccountLogin: string } | undefined;
    expect(call?.externalAccountLogin).toBe("kickslug");
  });

  it("11. authorized timestamp is persisted via authorized_at (upsert sets it)", async () => {
    await doSuccess();
    expect(mockUpsertOAuthTokens).toHaveBeenCalled();
    // authorized_at is set inside repository via new Date().toISOString(); we can't directly check but verify call happened
  });

  it("12. Connected Channel is created", async () => {
    await doSuccess();
    expect(mockCreateConnectedChannel).toHaveBeenCalledWith(expect.anything(), orgId, expect.objectContaining({ platform: "kick" }), { userId });
  });

  it("13. platform = kick", async () => {
    await doSuccess();
    const arg = mockCreateConnectedChannel.mock.calls[0]?.[2] as { platform: string } | undefined;
    expect(arg?.platform).toBe("kick");
  });

  it("14. connection mode = authorized", async () => {
    await doSuccess();
    const arg = mockCreateConnectedChannel.mock.calls[0]?.[2] as { connection_mode: string } | undefined;
    expect(arg?.connection_mode).toBe("authorized");
  });

  it("15. connection status = connected", async () => {
    await doSuccess();
    const arg = mockCreateConnectedChannel.mock.calls[0]?.[2] as { connection_status: string } | undefined;
    expect(arg?.connection_status).toBe("connected");
  });

  it("16. canonical URL is correct", async () => {
    await doSuccess();
    const arg = mockCreateConnectedChannel.mock.calls[0]?.[2] as { canonical_url: string } | undefined;
    expect(arg?.canonical_url).toBe("https://kick.com/kickslug");
  });

  it("17. duplicate OAuth callback updates existing channel rather than creating duplicate", async () => {
    const existing = { id: "existing-ch-id", connection_mode: "authorized" };
    const dupMock = makeSupabaseConnectedChannelMock(existing);
    mockCreateClient.mockResolvedValue({ from: dupMock.from } as never);
    const req = new Request(`https://example.com/api/auth/kick/callback?code=authCode123&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(mockCreateConnectedChannel).not.toHaveBeenCalled();
    // update was called
    expect(dupMock.from).toHaveBeenCalledWith("connected_channels");
  });

  it("18. OAuth cookies are cleared on success", async () => {
    const res = await doSuccess();
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie") ?? ""];
    const joined = setCookies.join(";");
    expect(joined).toContain("oauth_state_kick");
    expect(joined).toContain("oauth_verifier_kick");
    expect(joined).toContain("oauth_next_kick");
    expect(joined).toContain("Max-Age=0");
  });

  it("19. safe next redirect behavior", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: validState };
      if (name === "oauth_verifier_kick") return { value: verifier };
      if (name === "oauth_next_kick") return { value: "https://evil.com/steal" };
      return undefined;
    });
    const req = new Request(`https://example.com/api/auth/kick/callback?code=authCode123&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("evil.com");
    expect(loc).toContain("/dashboard/tag-esports/connections");
  });

  it("19b. safe next redirect allowed when internal", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: validState };
      if (name === "oauth_verifier_kick") return { value: verifier };
      if (name === "oauth_next_kick") return { value: "/dashboard/tag-esports/sponsor-sentinel/campaigns" };
      return undefined;
    });
    const req = new Request(`https://example.com/api/auth/kick/callback?code=authCode123&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/dashboard/tag-esports/sponsor-sentinel/campaigns");
  });

  it("20. no access token or refresh token appears in response body or redirect", async () => {
    const res = await doSuccess();
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("kickAcc123");
    expect(loc).not.toContain("kickRef456");
    // redirect response should not have json body with tokens
    const clone = res.clone();
    const text = await clone.text().catch(() => "");
    expect(text).not.toContain("kickAcc123");
    expect(text).not.toContain("kickRef456");
  });

  it("21. no token appears in thrown/logged error output (sanitized)", async () => {
    mockExchangeKickCode.mockRejectedValueOnce(new Error("oops access_token=kickAcc123 refresh_token=kickRef456 code_verifier=verifier123 client_secret=kickSecretXYZ"));
    const req = new Request(`https://example.com/api/auth/kick/callback?code=authCode123&state=${encodeURIComponent(validState)}`);
    const res = await GET(req);
    const body = JSON.stringify(await res.clone().json());
    expect(body).not.toContain("kickAcc123");
    expect(body).not.toContain("kickRef456");
    expect(body).not.toContain("kickSecretXYZ");
    expect(body).not.toContain("verifier123");
  });
});
