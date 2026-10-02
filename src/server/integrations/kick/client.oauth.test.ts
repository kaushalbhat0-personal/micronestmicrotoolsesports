import { describe, it, expect, vi, beforeEach } from "vitest";
import { KickClient } from "./client";

vi.mock("./auth", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getKickAppToken: vi.fn(async () => "appTokenShouldNotBeUsed"),
    clearKickTokenCache: vi.fn(),
  };
});
import { getKickAppToken } from "./auth";

describe("KickClient OAuth path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("OAuth path uses Bearer user token and does NOT call getKickAppToken", async () => {
    let capturedAuth = "";
    const mockFetch = vi.fn(async (url: string, init: RequestInit) => {
      capturedAuth = (init.headers as Record<string, string>).Authorization ?? "";
      expect(url).not.toContain("access_token");
      expect(url).not.toContain("token");
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ data: [] }),
      } as Response;
    });
    const client = new KickClient({ clientId: "cid", clientSecret: "csec", userAccessToken: "userTok123" }, mockFetch as unknown as typeof fetch);
    await client.getChannelsBySlug(["test"]);
    expect(capturedAuth).toBe("Bearer userTok123");
    expect(getKickAppToken).not.toHaveBeenCalled();
  });

  it("OAuth path does NOT retry with app token on 401", async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      return {
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () => "unauthorized",
      } as Response;
    });
    const client = new KickClient({ clientId: "cid", clientSecret: "csec", userAccessToken: "userTok" }, mockFetch as unknown as typeof fetch);
    await expect(client.getChannelsBySlug(["x"])).rejects.toThrow(/auth/i);
    expect(getKickAppToken).not.toHaveBeenCalled();
    expect(callCount).toBe(1);
  });

  it("OAuth token is NOT in URL", async () => {
    let capturedUrl = "";
    const mockFetch = vi.fn(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ data: [] }) } as Response;
    });
    const client = new KickClient({ clientId: "cid", clientSecret: "csec", userAccessToken: "secretUserToken" }, mockFetch as unknown as typeof fetch);
    await client.getChannelsBySlug(["slug1"]);
    expect(capturedUrl).not.toContain("secretUserToken");
    expect(capturedUrl).not.toContain("access_token");
  });

  it("Legacy path still uses getKickAppToken", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ data: [] }),
    } as Response));
    const client = new KickClient({ clientId: "cid", clientSecret: "csec" }, mockFetch as unknown as typeof fetch);
    await client.getChannelsBySlug(["a"]);
    expect(getKickAppToken).toHaveBeenCalledWith("cid", "csec", expect.any(Function));
  });
});
