import { describe, expect, it } from "vitest";
import { getTwitchCapabilities } from "./twitch";
import { getKickCapabilities } from "./kick";
import { getYouTubeCapabilities } from "./youtube";

describe("subscription capabilities", () => {
  it("twitch supports webhooks with 3 sentinel types", () => {
    const caps = getTwitchCapabilities();
    expect(caps.supportsWebhooks).toBe(true);
    expect(caps.supportsCreate).toBe(true);
    expect(caps.supportsDelete).toBe(true);
    expect(caps.supportsList).toBe(true);
    expect(caps.supportsExpiration).toBe(false);
    expect(caps.supportedEventTypes).toEqual(["stream.online", "stream.offline", "channel.update"]);
  });

  it("kick supports webhooks with 2 sentinel types", () => {
    const caps = getKickCapabilities();
    expect(caps.supportsWebhooks).toBe(true);
    expect(caps.supportedEventTypes).toEqual(["livestream.metadata.updated", "livestream.status.updated"]);
    expect(caps.supportsList).toBe(true);
  });

  it("youtube supports websub with lease but no list", () => {
    const caps = getYouTubeCapabilities();
    expect(caps.supportsWebhooks).toBe(true);
    expect(caps.supportsExpiration).toBe(true);
    expect(caps.supportsList).toBe(false);
    expect(caps.supportedEventTypes).toEqual(["video_published"]);
  });

  it("unsupported event rejected per provider", async () => {
    const { TwitchSubscriptionAdapter } = await import("./twitch");
    const { KickSubscriptionAdapter } = await import("./kick");
    // Use dummy clients with mock fetch that should not be called
    const twitchClient = { createEventSubSubscription: async () => { throw new Error("should not call"); } } as never;
    const kickClient = { createEventSubscriptions: async () => { throw new Error("should not call"); } } as never;
    const t = new TwitchSubscriptionAdapter(twitchClient);
    const k = new KickSubscriptionAdapter(kickClient);
    const tr = await t.create({ organizationId: "org", platform: "twitch", externalChannelId: "123", eventType: "channel.follow" });
    expect(tr.status).toBe("unsupported");
    const kr = await k.create({ organizationId: "org", platform: "kick", externalChannelId: "123", eventType: "chat.message.sent" });
    expect(kr.status).toBe("unsupported");
  });
});
