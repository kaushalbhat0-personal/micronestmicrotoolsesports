import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.fn();
const mockRequireOrg = vi.fn();
const mockRequireEnt = vi.fn();

vi.mock("@/lib/auth/get-user", () => ({ getCurrentUser: (...a: unknown[]) => mockGetCurrentUser(...a) }));
vi.mock("@/lib/auth/organization-context", () => ({ requireOrganizationContext: (...a: unknown[]) => mockRequireOrg(...a) }));
vi.mock("@/lib/auth/require-entitlement", () => ({ requireEntitlement: (...a: unknown[]) => mockRequireEnt(...a) }));
const mockAssertChannelQuota = vi.fn(async () => undefined);
vi.mock("@/server/services/sponsorship-limits", () => ({ assertFreeChannelConnectAllowed: (...a: unknown[]) => (mockAssertChannelQuota as unknown as (...args: unknown[]) => unknown)(...a) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));

vi.mock("@/server/oauth/state", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, generateState: vi.fn(() => ({ state: "test.state.sig", nonce: "n", issuedAt: Date.now() })) };
});
vi.mock("@/server/oauth/pkce", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, generateVerifier: vi.fn(() => "verifier123456789012345678901234567890123"), generateChallenge: vi.fn(() => "challenge123") };
});

import { GET } from "./route";

describe("GET /api/auth/twitch/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWITCH_CLIENT_ID = "twitchClientId";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockRequireOrg.mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports" }, user: { id: "user-1" } });
    mockRequireEnt.mockResolvedValue({});
  });

  it("unauthenticated rejected 401", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const req = new Request("https://example.com/api/auth/twitch/start?orgSlug=tag-esports");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("non-member rejected 403", async () => {
    mockRequireOrg.mockRejectedValueOnce(new Error("not member"));
    const req = new Request("https://example.com/api/auth/twitch/start?orgSlug=tag-esports");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("success redirects to Twitch authorize with state, PKCE, cookies", async () => {
    const req = new Request("https://example.com/api/auth/twitch/start?orgSlug=tag-esports");
    const res = await GET(req);
    expect(res.status).toBe(307); // NextResponse.redirect 307
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("id.twitch.tv/oauth2/authorize");
    expect(loc).toContain("client_id=twitchClientId");
    expect(loc).toContain("state=test.state.sig");
    expect(loc).toContain("code_challenge=challenge123");
    expect(loc).toContain("scope=user%3Aread%3Aemail");
    expect(loc).not.toContain("client_secret");
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie") ?? ""];
    const joined = setCookies.join(";");
    expect(joined).toContain("oauth_state_twitch");
    expect(joined).toContain("oauth_verifier_twitch");
    expect(joined).toContain("HttpOnly");
    expect(joined.toLowerCase()).toContain("samesite=lax");
  });

  it("no secrets in redirect URL", async () => {
    const req = new Request("https://example.com/api/auth/twitch/start?orgSlug=tag-esports");
    const res = await GET(req);
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("client_secret");
    expect(loc).not.toContain("verifier");
  });

  it("free channel quota exhausted → 403 (OAuth start cannot bypass limits)", async () => {
    mockAssertChannelQuota.mockRejectedValueOnce(new Error("You're using your free channel slot. Disconnect it to connect a different channel — or upgrade for unlimited channels."));
    const req = new Request("https://example.com/api/auth/twitch/start?orgSlug=tag-esports");
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/free channel slot/) });
  });
});
