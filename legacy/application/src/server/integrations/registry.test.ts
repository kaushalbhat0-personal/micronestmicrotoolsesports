import { describe, expect, it, beforeEach, vi } from "vitest";
import { createProviderRegistry } from "./registry";
import { TwitchClient } from "./twitch/client";
import { YouTubeClient } from "./youtube/client";
import { KickClient } from "./kick/client";

describe("provider registry final topology", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.KICK_CLIENT_ID;
    delete process.env.KICK_CLIENT_SECRET;
  });

  it("all real when credentials exist", () => {
    process.env.TWITCH_CLIENT_ID = "cid";
    process.env.TWITCH_CLIENT_SECRET = "csec";
    process.env.YOUTUBE_API_KEY = "ytkey";
    process.env.KICK_CLIENT_ID = "kcid";
    process.env.KICK_CLIENT_SECRET = "kcsec";

    const reg = createProviderRegistry();
    // Check platform property
    expect(reg.twitch.platform).toBe("twitch");
    expect(reg.youtube.platform).toBe("youtube");
    expect(reg.kick.platform).toBe("kick");
    // Real providers have specific methods (e.g., Twitch has getStreams, YouTube has searchList)
    // Mock providers also have same interface, but we can check that real provider's client is used
    // For Twitch real, it should not be the mock singleton (mock has setConfig)
    expect(typeof (reg.twitch as unknown as { clearCache?: unknown }).clearCache).toBe("function"); // TwitchProvider has clearCache
    expect(typeof (reg.youtube as unknown as { clearCache?: unknown }).clearCache).toBe("function"); // YouTubeProvider has clearCache
    expect(typeof (reg.kick as unknown as { clearCache?: unknown }).clearCache).toBe("function"); // KickProvider has clearCache
  });

  it("falls back to mock when credentials missing", () => {
    const reg = createProviderRegistry();
    // Without env, all should be mock (mock has setConfig)
    expect(typeof (reg.twitch as unknown as { setConfig?: unknown }).setConfig).toBe("function");
    expect(typeof (reg.youtube as unknown as { setConfig?: unknown }).setConfig).toBe("function");
    expect(typeof (reg.kick as unknown as { setConfig?: unknown }).setConfig).toBe("function");
  });

  it("forceMock still works", () => {
    process.env.TWITCH_CLIENT_ID = "cid";
    process.env.TWITCH_CLIENT_SECRET = "csec";
    process.env.YOUTUBE_API_KEY = "ytkey";
    process.env.KICK_CLIENT_ID = "kcid";
    process.env.KICK_CLIENT_SECRET = "kcsec";

    const reg = createProviderRegistry({ forceMockTwitch: true, forceMockYouTube: true, forceMockKick: true });
    expect(typeof (reg.twitch as unknown as { setConfig?: unknown }).setConfig).toBe("function");
    expect(typeof (reg.youtube as unknown as { setConfig?: unknown }).setConfig).toBe("function");
    expect(typeof (reg.kick as unknown as { setConfig?: unknown }).setConfig).toBe("function");
  });

  it("explicit client injection works", () => {
    const twitchClient = new TwitchClient({ clientId: "cid2", clientSecret: "csec2" });
    const youtubeClient = new YouTubeClient({ apiKey: "yt2" });
    const kickClient = new KickClient({ clientId: "kcid2", clientSecret: "kcsec2" });
    const reg = createProviderRegistry({ twitchClient, youtubeClient, kickClient });
    expect(reg.twitch.platform).toBe("twitch");
    expect(reg.youtube.platform).toBe("youtube");
    expect(reg.kick.platform).toBe("kick");
  });
});
