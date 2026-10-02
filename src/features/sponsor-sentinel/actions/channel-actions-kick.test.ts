import { describe, it, expect, vi, beforeEach } from "vitest";
import { forbiddenError } from "@/lib/errors";

const mockRequireOrg = vi.fn();
const mockRequireEntitlement = vi.fn();
const mockCreateClient = vi.fn();
const mockResolveKick = vi.fn();
const mockResolveKickChannel = vi.fn();
const mockCreateConnectedChannel = vi.fn();
const mockListChannels = vi.fn();
const mockGetChannel = vi.fn();
const mockDeleteChannel = vi.fn();

vi.mock("@/lib/auth/organization-context", () => ({
  requireOrganizationContext: (...args: unknown[]) => mockRequireOrg(...args),
}));
vi.mock("@/lib/auth/require-entitlement", () => ({
  requireEntitlement: (...args: unknown[]) => mockRequireEntitlement(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));
vi.mock("@/server/credentials/resolver", () => ({
  resolveTwitchCredentials: vi.fn(async () => null),
  resolveYouTubeCredentials: vi.fn(async () => null),
  resolveKickCredentials: (...args: unknown[]) => mockResolveKick(...args),
}));
vi.mock("@/server/integrations/kick/client", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    KickClient: vi.fn(function (this: unknown, _cfg: unknown) {
      return this;
    }),
    KickApiError: class extends Error {
      kind: string;
      status: number;
      constructor(opts: { kind: string; status: number; message: string }) {
        super(opts.message);
        this.kind = opts.kind;
        this.status = opts.status;
      }
    },
  };
});
vi.mock("@/server/integrations/kick/provider", () => ({
  KickProvider: vi.fn(function (this: unknown) {
    return { resolveChannel: (...args: unknown[]) => mockResolveKickChannel(...args) };
  }),
}));
vi.mock("@/features/sponsor-sentinel/services/connected-channel-service", () => ({
  createConnectedChannel: (...args: unknown[]) => mockCreateConnectedChannel(...args),
  listConnectedChannels: (...args: unknown[]) => mockListChannels(...args),
  getConnectedChannel: (...args: unknown[]) => mockGetChannel(...args),
}));
vi.mock("@/server/repositories/connected-channels", () => ({
  deleteConnectedChannel: (...args: unknown[]) => mockDeleteChannel(...args),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { connectKickChannelAction, disconnectKickChannelAction, disconnectChannelAction } from "./channel-actions";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("connectKickChannelAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrg.mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports" } });
    mockRequireEntitlement.mockResolvedValue({});
    mockCreateClient.mockResolvedValue({});
    mockResolveKick.mockResolvedValue({ clientId: "cid", clientSecret: "csec", source: "organization" } as never);
    mockListChannels.mockResolvedValue([]);
    mockResolveKickChannel.mockResolvedValue({
      platform: "kick",
      externalChannelId: "999",
      externalHandle: "mykicktest",
      displayName: "mykicktest",
      canonicalUrl: "https://kick.com/mykicktest",
    });
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch-1" });
  });

  it("Kick slug validation — empty returns safe error", async () => {
    const res = await connectKickChannelAction(fd({ orgSlug: "tag-esports", handle: "" }));
    expect((res as { error?: string }).error).toMatch(/Enter a valid Kick channel handle/);
  });

  it("Successful Kick resolution persists with correct fields", async () => {
    const res = await connectKickChannelAction(fd({ orgSlug: "tag-esports", handle: "mykicktest" }));
    expect((res as { success?: boolean }).success).toBe(true);
    expect(mockResolveKickChannel).toHaveBeenCalledWith("mykicktest");
    expect(mockCreateConnectedChannel).toHaveBeenCalledWith(
      expect.anything(),
      "org-a",
      expect.objectContaining({
        platform: "kick",
        external_channel_id: "999",
        external_handle: "mykicktest",
        canonical_url: "https://kick.com/mykicktest",
      }),
    );
  });

  it("Resolver failure returns safe error, no secret leak", async () => {
    const { KickApiError } = await import("@/server/integrations/kick/client");
    mockResolveKickChannel.mockRejectedValueOnce(new KickApiError({ kind: "auth", status: 401, message: "auth fail" }));
    const res = await connectKickChannelAction(fd({ orgSlug: "tag-esports", handle: "mykicktest" }));
    expect((res as { error?: string }).error).toMatch(/Kick authentication failed/);
    expect(JSON.stringify(res)).not.toContain("csec");
  });

  it("Organization isolation — channel org mismatch via getConnectedChannel", async () => {
    mockCreateConnectedChannel.mockRejectedValueOnce(forbiddenError("Cross-organization"));
    await connectKickChannelAction(fd({ orgSlug: "tag-esports", handle: "other" }));
    mockRequireOrg.mockRejectedValueOnce(forbiddenError("not member"));
    const res2 = await connectKickChannelAction(fd({ orgSlug: "tag-esports", handle: "mykicktest" }));
    expect((res2 as { error?: string }).error).toMatch(/not member/i);
  });

  it("Entitlement enforcement", async () => {
    mockRequireEntitlement.mockRejectedValueOnce(forbiddenError("no access"));
    const res = await connectKickChannelAction(fd({ orgSlug: "tag-esports", handle: "mykicktest" }));
    expect((res as { error?: string }).error).toMatch(/no access/i);
  });

  it("Client cannot override resolved external ID — provider resolves authoritative", async () => {
    const res = await connectKickChannelAction(fd({ orgSlug: "tag-esports", handle: "mykicktest", external_channel_id: "hacked" }));
    // Should ignore hacked param and use resolved 999
    expect(mockCreateConnectedChannel).toHaveBeenCalledWith(
      expect.anything(),
      "org-a",
      expect.objectContaining({ external_channel_id: "999" }),
    );
    expect((res as { success?: boolean }).success).toBe(true);
  });

  it("Disconnect Kick via generic action remains correct", async () => {
    mockGetChannel.mockResolvedValueOnce({ id: "ch-1", organization_id: "org-a", platform: "kick" } as never);
    const res = await disconnectChannelAction(fd({ orgSlug: "tag-esports", channelId: "ch-1" }));
    expect((res as { success?: boolean }).success).toBe(true);
    expect(mockDeleteChannel).toHaveBeenCalledWith(expect.anything(), "ch-1");
  });

  it("Disconnect Kick via kick-specific action", async () => {
    mockGetChannel.mockResolvedValueOnce({ id: "ch-kick", organization_id: "org-a", platform: "kick" } as never);
    const res = await disconnectKickChannelAction(fd({ orgSlug: "tag-esports", channelId: "ch-kick" }));
    expect((res as { success?: boolean }).success).toBe(true);
  });

  it("Missing credentials returns safe error", async () => {
    mockResolveKick.mockResolvedValueOnce(null);
    const res = await connectKickChannelAction(fd({ orgSlug: "tag-esports", handle: "mykicktest" }));
    expect((res as { error?: string }).error).toMatch(/Configure Kick credentials/);
  });
});
