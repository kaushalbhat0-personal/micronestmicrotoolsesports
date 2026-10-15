import { describe, expect, it } from "vitest";
import {
  datasetKeyForVersion,
  hasNewPatch,
  latestNPatchVersions,
  parsePatchIndex,
  versionForDatasetKey,
} from "./discovery";
import patchIndexFixture from "./fixtures/patch-index.json";

describe("dota discovery", () => {
  it("detects the latest patch from a real index payload", () => {
    const discovery = parsePatchIndex(patchIndexFixture);
    expect(discovery.latest.version).toBe("7.41");
    expect(discovery.latest.upstreamId).toBe(60);
    expect(discovery.latest.releasedAt).toBe("2026-03-24T00:50:59.580Z");
  });

  it("reports no-op when the stored max id is current", () => {
    const discovery = parsePatchIndex(patchIndexFixture);
    expect(hasNewPatch(discovery, 60)).toBe(false);
    expect(hasNewPatch(discovery, 59)).toBe(true);
    expect(hasNewPatch(discovery, null)).toBe(true);
  });

  it("discovers the latest 5 for backfill without hardcoding", () => {
    const discovery = parsePatchIndex(patchIndexFixture);
    const five = latestNPatchVersions(discovery, 5);
    expect(five.map((entry) => entry.version)).toEqual(["7.37", "7.38", "7.39", "7.40", "7.41"]);
  });

  it("rejects malformed indexes", () => {
    expect(() => parsePatchIndex(null)).toThrow();
    expect(() => parsePatchIndex([])).toThrow();
    expect(() => parsePatchIndex([{ name: "bogus!!", date: "not-a-date", id: -1 }])).toThrow();
    expect(() => parsePatchIndex([{ name: "nope", date: "2026-01-01T00:00:00Z", id: 1 }])).toThrow();
  });

  it("converts between display versions and dataset keys", () => {
    expect(datasetKeyForVersion("7.41")).toBe("7_41");
    expect(datasetKeyForVersion("7.07c")).toBe("7_07c");
    expect(datasetKeyForVersion("bogus")).toBeNull();
    expect(versionForDatasetKey("7_41")).toBe("7.41");
    expect(versionForDatasetKey("nope")).toBeNull();
  });
});
