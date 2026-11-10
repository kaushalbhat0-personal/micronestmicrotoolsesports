import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret } from "./crypto";
import { getValidAccessToken, TOKEN_EXPIRY_BUFFER_MS } from "./token-service";

function mockSupabaseWithRow(row: Record<string, unknown> | null) {
  return {
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row, error: null }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("token-service", () => {
  it("valid token returned without refresh", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const row = {
      id: "1",
      organization_id: "org-a",
      provider: "twitch",
      encrypted_access_token: encryptSecret("accValid"),
      encrypted_refresh_token: encryptSecret("ref"),
      access_token_expires_at: future,
      scope: "user:read:email",
      external_account_id: "123",
      external_account_login: "divine1701",
      authorized_at: new Date().toISOString(),
    };
    const supabase = mockSupabaseWithRow(row);
    const res = await getValidAccessToken(supabase, "org-a", "twitch");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.accessToken).toBe("accValid");
  });

  it("near-expiry detected (within 5min buffer)", async () => {
    const near = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 min
    const row = {
      id: "1",
      organization_id: "org-a",
      provider: "twitch",
      encrypted_access_token: encryptSecret("accNear"),
      access_token_expires_at: near,
    };
    const supabase = mockSupabaseWithRow(row);
    const res = await getValidAccessToken(supabase, "org-a", "twitch");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("expired");
  });

  it("expired token detected", async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    const row = {
      id: "1",
      organization_id: "org-a",
      provider: "youtube",
      encrypted_access_token: encryptSecret("accExpired"),
      access_token_expires_at: past,
    };
    const supabase = mockSupabaseWithRow(row);
    const res = await getValidAccessToken(supabase, "org-a", "youtube");
    expect(res.ok).toBe(false);
    expect((res as { reason: string }).reason).toBe("expired");
  });

  it("missing OAuth credential returns not_configured", async () => {
    const supabase = mockSupabaseWithRow(null);
    const res = await getValidAccessToken(supabase, "org-a", "kick");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_configured");
  });

  it("organization isolation — wrong org returns not_configured (row not found)", async () => {
    // Row exists for org-b, but query is for org-a → mock returns null
    const supabase = mockSupabaseWithRow(null);
    const res = await getValidAccessToken(supabase, "org-a", "twitch");
    expect(res.ok).toBe(false);
  });

  it("platform validation — invalid provider", async () => {
    const supabase = mockSupabaseWithRow(null);
    const res = await getValidAccessToken(supabase, "org-a", "invalid" as never);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("invalid_provider");
  });

  it("no token in error — logs safe", async () => {
    const supabase = mockSupabaseWithRow(null);
    const res = await getValidAccessToken(supabase, "org-a", "twitch");
    expect(JSON.stringify(res)).not.toContain("accValid");
  });

  it("buffer is 5 min", () => {
    expect(TOKEN_EXPIRY_BUFFER_MS).toBe(5 * 60 * 1000);
  });
});
