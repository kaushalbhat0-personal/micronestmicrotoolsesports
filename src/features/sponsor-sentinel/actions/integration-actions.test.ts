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

  it("1. Successful Twitch credential update → ok:true, revalidate called, no throw", async () => {
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id123", clientSecret: "sec123" }));
    expect(res).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith(expect.anything(), "org-a", "twitch", { clientId: "id123", clientSecret: "sec123" });
    expect(mockRevalidate).toHaveBeenCalledWith("/dashboard/tag-esports/settings/integrations");
    // No secret in result
    expect(JSON.stringify(res)).not.toContain("sec123");
  });

  it("1b. Successful YouTube credential update → ok:true (regression)", async () => {
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "youtube", apiKey: "yt-key-123" }));
    expect(res).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith(expect.anything(), "org-a", "youtube", { apiKey: "yt-key-123" });
  });

  it("2. Invalid Twitch credentials (missing secret) → safe error, no throw, no persistence", async () => {
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id123", clientSecret: "" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Client ID and Secret required/);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(JSON.stringify(res)).not.toContain("sec");
  });

  it("2b. Invalid provider → safe error", async () => {
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "bad", clientId: "a", clientSecret: "b" }));
    expect(res.ok).toBe(false);
  });

  it("3. Persistence failure → safe failure, no false Connected", async () => {
    mockUpsert.mockRejectedValueOnce(new Error("db down"));
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id", clientSecret: "sec" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/We couldn't save/);
    expect(JSON.stringify(res)).not.toContain("sec");
  });

  it("4. Post-save revalidate failure → still ok:true (best-effort, persistence succeeded)", async () => {
    mockRevalidate.mockImplementationOnce(() => {
      throw new Error("revalidate failed");
    });
    const res = await saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id", clientSecret: "sec" }));
    // Persistence succeeded, so we still return ok:true (bug was falsely throwing)
    expect(res).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("5. NEXT_REDIRECT is not swallowed — rethrows", async () => {
    mockUpsert.mockRejectedValueOnce(new Error("NEXT_REDIRECT /login"));
    await expect(saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id", clientSecret: "sec" }))).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("5b. Revalidate NEXT_REDIRECT rethrows", async () => {
    mockRevalidate.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT /something");
    });
    await expect(saveProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch", clientId: "id", clientSecret: "sec" }))).rejects.toThrow(/NEXT_REDIRECT/);
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

  it("8. testProviderCredential still works and never returns secret", async () => {
    // Mock decryptRow to return valid creds
    const { decryptRow } = await import("@/server/credentials/repository");
    vi.mocked(decryptRow).mockReturnValueOnce({ clientId: "id", clientSecret: "sec" } as never);
    // Need getProviderCredentialRow to return something
    const { getProviderCredentialRow } = await import("@/server/credentials/repository");
    vi.mocked(getProviderCredentialRow).mockResolvedValueOnce({ id: "1", organization_id: "org-a", provider: "twitch" } as never);
    const res = await testProviderCredential(fd({ orgSlug: "tag-esports", provider: "twitch" }));
    expect(res.ok).toBe(true);
    expect(JSON.stringify(res)).not.toContain("sec");
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
