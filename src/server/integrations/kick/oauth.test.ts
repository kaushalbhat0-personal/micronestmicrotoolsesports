import { describe, it, expect, vi, beforeEach } from "vitest";
import { exchangeKickCode, refreshKickToken, getKickUser } from "./oauth";

describe("kick oauth service — exchangeKickCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KICK_CLIENT_ID = "kickId";
    process.env.KICK_CLIENT_SECRET = "kickSecret";
  });

  it("correct endpoint and grant type, code, verifier, redirect_uri, client id/secret", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    const mockFetch = vi.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedBody = init.body as string;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "acc", refresh_token: "ref", expires_in: 3600, token_type: "Bearer", scope: "user:read channel:read" }),
        text: async () => JSON.stringify({ access_token: "acc", expires_in: 3600 }),
      } as Response;
    });
    const res = await exchangeKickCode({
      code: "authCode123",
      codeVerifier: "verifier123456789012345678901234567890123",
      redirectUri: "https://example.com/api/auth/kick/callback",
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    expect(capturedUrl).toBe("https://id.kick.com/oauth/token");
    const params = new URLSearchParams(capturedBody);
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("code")).toBe("authCode123");
    expect(params.get("code_verifier")).toBe("verifier123456789012345678901234567890123");
    expect(params.get("redirect_uri")).toBe("https://example.com/api/auth/kick/callback");
    expect(params.get("client_id")).toBe("kickId");
    expect(params.get("client_secret")).toBe("kickSecret");
    expect(res.access_token).toBe("acc");
    expect(res.expires_in).toBe(3600);
  });

  it("successful normalized response", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "acc2", expires_in: 7200, token_type: "Bearer" }),
      text: async () => "",
    } as Response));
    const res = await exchangeKickCode({ code: "c", codeVerifier: "verifier123456789012345678901234567890123", redirectUri: "https://example.com/api/auth/kick/callback", fetchFn: mockFetch as unknown as typeof fetch });
    expect(res.access_token).toBe("acc2");
    expect(res.expires_in).toBe(7200);
  });

  it("malformed response throws", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ token_type: "Bearer" }), // missing access_token
      text: async () => "",
    } as Response));
    await expect(exchangeKickCode({ code: "c", codeVerifier: "v".repeat(43), redirectUri: "https://example.com/api/auth/kick/callback", fetchFn: mockFetch as unknown as typeof fetch })).rejects.toThrow(/malformed/i);
  });

  it("provider error sanitization — no client secret leakage", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => "invalid_grant code=secret123 client_secret=shouldNotLeak access_token=leak",
      json: async () => ({}),
    } as Response));
    await expect(exchangeKickCode({ code: "c", codeVerifier: "v".repeat(43), redirectUri: "https://example.com/api/auth/kick/callback", fetchFn: mockFetch as unknown as typeof fetch })).rejects.toThrow(expect.not.stringContaining("secret123"));
    try {
      await exchangeKickCode({ code: "c", codeVerifier: "v".repeat(43), redirectUri: "https://example.com/api/auth/kick/callback", fetchFn: mockFetch as unknown as typeof fetch });
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("secret123");
      expect(msg).toContain("code=***");
      expect(msg).toContain("client_secret=***");
    }
  });

  it("throws when not configured", async () => {
    delete process.env.KICK_CLIENT_ID;
    await expect(exchangeKickCode({ code: "c", codeVerifier: "v".repeat(43), redirectUri: "https://example.com/cb", fetchFn: vi.fn() as never })).rejects.toThrow(/not configured/i);
  });
});

