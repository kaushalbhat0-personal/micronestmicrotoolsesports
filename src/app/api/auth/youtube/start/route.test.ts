import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.fn();
const mockRequireOrg = vi.fn();
const mockRequireEnt = vi.fn();

vi.mock("@/lib/auth/get-user", () => ({ getCurrentUser: (...a: unknown[]) => mockGetCurrentUser(...a) }));
vi.mock("@/lib/auth/organization-context", () => ({ requireOrganizationContext: (...a: unknown[]) => mockRequireOrg(...a) }));
vi.mock("@/lib/auth/require-entitlement", () => ({ requireEntitlement: (...a: unknown[]) => mockRequireEnt(...a) }));

vi.mock("@/server/oauth/state", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, generateState: vi.fn(() => ({ state: "test.state.sig", nonce: "n", issuedAt: Date.now() })) };
});
vi.mock("@/server/oauth/pkce", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, generateVerifier: vi.fn(() => "verifier123456789012345678901234567890123"), generateChallenge: vi.fn(() => "challenge123") };
});

import { GET } from "./route";

describe("GET /api/auth/youtube/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.YOUTUBE_CLIENT_ID = "youtubeClientId";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockRequireOrg.mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports" }, user: { id: "user-1" } });
    mockRequireEnt.mockResolvedValue({});
  });

  it("unauthenticated rejected 401", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const req = new Request("https://example.com/api/auth/youtube/start?orgSlug=tag-esports");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("success redirects to Google authorize with youtube.readonly and PKCE", async () => {
    const req = new Request("https://example.com/api/auth/youtube/start?orgSlug=tag-esports");
    const res = await GET(req);
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(loc).toContain("client_id=youtubeClientId");
    expect(loc).toContain("scope=" + encodeURIComponent("https://www.googleapis.com/auth/youtube.readonly"));
    expect(loc).toContain("access_type=offline");
    expect(loc).toContain("prompt=consent");
    expect(loc).toContain("state=test.state.sig");
    expect(loc).toContain("code_challenge=challenge123");
    expect(loc).not.toContain("client_secret");
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie") ?? ""];
    const joined = setCookies.join(";");
    expect(joined).toContain("oauth_state_youtube");
    expect(joined).toContain("oauth_verifier_youtube");
  });
});
