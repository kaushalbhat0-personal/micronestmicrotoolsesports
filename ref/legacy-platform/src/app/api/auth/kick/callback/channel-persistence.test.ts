import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (same seams as route.test.ts) ──
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
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: orgId, slug }, error: null }),
        }),
      }),
    }),
  };
}

/** connected_channels mock with controllable update/create outcomes. */
function makeChannelMock(opts: { existing: unknown; updateError?: unknown }) {
  const maybeSingleMock = vi.fn(async () => ({ data: opts.existing, error: null }));
  const updateEq = vi.fn(async () => ({ error: opts.updateError ?? null }));
  const updateMock = vi.fn(() => ({ eq: updateEq }));
  const fromMock = vi.fn(() => ({
    select: () => ({
      eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }),
    }),
    update: updateMock,
  }));
  return { from: fromMock, updateMock, updateEq };
}

describe("GET /api/auth/kick/callback — persistence failure handling", () => {
  const verifier = "verifier123456789012345678901234567890123";
  const orgId = "org-a";
  const userId = "user-1";
  const orgSlug = "tag-esports";
  let validState: string;

  function callbackUrl() {
    return new Request(`https://example.com/api/auth/kick/callback?code=authCode123&state=${encodeURIComponent(validState)}`);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KICK_CLIENT_ID = "kickClientId123";
    process.env.KICK_CLIENT_SECRET = "kickSecretXYZ";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    process.env.CREDENTIALS_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const { state } = generateState({ organizationId: orgId, userId, provider: "kick" });
    validState = state;

    mockGetCurrentUser.mockResolvedValue({ id: userId });
    mockRequireOrg.mockResolvedValue({ organization: { id: orgId, slug: orgSlug }, user: { id: userId } } as never);
    mockCreateAdminClient.mockReturnValue(makeAdminOrgMock(orgId, orgSlug) as never);
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: validState };
      if (name === "oauth_verifier_kick") return { value: verifier };
      return undefined;
    });
    mockExchangeKickCode.mockResolvedValue({ access_token: "kickAcc123", refresh_token: "kickRef456", expires_in: 3600, scope: "user:read channel:read" });
    mockGetKickUser.mockResolvedValue({ id: "kickUserId999", slug: "kickslug", username: "kickslug" });
    mockUpsertOAuthTokens.mockResolvedValue({ id: "cred1" } as never);
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch1" } as never);
    mockCreateClient.mockResolvedValue({ from: makeChannelMock({ existing: null }).from } as never);
  });

  it("success → credential + channel saved → success redirect (no failure flag)", async () => {
    const res = await GET(callbackUrl());
    expect(res.status).toBe(307);
    expect(mockUpsertOAuthTokens).toHaveBeenCalled();
    expect(mockCreateConnectedChannel).toHaveBeenCalledWith(expect.anything(), orgId, expect.objectContaining({ platform: "kick", connection_mode: "authorized" }), { userId });
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("channel_save_failed");
  });

  it("credential save failure → 500 failure UX, never success redirect, no raw DB internals", async () => {
    mockUpsertOAuthTokens.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "org_provider_unique" (uuid 123e4567-e89b-12d3-a456-426614174000)'));
    const res = await GET(callbackUrl());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/couldn't save the connection/i);
    expect(JSON.stringify(body)).not.toContain("duplicate key");
    expect(JSON.stringify(body)).not.toContain("123e4567");
    expect(mockCreateConnectedChannel).not.toHaveBeenCalled();
  });

  it("channel create failure → failure redirect (NOT success), no SQL/RLS/UUID details", async () => {
    mockCreateConnectedChannel.mockRejectedValueOnce(new Error('relation "connected_channels" does not exist at uuid abcdef12-3456-7890-abcd-ef1234567890'));
    const res = await GET(callbackUrl());
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/dashboard/tag-esports/connections");
    expect(loc).toContain("oauth=channel_save_failed");
    expect(loc).toContain("provider=kick");
    expect(loc).not.toContain("connected_channels");
    expect(loc).not.toContain("abcdef12");
  });

  it("channel update failure (duplicate path) → failure redirect", async () => {
    const ch = makeChannelMock({ existing: { id: "existing-ch", connection_mode: "authorized" }, updateError: { message: "new row violates row-level security policy" } });
    mockCreateClient.mockResolvedValue({ from: ch.from } as never);
    const res = await GET(callbackUrl());
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("oauth=channel_save_failed");
    expect(loc).not.toContain("row-level security");
  });

  it("duplicate channel → existing intended behavior (update, success redirect)", async () => {
    const ch = makeChannelMock({ existing: { id: "existing-ch", connection_mode: "authorized" } });
    mockCreateClient.mockResolvedValue({ from: ch.from } as never);
    const res = await GET(callbackUrl());
    expect(res.status).toBe(307);
    expect(mockCreateConnectedChannel).not.toHaveBeenCalled();
    expect(ch.updateMock).toHaveBeenCalled();
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("channel_save_failed");
  });

  it("free channel quota → quota_exceeded redirect (OAuth callback cannot bypass limits)", async () => {
    mockCreateConnectedChannel.mockRejectedValueOnce(
      new Error("You're using your free channel slot. Disconnect it to connect a different channel — or upgrade for unlimited channels."),
    );
    const res = await GET(callbackUrl());
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("oauth=quota_exceeded");
    expect(loc).toContain("provider=kick");
  });

  it("cross-org OAuth state cannot attach another org's channel", async () => {
    const { state: otherOrgState } = generateState({ organizationId: "org-b", userId, provider: "kick" });
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === "oauth_state_kick") return { value: otherOrgState };
      if (name === "oauth_verifier_kick") return { value: verifier };
      return undefined;
    });
    mockCreateAdminClient.mockReturnValue(makeAdminOrgMock("org-b", "other-org") as never);
    // Attacker is a member of org-a only; org lookup for org-b resolves to a
    // context the attacker is not entitled to here → mismatch/deny.
    mockRequireOrg.mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports" } } as never);
    const req = new Request(`https://example.com/api/auth/kick/callback?code=abc&state=${encodeURIComponent(otherOrgState)}`);
    const res = await GET(req);
    expect([400, 403]).toContain(res.status);
    expect(mockUpsertOAuthTokens).not.toHaveBeenCalled();
    expect(mockCreateConnectedChannel).not.toHaveBeenCalled();
  });

  it("no secrets in logs or responses on channel failure", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateConnectedChannel.mockRejectedValueOnce(new Error("db down"));
    const res = await GET(callbackUrl());
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("kickAcc123");
    expect(loc).not.toContain("kickRef456");
    const logged = errSpy.mock.calls.map((c) => String(c[1] ?? c[0])).join(" ");
    expect(logged).not.toContain("kickAcc123");
    expect(logged).not.toContain("kickRef456");
    errSpy.mockRestore();
  });
});
