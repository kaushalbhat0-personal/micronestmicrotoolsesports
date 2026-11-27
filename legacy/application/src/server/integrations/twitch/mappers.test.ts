import { describe, expect, it } from "vitest";
import { mapTwitchChannelInfoToCanonical, mapTwitchStreamToCanonical, mapTwitchTags, mapTwitchVideoToCanonical } from "./mappers";

describe("twitch mappers", () => {
  it("maps stream to canonical live (no provider leakage)", () => {
    const observedAt = "2026-03-10T14:05:00Z";
    const canonical = mapTwitchStreamToCanonical(
      {
        id: "stream1",
        user_id: "123",
        user_login: "player1",
        title: "Epic #OurBrand Cup",
        game_name: "League of Legends",
        game_id: "21779",
        tags: ["English"],
        started_at: "2026-03-10T14:00:00Z",
        type: "live",
      },
      observedAt,
    );
    expect(canonical.platform).toBe("twitch");
    expect(canonical.externalStreamId).toBe("stream1");
    expect(canonical.canonicalUrl).toBe("https://twitch.tv/player1");
    expect(canonical.category?.id).toBe("21779");
    expect(canonical.tags[0]?.source).toBe("twitch_curated");
    expect(canonical.observedAt).toBe(observedAt);
    // no raw game_name leakage outside category
    expect((canonical as unknown as { game_name?: string }).game_name).toBeUndefined();
  });

  it("maps video duration parsing", () => {
    const observedAt = "2026-03-10T16:05:00Z";
    const canonical = mapTwitchVideoToCanonical(
      {
        id: "v1",
        user_id: "123",
        title: "VOD",
        description: "desc",
        duration: "2h34m12s",
        created_at: "2026-03-10T14:00:00Z",
        published_at: "2026-03-10T16:00:00Z",
        viewable: "public",
        thumbnail_url: "",
        url: "https://twitch.tv/videos/v1",
      },
      "player1",
      observedAt,
    );
    expect(canonical.durationSeconds).toBe(2 * 3600 + 34 * 60 + 12);
    expect(canonical.platform).toBe("twitch");
  });

  it("handles missing optional fields", () => {
    const c = mapTwitchTags([]);
    expect(c).toEqual([]);
    const live = mapTwitchChannelInfoToCanonical(
      {
        broadcaster_id: "1",
        broadcaster_login: "login",
        broadcaster_name: "name",
        title: "",
        game_name: "",
        game_id: "",
        tags: [],
      },
      "2026-03-10T14:05:00Z",
    );
    expect(live.category).toBeNull();
  });
});
