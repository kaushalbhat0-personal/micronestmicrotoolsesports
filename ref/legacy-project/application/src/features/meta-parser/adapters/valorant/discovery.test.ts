import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasNewPatch, latestNPatchVersions, parseListingHtml } from "./discovery";

function fixture(name: string): string {
  return readFileSync(
    join(process.cwd(), "src/features/meta-parser/adapters/valorant/fixtures", name),
    "utf8"
  );
}

describe("valorant discovery", () => {
  it("detects the latest patch with version normalization and dates", () => {
    const discovery = parseListingHtml(fixture("listing.html"));
    expect(discovery.entries.map((entry) => entry.version)).toEqual([
      "13.00",
      "13.01",
      "13.02",
      "13.04",
      "13.05",
      "13.06",
      "13.08",
    ]);
    expect(discovery.latest.version).toBe("13.08");
    expect(discovery.latest.releasedAt).toBe("2026-10-13T13:00:00.000Z");
    expect(discovery.latest.datasetKey).toBe("13_08");
    expect(discovery.latest.upstreamId).toBe(13008);
    expect(discovery.latest.articleUrl).toBe(
      "https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-08"
    );
  });

  it("rejects non-patch articles (trailers, skin reveals)", () => {
    const discovery = parseListingHtml(fixture("listing.html"));
    expect(discovery.entries).toHaveLength(7);
    for (const entry of discovery.entries) {
      expect(entry.articleUrl).toContain("valorant-patch-notes-");
    }
  });

  it("normalizes slugs and derives deterministic upstream ids", () => {
    const discovery = parseListingHtml(fixture("listing.html"));
    const patch101 = discovery.entries.find((entry) => entry.version === "13.01");
    expect(patch101?.releasedAt).toBe("2026-07-14T13:00:00.000Z");
    expect(patch101?.datasetKey).toBe("13_01");
    expect(patch101?.upstreamId).toBe(13001);
  });

  it("supports the stored-max fast path and bounded backfill", () => {
    const discovery = parseListingHtml(fixture("listing.html"));
    expect(hasNewPatch(discovery, null)).toBe(true);
    expect(hasNewPatch(discovery, 13008)).toBe(false);
    expect(hasNewPatch(discovery, 13006)).toBe(true);
    expect(latestNPatchVersions(discovery, 5).map((entry) => entry.version)).toEqual([
      "13.02",
      "13.04",
      "13.05",
      "13.06",
      "13.08",
    ]);
  });

  it("throws a safe validation error on empty or patch-less listings", () => {
    expect(() => parseListingHtml("")).toThrow();
    expect(() => parseListingHtml("<html><body><p>No patches here</p></body></html>")).toThrow();
  });
});
