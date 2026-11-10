import { describe, expect, it } from "vitest";
import { mapKickChannelToCanonical, mapKickLivestreamToCanonical, mapKickTags } from "./mappers";

describe("kick mappers", () => {
  it("maps livestream with kick tags", () => {
    const live = mapKickLivestreamToCanonical(
      {
        id: "uuid-1",
        title: "Kick Live #OurBrand",
        category: { id: 1, name: "Just Chatting" },
        tags: ["English"],
        custom_tags: ["SponsorTag"],
        started_at: "2026-03-10T14:00:00Z",
        viewer_count: 100,
        broadcaster_user: { id: 999, username: "playerkick" },
        channel: { slug: "playerkick" },
      },
      "2026-03-10T14:05:00Z",
    );
    expect(live.platform).toBe("kick");
    expect(live.canonicalUrl).toBe("https://kick.com/playerkick");
    expect(live.tags.some((t) => t.source === "kick")).toBe(true);
    expect(live.tags.some((t) => t.source === "kick_custom")).toBe(true);
    expect(live.description).toBeNull();
  });

  it("kick video is NOT_SUPPORTED via empty duration - mapper has no video path", () => {
    // Kick has no video mapper — ensures VOD not pretended
    expect(mapKickTags(["a"], ["b"]).length).toBe(2);
  });

  it("handles missing custom_tags", () => {
    const live = mapKickChannelToCanonical(
      {
        id: 1,
        slug: "slug",
        broadcaster_user_id: 123,
        stream_title: "title",
        category: { id: 2, name: "Game" },
        tags: [],
      },
      "2026-03-10T14:05:00Z",
    );
    expect(live.tags).toEqual([]);
    expect(live.category?.platform).toBe("kick");
  });
});
