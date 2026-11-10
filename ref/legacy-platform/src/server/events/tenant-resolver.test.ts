import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTenantForWebhook } from "./tenant-resolver";

function mockSupabase(channels: Array<{ platform: string; external_channel_id: string; organization_id: string }>) {
  return {
    from: (table: string) => {
      if (table !== "connected_channels") throw new Error("unexpected table " + table);
      return {
        select: () => ({
          eq: (col: string, val: string) => ({
            eq: (col2: string, val2: string) => ({
              limit: () => ({
                maybeSingle: async () => {
                  const found = channels.find((c) => c.platform === val && c.external_channel_id === val2);
                  if (!found) return { data: null, error: null };
                  return { data: { organization_id: found.organization_id }, error: null };
                },
              }),
            }),
          }),
        }),
      } as never;
    },
  } as unknown as SupabaseClient;
}

describe("tenant resolver", () => {
  it("known connected channel → correct organization", async () => {
    const supabase = mockSupabase([{ platform: "twitch", external_channel_id: "123", organization_id: "org-a" }]);
    const org = await resolveTenantForWebhook(supabase, "twitch", "123");
    expect(org).toBe("org-a");
  });

  it("unknown channel → no tenant assignment (null)", async () => {
    const supabase = mockSupabase([]);
    const org = await resolveTenantForWebhook(supabase, "twitch", "999");
    expect(org).toBeNull();
  });

  it("same external channel cannot cross organizations (scoped by platform)", async () => {
    const supabase = mockSupabase([
      { platform: "twitch", external_channel_id: "123", organization_id: "org-a" },
      { platform: "kick", external_channel_id: "123", organization_id: "org-b" },
    ]);
    const twitchOrg = await resolveTenantForWebhook(supabase, "twitch", "123");
    const kickOrg = await resolveTenantForWebhook(supabase, "kick", "123");
    expect(twitchOrg).toBe("org-a");
    expect(kickOrg).toBe("org-b");
  });

  it("null externalChannelId → null without DB call", async () => {
    const spy = vi.fn();
    const supabase = {
      from: () => {
        spy();
        throw new Error("should not query");
      },
    } as unknown as SupabaseClient;
    const org = await resolveTenantForWebhook(supabase, "twitch", null);
    expect(org).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("organization ID from payload/request is ignored (server-side only)", async () => {
    // Resolver never reads payload; it only queries connected_channels
    const supabase = mockSupabase([{ platform: "twitch", external_channel_id: "123", organization_id: "org-real" }]);
    // Even if webhook payload claims org-b, resolver returns org-real
    const org = await resolveTenantForWebhook(supabase, "twitch", "123");
    expect(org).toBe("org-real");
    expect(org).not.toBe("org-b");
  });
});