describe("kick oauth service — refreshKickToken", () => {
  beforeEach(() => {
    process.env.KICK_CLIENT_ID = "kickId";
    process.env.KICK_CLIENT_SECRET = "kickSecret";
  });

  it("correct grant type and refresh token", async () => {
    let body = "";
    const mockFetch = vi.fn(async (url: string, init: RequestInit) => {
      body = init.body as string;
      return { ok: true, status: 200, json: async () => ({ access_token: "newAcc", expires_in: 3600, token_type: "Bearer", refresh_token: "newRef" }), text: async () => "" } as Response;
    });
    const res = await refreshKickToken("oldRef", mockFetch as unknown as typeof fetch);
    const params = new URLSearchParams(body);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("oldRef");
    expect(params.get("client_id")).toBe("kickId");
    expect(params.get("client_secret")).toBe("kickSecret");
    expect(res.access_token).toBe("newAcc");
  });

  it("successful response with rotation", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ access_token: "acc", refresh_token: "rotatedRef", expires_in: 3600, token_type: "Bearer" }), text: async () => "",
    } as Response));
    const res = await refreshKickToken("old", mockFetch as unknown as typeof fetch);
    expect(res.refresh_token).toBe("rotatedRef");
  });

  it("missing new refresh token is allowed (rotation not required)", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ access_token: "acc", expires_in: 3600, token_type: "Bearer" }), text: async () => "",
    } as Response));
    const res = await refreshKickToken("old", mockFetch as unknown as typeof fetch);
    expect(res.refresh_token).toBeUndefined();
    expect(res.access_token).toBe("acc");
  });

  it("provider error sanitization", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false, status: 400, text: async () => "invalid_grant refresh_token=leak123 client_secret=leak", json: async () => ({}),
    } as Response));
    await expect(refreshKickToken("old", mockFetch as unknown as typeof fetch)).rejects.toThrow(expect.not.stringContaining("leak123"));
    try {
      await refreshKickToken("old", mockFetch as unknown as typeof fetch);
    } catch (e) {
      expect((e as Error).message).toContain("refresh_token=***");
      expect((e as Error).message).toContain("client_secret=***");
    }
  });

  it("malformed throws", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ expires_in: 3600 }), text: async () => "",
    } as Response));
    await expect(refreshKickToken("old", mockFetch as unknown as typeof fetch)).rejects.toThrow(/malformed/i);
  });
});

describe("kick oauth service — getKickUser", () => {
  it("Authorization Bearer header sent", async () => {
    let capturedHeaders: Record<string, string> = {};
    const mockFetch = vi.fn(async (url: string, init: RequestInit) => {
      capturedHeaders = (init.headers as Record<string, string>) ?? {};
      return { ok: true, status: 200, json: async () => ({ data: [{ id: 1, username: "testuser", slug: "testuser" }] }), text: async () => "" } as Response;
    });
    const user = await getKickUser("myAccessToken", mockFetch as unknown as typeof fetch);
    expect(capturedHeaders.Authorization).toBe("Bearer myAccessToken");
    expect(user.id).toBe("1");
    expect(user.slug).toBe("testuser");
  });

  it("successful identity normalization (users endpoint)", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ data: [{ id: 123, username: "coolkick", slug: "coolkick" }] }), text: async () => "",
    } as Response));
    const u = await getKickUser("tok", mockFetch as unknown as typeof fetch);
    expect(u.id).toBe("123");
    expect(u.username).toBe("coolkick");
  });

  it("fallback to channels when users fails", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/users")) return { ok: false, status: 401, text: async () => "unauthorized" } as Response;
      return { ok: true, status: 200, json: async () => ({ data: [{ id: 55, slug: "fallbackslug", broadcaster_user_id: 99 }] }), text: async () => "" } as Response;
    });
    const u = await getKickUser("tok", mockFetch as unknown as typeof fetch);
    expect(u.slug).toBe("fallbackslug");
    expect(u.id).toBe("99");
  });

  it("provider failure throws sanitized", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false, status: 500, text: async () => "server error access_token=tok123", json: async () => ({}),
    } as Response));
    await expect(getKickUser("tok123", mockFetch as unknown as typeof fetch)).rejects.toThrow(expect.not.stringContaining("tok123"));
  });

  it("malformed response throws", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ data: [] }), text: async () => "",
    } as Response));
    await expect(getKickUser("tok", mockFetch as unknown as typeof fetch)).rejects.toThrow(/not found/i);
  });

  it("no token leakage in error", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false, status: 401, text: async () => "unauthorized access_token=superSecret", json: async () => ({}),
    } as Response));
    try {
      await getKickUser("superSecret", mockFetch as unknown as typeof fetch);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).not.toContain("superSecret");
      expect((e as Error).message).toContain("access_token=***");
    }
  });
});
