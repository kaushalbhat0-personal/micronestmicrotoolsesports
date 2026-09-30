import { describe, it, expect, vi, beforeEach } from "vitest";
import { forbiddenError, notFoundError } from "@/lib/errors";

const mockRequireOrg = vi.fn();
const mockRequireEntitlement = vi.fn();
const mockCreateClient = vi.fn();
const mockResolveTwitch = vi.fn();
const mockResolveYouTube = vi.fn();
const mockResolveChannel = vi.fn();
const mockResolveYouTubeChannel = vi.fn();
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
  resolveTwitchCredentials: (...args: unknown[]) => mockResolveTwitch(...args),
  resolveYouTubeCredentials: (...args: unknown[]) => mockResolveYouTube(...args),
}));
vi.mock("@/server/integrations/twitch/client", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    TwitchClient: vi.fn(function (this: unknown, _cfg: unknown) {
      return this;
    }),
    TwitchApiError: class extends Error {
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
vi.mock("@/server/integrations/twitch/provider", () => ({
  TwitchProvider: vi.fn(function (this: unknown) {
    return { resolveChannel: (...args: unknown[]) => mockResolveChannel(...args) };
  }),
}));
vi.mock("@/server/integrations/youtube/client", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    YouTubeClient: vi.fn(function (this: unknown, _cfg: unknown) {
      return this;
    }),
    YouTubeApiError: class extends Error {
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
vi.mock("@/server/integrations/youtube/provider", () => ({
  YouTubeProvider: vi.fn(function (this: unknown) {
    return { resolveChannel: (...args: unknown[]) => mockResolveYouTubeChannel(...args) };
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
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { connectTwitchChannelAction, disconnectTwitchChannelAction, connectYouTubeChannelAction, disconnectYouTubeChannelAction, disconnectChannelAction } from "./channel-actions";
import { TwitchApiError } from "@/server/integrations/twitch/client";
import { YouTubeApiError } from "@/server/integrations/youtube/client";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("channel-actions — connectTwitchChannelAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrg.mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports", name: "TAG" }, membership: { role: "owner" } });
    mockRequireEntitlement.mockResolvedValue({});
    mockCreateClient.mockResolvedValue({});
    mockListChannels.mockResolvedValue([]);
  });

  it("successful Twitch channel connection", async () => {
    mockResolveTwitch.mockResolvedValue({ clientId: "cid", clientSecret: "csec", source: "organization" });
    mockResolveChannel.mockResolvedValue({
      platform: "twitch",
      externalChannelId: "12345",
      externalHandle: "kaushaltag",
      displayName: "KaushalTag",
      canonicalUrl: "https://twitch.tv/kaushaltag",
    });
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch-1", platform: "twitch" } as never);
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "kaushaltag" }));
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(mockCreateConnectedChannel).toHaveBeenCalledWith(expect.anything(), "org-a", expect.objectContaining({ platform: "twitch", external_channel_id: "12345" }));
    // No secrets in result
    expect(JSON.stringify(result)).not.toMatch(/csec|cid|clientSecret/);
  });

  it("missing organization context", async () => {
    mockRequireOrg.mockRejectedValueOnce(notFoundError("Organization not found"));
    const result = await connectTwitchChannelAction(fd({ orgSlug: "missing", handle: "kaushaltag" }));
    expect((result as {error?: string}).error).toMatch(/not found/i);
  });

  it("missing entitlement", async () => {
    mockRequireEntitlement.mockRejectedValueOnce(forbiddenError("Organization does not have access to sponsor-sentinel"));
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "kaushaltag" }));
    expect((result as {error?: string}).error).toMatch(/does not have access/);
  });

  it("missing Twitch credentials", async () => {
    mockResolveTwitch.mockResolvedValue(null);
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "kaushaltag" }));
    expect((result as {error?: string}).error).toMatch(/Configure Twitch credentials first/);
    expect((result as {error?: string}).error).toMatch(/settings\/integrations/);
    expect(mockResolveChannel).not.toHaveBeenCalled();
  });

  it("empty handle", async () => {
    mockResolveTwitch.mockResolvedValue({ clientId: "cid", clientSecret: "csec" } as never);
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "   " }));
    expect((result as {error?: string}).error).toMatch(/Enter a valid Twitch channel handle/);
    expect((result as {fieldErrors?: Record<string,string[]>}).fieldErrors?.handle).toBeDefined();
    expect(mockResolveChannel).not.toHaveBeenCalled();
  });

  it("invalid handle", async () => {
    mockResolveTwitch.mockResolvedValue({ clientId: "cid", clientSecret: "csec" } as never);
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "bad handle!" }));
    expect((result as {error?: string}).error).toMatch(/Enter a valid Twitch channel handle/);
  });

  it("rejects URL as handle", async () => {
    mockResolveTwitch.mockResolvedValue({ clientId: "cid", clientSecret: "csec" } as never);
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "https://twitch.tv/kaushaltag" }));
    expect((result as {error?: string}).error).toMatch(/Enter a valid Twitch channel handle/);
    expect(mockResolveChannel).not.toHaveBeenCalled();
  });

  it("Twitch channel not found", async () => {
    mockResolveTwitch.mockResolvedValue({ clientId: "cid", clientSecret: "csec" } as never);
    mockResolveChannel.mockResolvedValue(null);
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "unknown123" }));
    expect((result as {error?: string}).error).toMatch(/Twitch channel not found/);
  });

  it("Twitch authentication failure", async () => {
    mockResolveTwitch.mockResolvedValue({ clientId: "cid", clientSecret: "csec" } as never);
    mockResolveChannel.mockRejectedValueOnce(new TwitchApiError({ kind: "auth", status: 401, message: "auth" }));
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "kaushaltag" }));
    expect((result as {error?: string}).error).toMatch(/Twitch authentication failed/);
    expect((result as {error?: string}).error).not.toMatch(/csec/);
  });

  it("Twitch rate limit", async () => {
    mockResolveTwitch.mockResolvedValue({ clientId: "cid", clientSecret: "csec" } as never);
    mockResolveChannel.mockRejectedValueOnce(new TwitchApiError({ kind: "rate_limited", status: 429, message: "rate" }));
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "kaushaltag" }));
    expect((result as {error?: string}).error).toMatch(/rate limit/);
  });

  it("duplicate channel", async () => {
    mockResolveTwitch.mockResolvedValue({ clientId: "cid", clientSecret: "csec" } as never);
    mockResolveChannel.mockResolvedValue({
      platform: "twitch",
      externalChannelId: "12345",
      externalHandle: "kaushaltag",
      displayName: "KaushalTag",
      canonicalUrl: "https://twitch.tv/kaushaltag",
    });
    mockListChannels.mockResolvedValue([{ platform: "twitch", external_channel_id: "12345", external_handle: "kaushaltag" } as never]);
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "kaushaltag" }));
    expect((result as {error?: string}).error).toMatch(/already connected/);
    expect(mockCreateConnectedChannel).not.toHaveBeenCalled();
  });

  it("duplicate via DB constraint", async () => {
    mockResolveTwitch.mockResolvedValue({ clientId: "cid", clientSecret: "csec" } as never);
    mockResolveChannel.mockResolvedValue({
      platform: "twitch",
      externalChannelId: "12345",
      externalHandle: "kaushaltag",
      displayName: "KaushalTag",
      canonicalUrl: "https://twitch.tv/kaushaltag",
    });
    mockListChannels.mockResolvedValue([]);
    mockCreateConnectedChannel.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "connected_channels_org_platform_ext_unique"'));
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "kaushaltag" }));
    expect((result as {error?: string}).error).toMatch(/already connected/);
  });

  it("organization ID cannot be supplied by form input", async () => {
    mockResolveTwitch.mockResolvedValue({ clientId: "cid", clientSecret: "csec" } as never);
    mockResolveChannel.mockResolvedValue({
      platform: "twitch",
      externalChannelId: "12345",
      externalHandle: "kaushaltag",
      displayName: "KaushalTag",
      canonicalUrl: "https://twitch.tv/kaushaltag",
    });
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch-1" } as never);
    const f = fd({ orgSlug: "tag-esports", handle: "kaushaltag" });
    f.set("organization_id", "org-evil");
    f.set("organizationId", "org-evil");
    const result = await connectTwitchChannelAction(f);
    expect(result).toEqual(expect.objectContaining({ success: true }));
    // Verify org-a from context was used, not org-evil
    expect(mockCreateConnectedChannel).toHaveBeenCalledWith(expect.anything(), "org-a", expect.anything());
    expect(mockRequireOrg).toHaveBeenCalledWith("tag-esports");
  });

  it("returned result contains no secrets", async () => {
    mockResolveTwitch.mockResolvedValue({ clientId: "super-secret-id", clientSecret: "super-secret-secret", source: "organization" } as never);
    mockResolveChannel.mockResolvedValue({
      platform: "twitch",
      externalChannelId: "12345",
      externalHandle: "kaushaltag",
      displayName: "KaushalTag",
      canonicalUrl: "https://twitch.tv/kaushaltag",
    });
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch-1", platform: "twitch" } as never);
    const result = await connectTwitchChannelAction(fd({ orgSlug: "tag-esports", handle: "kaushaltag" }));
    const str = JSON.stringify(result);
    expect(str).not.toMatch(/super-secret/);
    expect(str).not.toMatch(/access_token/);
  });
});

describe("channel-actions — disconnectTwitchChannelAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrg.mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports" } } as never);
    mockRequireEntitlement.mockResolvedValue({});
    mockCreateClient.mockResolvedValue({});
  });

  it("successful disconnect", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch-1", organization_id: "org-a", platform: "twitch" } as never);
    mockDeleteChannel.mockResolvedValue(undefined as never);
    const result = await disconnectTwitchChannelAction(fd({ orgSlug: "tag-esports", channelId: "ch-1" }));
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(mockDeleteChannel).toHaveBeenCalledWith(expect.anything(), "ch-1");
  });

  it("missing organization context", async () => {
    mockRequireOrg.mockRejectedValueOnce(notFoundError("Organization not found"));
    const result = await disconnectTwitchChannelAction(fd({ orgSlug: "missing", channelId: "ch-1" }));
    expect((result as {error?: string}).error).toMatch(/not found/i);
  });

  it("missing entitlement", async () => {
    mockRequireEntitlement.mockRejectedValueOnce(forbiddenError("Organization does not have access to sponsor-sentinel"));
    const result = await disconnectTwitchChannelAction(fd({ orgSlug: "tag-esports", channelId: "ch-1" }));
    expect((result as {error?: string}).error).toMatch(/does not have access/);
  });

  it("channel not found", async () => {
    mockGetChannel.mockRejectedValueOnce(notFoundError("Channel not found"));
    const result = await disconnectTwitchChannelAction(fd({ orgSlug: "tag-esports", channelId: "missing" }));
    expect((result as {error?: string}).error).toMatch(/Channel not found/);
  });

  it("cross-organization channel cannot be deleted", async () => {
    mockGetChannel.mockRejectedValueOnce(forbiddenError("Cross-organization access denied"));
    const result = await disconnectTwitchChannelAction(fd({ orgSlug: "tag-esports", channelId: "ch-other-org" }));
    expect((result as {error?: string}).error).toMatch(/Cross-organization/);
    expect(mockDeleteChannel).not.toHaveBeenCalled();
  });

  it("non-Twitch channel cannot be deleted", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch-1", organization_id: "org-a", platform: "youtube" } as never);
    const result = await disconnectTwitchChannelAction(fd({ orgSlug: "tag-esports", channelId: "ch-1" }));
    expect((result as {error?: string}).error).toMatch(/Only Twitch channels/);
    expect(mockDeleteChannel).not.toHaveBeenCalled();
  });
});

