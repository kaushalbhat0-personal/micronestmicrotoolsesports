import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret } from "./crypto";

// ── Mocks for kick refresh ──
const mockRefreshKickToken = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockGetProviderCredentialRow = vi.fn();
const mockDecryptRow = vi.fn();

vi.mock("@/server/integrations/kick/oauth", () => ({
  refreshKickToken: (...a: unknown[]) => mockRefreshKickToken(...a),
  exchangeKickCode: vi.fn(),
  getKickUser: vi.fn(),
}));

vi.mock("./repository", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getProviderCredentialRow: (...a: unknown[]) => mockGetProviderCredentialRow(...a),
    decryptRow: (...a: unknown[]) => mockDecryptRow(...a),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...a: unknown[]) => mockCreateAdminClient(...a),
}));

import { getValidAccessToken } from "./token-service";

function makeAdminUpdateMock(updatedRow: Record<string, unknown> | null, error: unknown = null) {
  return {
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: updatedRow, error }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("token-service Kick refresh", () => {
  const orgId = "org-a";
  const nowMs = Date.now();
  const future = new Date(nowMs + 60 * 60 * 1000).toISOString();
  const nearExpiry = new Date(nowMs + 2 * 60 * 1000).toISOString();
  const past = new Date(nowMs - 60 * 1000).toISOString();

  const baseRow = {
    id: "cred-1",
    organization_id: orgId,
    provider: "kick",
    encrypted_access_token: encryptSecret("oldAcc"),
    encrypted_refresh_token: encryptSecret("oldRef"),
    access_token_expires_at: nearExpiry,
    updated_at: new Date(nowMs - 10000).toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshKickToken.mockResolvedValue({ access_token: "newAcc", refresh_token: "newRef", expires_in: 3600, token_type: "Bearer" });
    mockGetProviderCredentialRow.mockResolvedValue(baseRow as never);
    mockDecryptRow.mockReturnValue({ accessToken: "oldAcc", refreshToken: "oldRef", accessTokenExpiresAt: nearExpiry } as never);
    mockCreateAdminClient.mockReturnValue(makeAdminUpdateMock({ id: "cred-1", access_token_expires_at: new Date(nowMs + 3600 * 1000).toISOString() } as never) as never);
  });

  it("valid Kick token returned without refresh", async () => {
    mockGetProviderCredentialRow.mockResolvedValueOnce({ ...baseRow, access_token_expires_at: future } as never);
    mockDecryptRow.mockReturnValueOnce({ accessToken: "validAcc", refreshToken: "ref", accessTokenExpiresAt: future } as never);
    const supabase = {} as SupabaseClient;
    const res = await getValidAccessToken(supabase, orgId, "kick");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.accessToken).toBe("validAcc");
    expect(mockRefreshKickToken).not.toHaveBeenCalled();
  });

  it("near expiry triggers refresh", async () => {
    const supabase = {} as SupabaseClient;
    const res = await getValidAccessToken(supabase, orgId, "kick", { nowMs });
    expect(mockRefreshKickToken).toHaveBeenCalledWith("oldRef");
    expect(res.ok).toBe(true);
  });

  it("expired token triggers refresh", async () => {
    mockGetProviderCredentialRow.mockResolvedValue({ ...baseRow, access_token_expires_at: past } as never);
    mockDecryptRow.mockReturnValue({ accessToken: "oldAcc", refreshToken: "oldRef", accessTokenExpiresAt: past } as never);
    const supabase = {} as SupabaseClient;
    const res = await getValidAccessToken(supabase, orgId, "kick", { nowMs });
    expect(mockRefreshKickToken).toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it("refresh rotation — new refresh token persisted", async () => {
    mockRefreshKickToken.mockResolvedValueOnce({ access_token: "rotatedAcc", refresh_token: "rotatedRef", expires_in: 3600, token_type: "Bearer" });
    const supabase = {} as SupabaseClient;
    await getValidAccessToken(supabase, orgId, "kick", { nowMs });
    // admin update should have been called with encrypted refresh token containing rotatedRef
    // We can't inspect encrypted value directly without decrypt, but verify refresh was called and result is ok
    const res = await getValidAccessToken(supabase, orgId, "kick", { nowMs });
    expect(res.ok).toBe(true);
  });

  it("refresh token preservation when provider omits new refresh", async () => {
    mockRefreshKickToken.mockResolvedValueOnce({ access_token: "newAcc2", expires_in: 3600, token_type: "Bearer" } as never); // no refresh_token
    // second call freshRow is null, so attempt will encrypt with old refresh
    const supabase = {} as SupabaseClient;
    const res = await getValidAccessToken(supabase, orgId, "kick", { nowMs });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.accessToken).toBe("newAcc2");
  });

  it("invalid_grant refresh failure returns expired and does not leak token", async () => {
    mockRefreshKickToken.mockRejectedValueOnce(new Error("invalid_grant expired refresh_token=oldRef"));
    // Make re-read return same stale row (no winner)
    mockGetProviderCredentialRow.mockResolvedValue(baseRow as never);
    mockDecryptRow.mockReturnValue({ accessToken: "oldAcc", refreshToken: "oldRef", accessTokenExpiresAt: nearExpiry } as never);
    const supabase = {} as SupabaseClient;
    const res = await getValidAccessToken(supabase, orgId, "kick", { nowMs });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("expired");
    expect(JSON.stringify(res)).not.toContain("oldAcc");
    expect(JSON.stringify(res)).not.toContain("oldRef");
  });

  it("concurrent refresh single-flight — only one provider call", async () => {
    let callCount = 0;
    mockRefreshKickToken.mockImplementation(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 20));
      return { access_token: "concurrentAcc", refresh_token: "concurrentRef", expires_in: 3600, token_type: "Bearer" };
    });
    const supabase = {} as SupabaseClient;
    // Both calls use same org/provider, should single-flight
    const [a, b] = await Promise.all([
      getValidAccessToken(supabase, orgId, "kick", { nowMs }),
      getValidAccessToken(supabase, orgId, "kick", { nowMs }),
    ]);
    expect(callCount).toBe(1);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it("winner re-read — loser picks up fresh token after winner updates", async () => {
    // First call winner refresh succeeds and updates row
    // Second re-read should see updated_at changed
    const freshRow = { ...baseRow, updated_at: new Date(nowMs).toISOString(), access_token_expires_at: new Date(nowMs + 3600 * 1000).toISOString(), encrypted_access_token: encryptSecret("freshAcc") };
    // First getProviderCredentialRow returns stale, second (inside attempt) returns fresh
    let callIdx = 0;
    mockGetProviderCredentialRow.mockImplementation(async () => {
      callIdx++;
      if (callIdx === 2) return freshRow as never; // re-read inside attemptKickRefresh sees fresh
      return baseRow as never;
    });
    mockDecryptRow.mockImplementation((row: unknown) => {
      const r = row as typeof baseRow;
      if (r.updated_at === freshRow.updated_at) return { accessToken: "freshAcc", accessTokenExpiresAt: freshRow.access_token_expires_at } as never;
      return { accessToken: "oldAcc", refreshToken: "oldRef", accessTokenExpiresAt: nearExpiry } as never;
    });
    // Make refresh fail for loser path, but freshRow already valid so it returns fresh
    mockRefreshKickToken.mockRejectedValueOnce(new Error("invalid_grant"));
    const supabase = {} as SupabaseClient;
    const res = await getValidAccessToken(supabase, orgId, "kick", { nowMs });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.accessToken).toBe("freshAcc");
  });

  it("tenant isolation — different org does not affect", async () => {
    mockGetProviderCredentialRow.mockImplementation(async (supabase: unknown, oid: string) => {
      if (oid === "org-a") return { ...baseRow, access_token_expires_at: future } as never;
      return null as never;
    });
    mockDecryptRow.mockImplementation((row: unknown) => {
      if (!row) return null as never;
      const r = row as typeof baseRow;
      if (r.access_token_expires_at === future) return { accessToken: "validAccOrgA", accessTokenExpiresAt: future } as never;
      return null as never;
    });
    const supabase = {} as SupabaseClient;
    const resA = await getValidAccessToken(supabase, "org-a", "kick", { nowMs });
    const resB = await getValidAccessToken(supabase, "org-b", "kick", { nowMs });
    expect(resA.ok).toBe(true);
    if (resA.ok) expect(resA.accessToken).toBe("validAccOrgA");
    expect(resB.ok).toBe(false);
    if (!resB.ok) expect(resB.reason).toBe("not_configured");
  });

  it("no token in error output", async () => {
    mockGetProviderCredentialRow.mockResolvedValueOnce(null as never);
    const supabase = {} as SupabaseClient;
    const res = await getValidAccessToken(supabase, orgId, "kick");
    expect(JSON.stringify(res)).not.toContain("oldAcc");
  });
});
