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
  it("1. valid users + channels returns normalized identity", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/public/v1/users")) {
        return { ok: true, status: 200, json: async () => ({ data: [{ user_id: 12345, name: "kickuser", email: "a@b.com" }] }), text: async () => "" } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ data: [{ broadcaster_user_id: 12345, slug: "kickslug" }] }), text: async () => "" } as Response;
    });
    const u = await getKickUser("tok", mockFetch as unknown as typeof fetch);
    expect(u.id).toBe("12345");
    expect(u.username).toBe("kickuser");
    expect(u.slug).toBe("kickslug");
  });

  it("2. users returns user_id/name not id/username → PASS", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/users")) {
        return { ok: true, status: 200, json: async () => ({ data: [{ user_id: 999, name: "realname" }] }), text: async () => "" } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ data: [{ broadcaster_user_id: 999, slug: "realslug" }] }), text: async () => "" } as Response;
    });
    const u = await getKickUser("tok", mockFetch as unknown as typeof fetch);
    expect(u.id).toBe("999");
    expect(u.username).toBe("realname");
    // ensure old shape would fail — proves new mapping
    expect(u.slug).toBe("realslug");
  });

  it("3. users empty data → Kick authorized user not found", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/users")) return { ok: true, status: 200, json: async () => ({ data: [] }), text: async () => "" } as Response;
      return { ok: true, status: 200, json: async () => ({ data: [{ broadcaster_user_id: 1, slug: "s" }] }), text: async () => "" } as Response;
    });
    await expect(getKickUser("tok", mockFetch as unknown as typeof fetch)).rejects.toThrow(/Kick authorized user not found/i);
  });

  it("4. channels empty data → Kick authorized channel not found", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/users")) return { ok: true, status: 200, json: async () => ({ data: [{ user_id: 1, name: "n" }] }), text: async () => "" } as Response;
      return { ok: true, status: 200, json: async () => ({ data: [] }), text: async () => "" } as Response;
    });
    await expect(getKickUser("tok", mockFetch as unknown as typeof fetch)).rejects.toThrow(/Kick authorized channel not found/i);
  });

  it("5. mismatched broadcaster_user_id → safe failure", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/users")) return { ok: true, status: 200, json: async () => ({ data: [{ user_id: 111, name: "a" }] }), text: async () => "" } as Response;
      return { ok: true, status: 200, json: async () => ({ data: [{ broadcaster_user_id: 222, slug: "other" }] }), text: async () => "" } as Response;
    });
    await expect(getKickUser("tok", mockFetch as unknown as typeof fetch)).rejects.toThrow(/Kick authorized channel not found/i);
  });

  it("6. users HTTP error → Kick user identity lookup failed", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/users")) return { ok: false, status: 500, text: async () => "server error", json: async () => ({}) } as Response;
      return { ok: true, status: 200, json: async () => ({ data: [{ broadcaster_user_id: 1, slug: "s" }] }), text: async () => "" } as Response;
    });
    await expect(getKickUser("tok", mockFetch as unknown as typeof fetch)).rejects.toThrow(/Kick user identity lookup failed/i);
  });

  it("7. channels HTTP error → Kick channel lookup failed", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/users")) return { ok: true, status: 200, json: async () => ({ data: [{ user_id: 1, name: "n" }] }), text: async () => "" } as Response;
      return { ok: false, status: 403, text: async () => "forbidden", json: async () => ({}) } as Response;
    });
    await expect(getKickUser("tok", mockFetch as unknown as typeof fetch)).rejects.toThrow(/Kick channel lookup failed/i);
  });

  it("8. no token leakage in errors", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes("/users")) return { ok: false, status: 401, text: async () => "unauthorized access_token=superSecret", json: async () => ({}) } as Response;
      return { ok: true, status: 200, json: async () => ({ data: [] }), text: async () => "" } as Response;
    });
    try {
      await getKickUser("superSecret", mockFetch as unknown as typeof fetch);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).not.toContain("superSecret");
      expect((e as Error).message).toContain("access_token=***");
    }
  });

  it("9. correct Authorization Bearer header on both requests", async () => {
    const headers: string[] = [];
    const mockFetch = vi.fn(async (url: string, init: RequestInit) => {
      headers.push((init.headers as Record<string, string>).Authorization);
      if (url.includes("/users")) return { ok: true, status: 200, json: async () => ({ data: [{ user_id: 5, name: "u" }] }), text: async () => "" } as Response;
      return { ok: true, status: 200, json: async () => ({ data: [{ broadcaster_user_id: 5, slug: "s" }] }), text: async () => "" } as Response;
    });
    await getKickUser("myAccessToken", mockFetch as unknown as typeof fetch);
    expect(headers).toHaveLength(2);
    expect(headers[0]).toBe("Bearer myAccessToken");
    expect(headers[1]).toBe("Bearer myAccessToken");
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/public/v1/users"), expect.anything());
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/public/v1/channels"), expect.anything());
  });

  it("provider failure throws sanitized (users)", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false, status: 500, text: async () => "server error access_token=tok123", json: async () => ({}),
    } as Response));
    await expect(getKickUser("tok123", mockFetch as unknown as typeof fetch)).rejects.toThrow(expect.not.stringContaining("tok123"));
  });
});