describe("channel-actions — connectYouTubeChannelAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrg.mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports", name: "TAG" }, membership: { role: "owner" } });
    mockRequireEntitlement.mockResolvedValue({});
    mockCreateClient.mockResolvedValue({});
    mockListChannels.mockResolvedValue([]);
  });

  it("successful YouTube channel connection", async () => {
    mockResolveYouTube.mockResolvedValue({ apiKey: "yt-key", source: "organization" });
    mockResolveYouTubeChannel.mockResolvedValue({
      platform: "youtube",
      externalChannelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      externalHandle: "@GoogleDevelopers",
      displayName: "Google Developers",
      canonicalUrl: "https://youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
    });
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch-yt-1", platform: "youtube" } as never);
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "@GoogleDevelopers" }));
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(mockCreateConnectedChannel).toHaveBeenCalledWith(expect.anything(), "org-a", expect.objectContaining({ platform: "youtube", external_channel_id: "UC_x5XG1OV2P6uZZ5FSM9Ttw" }));
    expect(JSON.stringify(result)).not.toMatch(/yt-key|apiKey/);
  });

  it("normalized @handle", async () => {
    mockResolveYouTube.mockResolvedValue({ apiKey: "yt-key" } as never);
    mockResolveYouTubeChannel.mockResolvedValue({
      platform: "youtube",
      externalChannelId: "UC123",
      externalHandle: "@TestHandle",
      displayName: "Test",
      canonicalUrl: "https://youtube.com/channel/UC123",
    });
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch-1" } as never);
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "@TestHandle" }));
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(mockResolveYouTubeChannel).toHaveBeenCalledWith("@TestHandle");
  });

  it("without @ also works", async () => {
    mockResolveYouTube.mockResolvedValue({ apiKey: "yt-key" } as never);
    mockResolveYouTubeChannel.mockResolvedValue({
      platform: "youtube",
      externalChannelId: "UC123",
      externalHandle: "TestHandle",
      displayName: "Test",
      canonicalUrl: "https://youtube.com/channel/UC123",
    });
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch-1" } as never);
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "TestHandle" }));
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it("missing organization context", async () => {
    mockRequireOrg.mockRejectedValueOnce(notFoundError("Organization not found"));
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "missing", handle: "@GoogleDevelopers" }));
    expect((result as {error?: string}).error).toMatch(/not found/i);
  });

  it("missing entitlement", async () => {
    mockRequireEntitlement.mockRejectedValueOnce(forbiddenError("Organization does not have access to sponsor-sentinel"));
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "@GoogleDevelopers" }));
    expect((result as {error?: string}).error).toMatch(/does not have access/);
  });

  it("missing YouTube API key", async () => {
    mockResolveYouTube.mockResolvedValue(null);
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "@GoogleDevelopers" }));
    expect((result as {error?: string}).error).toMatch(/Configure your YouTube API key first/);
    expect((result as {error?: string}).error).toMatch(/settings\/integrations/);
    expect(mockResolveYouTubeChannel).not.toHaveBeenCalled();
  });

  it("empty handle", async () => {
    mockResolveYouTube.mockResolvedValue({ apiKey: "yt-key" } as never);
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "   " }));
    expect((result as {error?: string}).error).toMatch(/Enter a valid YouTube channel handle/);
    expect((result as {fieldErrors?: Record<string,string[]>}).fieldErrors?.handle).toBeDefined();
    expect(mockResolveYouTubeChannel).not.toHaveBeenCalled();
  });

  it("rejects URL as handle", async () => {
    mockResolveYouTube.mockResolvedValue({ apiKey: "yt-key" } as never);
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "https://youtube.com/@GoogleDevelopers" }));
    expect((result as {error?: string}).error).toMatch(/Enter a valid YouTube channel handle/);
    expect(mockResolveYouTubeChannel).not.toHaveBeenCalled();
  });

  it("YouTube channel not found", async () => {
    mockResolveYouTube.mockResolvedValue({ apiKey: "yt-key" } as never);
    mockResolveYouTubeChannel.mockResolvedValue(null);
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "@unknown12345" }));
    expect((result as {error?: string}).error).toMatch(/YouTube channel not found/);
  });

  it("invalid API key", async () => {
    mockResolveYouTube.mockResolvedValue({ apiKey: "bad-key" } as never);
    mockResolveYouTubeChannel.mockRejectedValueOnce(new YouTubeApiError({ kind: "auth", status: 401, message: "auth" }));
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "@GoogleDevelopers" }));
    expect((result as {error?: string}).error).toMatch(/YouTube API key is invalid/);
    expect((result as {error?: string}).error).not.toMatch(/bad-key/);
  });

  it("quota exceeded", async () => {
    mockResolveYouTube.mockResolvedValue({ apiKey: "yt-key" } as never);
    mockResolveYouTubeChannel.mockRejectedValueOnce(new YouTubeApiError({ kind: "quota_exceeded", status: 403, message: "quota" }));
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "@GoogleDevelopers" }));
    expect((result as {error?: string}).error).toMatch(/quota has been exceeded/);
  });

  it("duplicate channel", async () => {
    mockResolveYouTube.mockResolvedValue({ apiKey: "yt-key" } as never);
    mockResolveYouTubeChannel.mockResolvedValue({
      platform: "youtube",
      externalChannelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      externalHandle: "@GoogleDevelopers",
      displayName: "Google Developers",
      canonicalUrl: "https://youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
    });
    mockListChannels.mockResolvedValue([{ platform: "youtube", external_channel_id: "UC_x5XG1OV2P6uZZ5FSM9Ttw", external_handle: "@GoogleDevelopers" } as never]);
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "@GoogleDevelopers" }));
    expect((result as {error?: string}).error).toMatch(/already connected/);
    expect(mockCreateConnectedChannel).not.toHaveBeenCalled();
  });

  it("organization ID cannot be injected from form data", async () => {
    mockResolveYouTube.mockResolvedValue({ apiKey: "yt-key" } as never);
    mockResolveYouTubeChannel.mockResolvedValue({
      platform: "youtube",
      externalChannelId: "UC123",
      externalHandle: "@Test",
      displayName: "Test",
      canonicalUrl: "https://youtube.com/channel/UC123",
    });
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch-1" } as never);
    const f = fd({ orgSlug: "tag-esports", handle: "@Test" });
    f.set("organization_id", "org-evil");
    const result = await connectYouTubeChannelAction(f);
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(mockCreateConnectedChannel).toHaveBeenCalledWith(expect.anything(), "org-a", expect.anything());
  });

  it("no API key appears in returned result", async () => {
    mockResolveYouTube.mockResolvedValue({ apiKey: "super-secret-yt-key-12345", source: "organization" } as never);
    mockResolveYouTubeChannel.mockResolvedValue({
      platform: "youtube",
      externalChannelId: "UC123",
      externalHandle: "@Test",
      displayName: "Test",
      canonicalUrl: "https://youtube.com/channel/UC123",
    });
    mockCreateConnectedChannel.mockResolvedValue({ id: "ch-1" } as never);
    const result = await connectYouTubeChannelAction(fd({ orgSlug: "tag-esports", handle: "@Test" }));
    expect(JSON.stringify(result)).not.toMatch(/super-secret/);
  });
});

