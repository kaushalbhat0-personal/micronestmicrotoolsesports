import { describe, expect, it } from "vitest";
import { assessFreshness } from "./health";

describe("assessFreshness", () => {
  it("marks never-ingested games stale", () => {
    expect(
      assessFreshness({ latestUpstreamDate: "2026-03-24T00:50:59.580Z", lastIngestedDate: null, nowIso: "2026-10-14T00:00:00Z" })
    ).toMatchObject({ stale: true, reason: "never-ingested" });
  });

  it("marks fresh games healthy", () => {
    expect(
      assessFreshness({
        latestUpstreamDate: "2026-10-10T00:00:00Z",
        lastIngestedDate: "2026-10-12T00:00:00Z",
        nowIso: "2026-10-14T00:00:00Z",
      })
    ).toMatchObject({ stale: false, reason: "fresh" });
  });

  it("flags ingest gaps over 10 days", () => {
    const result = assessFreshness({
      latestUpstreamDate: "2026-09-01T00:00:00Z",
      lastIngestedDate: "2026-09-01T00:00:00Z",
      nowIso: "2026-10-14T00:00:00Z",
    });
    expect(result.stale).toBe(true);
    expect(result.reason).toBe("stale-ingest");
    expect(result.daysSinceIngest).toBeGreaterThan(10);
  });
});
