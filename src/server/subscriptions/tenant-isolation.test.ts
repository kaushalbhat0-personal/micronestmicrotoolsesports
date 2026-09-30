import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { subscribeChannelForOrg } from "./reconciler";

function mockSupabaseForTenant(opts: {
  channel?: { organization_id: string; platform: string; external_channel_id: string } | null;
  membership?: boolean;
  shouldNotCallProvider?: boolean;
}) {
  return {
    from: (table: string) => {
      if (table === "connected_channels") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => {
                    if (!opts.channel) return { data: null, error: null };
                    return { data: opts.channel, error: null };
                  },
                }),
              }),
            }),
          }),
        } as never;
      }
      if (table === "organization_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => {
                  if (opts.membership) return { data: { id: "mem" }, error: null };
                  return { data: null, error: null };
                },
              }),
            }),
          }),
        } as never;
      }
      if (table === "organization_provider_credentials") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
        } as never;
      }
      throw new Error("unexpected " + table);
    },
  } as unknown as SupabaseClient;
}

describe("tenant isolation subscriptions", () => {
  it("organization A cannot manage organization B channel (not_found)", async () => {
    const supabase = mockSupabaseForTenant({ channel: null, membership: true });
    const res = await subscribeChannelForOrg(supabase, { organizationId: "org-a", platform: "twitch", externalChannelId: "999", userId: "user-1" });
    expect(res.ok).toBe(false);
    expect(res.errorKind).toBe("not_found");
  });

  it("provider mismatch rejected", async () => {
    // Channel is youtube but request claims twitch
    const supabase = mockSupabaseForTenant({
      channel: { organization_id: "org-a", platform: "youtube", external_channel_id: "123" },
      membership: true,
    });
    // The query filters by platform, so mismatch → not_found
    const res = await subscribeChannelForOrg(supabase, { organizationId: "org-a", platform: "twitch", externalChannelId: "123", userId: "user-1" });
    expect(res.ok).toBe(false);
  });

  it("external channel mismatch rejected", async () => {
    const supabase = mockSupabaseForTenant({
      channel: { organization_id: "org-a", platform: "twitch", external_channel_id: "111" },
      membership: true,
    });
    const res = await subscribeChannelForOrg(supabase, { organizationId: "org-a", platform: "twitch", externalChannelId: "999", userId: "user-1" });
    expect(res.ok).toBe(false);
  });

  it("arbitrary organization ID ignored (must match connected channel org)", async () => {
    const supabase = mockSupabaseForTenant({
      channel: { organization_id: "org-real", platform: "twitch", external_channel_id: "123" },
      membership: true,
    });
    // Attacker passes org-attacker but channel belongs to org-real → not_found because filter includes org
    const res = await subscribeChannelForOrg(supabase, { organizationId: "org-attacker", platform: "twitch", externalChannelId: "123", userId: "user-1" });
    expect(res.ok).toBe(false);
  });

  it("unauthorized caller rejected (not member)", async () => {
    const supabase = mockSupabaseForTenant({
      channel: { organization_id: "org-a", platform: "twitch", external_channel_id: "123" },
      membership: false,
    });
    const res = await subscribeChannelForOrg(supabase, { organizationId: "org-a", platform: "twitch", externalChannelId: "123", userId: "intruder" });
    expect(res.ok).toBe(false);
    expect(res.errorKind).toBe("unauthorized");
  });
});
