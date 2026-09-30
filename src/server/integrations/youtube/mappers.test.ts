import { describe, expect, it } from "vitest";
import { mapYouTubeTags, mapYouTubeVideoToCanonical, mapYouTubeVideoToLive } from "./mappers";

describe("youtube mappers", () => {
  it("maps video to canonical live (youtube_freeform tags)", () => {
    const video = {
      id: "VID1",
      snippet: {
        title: "Live Title #OurBrand",
        description: "desc",
        tags: ["Sponsor", "Gaming"],
        categoryId: "20",
        publishedAt: "2026-03-10T14:00:00Z",
        channelId: "UC123",
        liveBroadcastContent: "live",
      },
      contentDetails: { duration: "PT1H2M3S" },
      liveStreamingDetails: { actualStartTime: "2026-03-10T14:00:00Z" },
    };
    const live = mapYouTubeVideoToLive(video, "handle", "2026-03-10T14:05:00Z");
    expect(live.platform).toBe("youtube");
    expect(live.tags[0]?.source).toBe("youtube_freeform");
    expect(live.category?.id).toBe("20");
    expect(live.canonicalUrl).toBe("https://youtube.com/watch?v=VID1");
    expect(live.isLive).toBe(true);
  });

  it("maps video duration PT", () => {
    const video = {
      id: "VID2",
      snippet: {
        title: "VOD",
        description: "",
        categoryId: "20",
        publishedAt: "2026-03-10T16:00:00Z",
        channelId: "UC123",
        liveBroadcastContent: "none",
      },
      contentDetails: { duration: "PT15M51S" },
      liveStreamingDetails: { actualStartTime: "2026-03-10T14:00:00Z", actualEndTime: "2026-03-10T15:00:00Z" },
    };
    const canonical = mapYouTubeVideoToCanonical(video, "handle", "2026-03-10T16:05:00Z");
    expect(canonical.durationSeconds).toBe(951);
  });

  it("handles missing tags", () => {
    expect(mapYouTubeTags(undefined)).toEqual([]);
  });
});