describe("channel-actions — disconnectYouTubeChannelAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrg.mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports" } } as never);
    mockRequireEntitlement.mockResolvedValue({});
    mockCreateClient.mockResolvedValue({});
  });

  it("successful YouTube disconnect", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch-yt-1", organization_id: "org-a", platform: "youtube" } as never);
    mockDeleteChannel.mockResolvedValue(undefined as never);
    const result = await disconnectYouTubeChannelAction(fd({ orgSlug: "tag-esports", channelId: "ch-yt-1" }));
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it("channel not found", async () => {
    mockGetChannel.mockRejectedValueOnce(notFoundError("Channel not found"));
    const result = await disconnectYouTubeChannelAction(fd({ orgSlug: "tag-esports", channelId: "missing" }));
    expect((result as {error?: string}).error).toMatch(/Channel not found/);
  });

  it("cross-organization rejected", async () => {
    mockGetChannel.mockRejectedValueOnce(forbiddenError("Cross-organization access denied"));
    const result = await disconnectYouTubeChannelAction(fd({ orgSlug: "tag-esports", channelId: "ch-other" }));
    expect((result as {error?: string}).error).toMatch(/Cross-organization/);
    expect(mockDeleteChannel).not.toHaveBeenCalled();
  });

  it("wrong platform rejected if provider-specific", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch-1", organization_id: "org-a", platform: "twitch" } as never);
    const result = await disconnectYouTubeChannelAction(fd({ orgSlug: "tag-esports", channelId: "ch-1" }));
    expect((result as {error?: string}).error).toMatch(/Only YouTube channels/);
    expect(mockDeleteChannel).not.toHaveBeenCalled();
  });

  it("organization ID tampering rejected", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch-yt-1", organization_id: "org-a", platform: "youtube" } as never);
    mockDeleteChannel.mockResolvedValue(undefined as never);
    const f = fd({ orgSlug: "tag-esports", channelId: "ch-yt-1" });
    f.set("organization_id", "org-evil");
    const result = await disconnectYouTubeChannelAction(f);
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(mockGetChannel).toHaveBeenCalledWith(expect.anything(), "org-a", "ch-yt-1");
  });
});

describe("channel-actions — disconnectChannelAction (generic)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrg.mockResolvedValue({ organization: { id: "org-a", slug: "tag-esports" } } as never);
    mockRequireEntitlement.mockResolvedValue({});
    mockCreateClient.mockResolvedValue({});
  });

  it("generic disconnect works for any platform", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch-1", organization_id: "org-a", platform: "youtube" } as never);
    mockDeleteChannel.mockResolvedValue(undefined as never);
    const result = await disconnectChannelAction(fd({ orgSlug: "tag-esports", channelId: "ch-1" }));
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it("generic disconnect still checks ownership", async () => {
    mockGetChannel.mockRejectedValueOnce(forbiddenError("Cross-organization access denied"));
    const result = await disconnectChannelAction(fd({ orgSlug: "tag-esports", channelId: "ch-other" }));
    expect((result as {error?: string}).error).toMatch(/Cross-organization/);
  });
});
