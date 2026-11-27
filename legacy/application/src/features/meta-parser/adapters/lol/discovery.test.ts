import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  findDateForward,
  hasNewPatch,
  latestNPatchVersions,
  parseListingHtml,
} from "./discovery";

function fixture(name: string): string {
  return readFileSync(join(process.cwd(), "src/features/meta-parser/adapters/lol/fixtures", name), "utf8");
}

describe("lol discovery", () => {
  it("detects five patches with deterministic versions and upstream ids", () => {
    const discovery = parseListingHtml(fixture("listing.html"));
    expect(discovery.entries.map((entry) => entry.version)).toEqual([
      "26.16",
      "26.17",
      "26.18",
      "26.19",
      "26.20",
    ]);
    expect(discovery.latest.version).toBe("26.20");
    expect(discovery.latest.releasedAt).toBe("2026-10-06T18:00:00.000Z");
    expect(discovery.latest.datasetKey).toBe("26_20");
    expect(discovery.latest.upstreamId).toBe(26020);
    expect(discovery.latest.articleUrl).toBe(
      "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes"
    );
  });

  it("associates each card with its own forward date, never a neighbor", () => {
    const discovery = parseListingHtml(fixture("listing.html"));
    const byVersion = new Map(discovery.entries.map((entry) => [entry.version, entry.releasedAt]));
    // 26.19 sits next to a 09-28 non-patch card and 26.20's 10-06 card:
    // a backward search would misattribute either of those.
    expect(byVersion.get("26.19")).toBe("2026-09-22T18:00:00.000Z");
    expect(byVersion.get("26.18")).toBe("2026-09-09T18:00:00.000Z");
    expect(byVersion.get("26.17")).toBe("2026-08-25T18:00:00.000Z");
    expect(byVersion.get("26.16")).toBe("2026-08-11T18:00:00.000Z");
  });

  it("rejects non-patch articles, dateless cards, and duplicates", () => {
    const discovery = parseListingHtml(fixture("listing.html"));
    // Trailer + TFT links never match; the dateless 26.15 card is skipped;
    // so are the dateless 26.14 (before another patch) and 26.13 (before a
    // non-patch card) probes; the duplicated 26.20 href collapses to one.
    expect(discovery.entries).toHaveLength(5);
    for (const entry of discovery.entries) {
      expect(entry.articleUrl).toContain("league-of-legends-patch-");
    }
    expect(discovery.entries.some((entry) => entry.version === "26.15")).toBe(false);
    expect(discovery.entries.some((entry) => entry.version === "26.14")).toBe(false);
    expect(discovery.entries.some((entry) => entry.version === "26.13")).toBe(false);
  });

  it("bounds the date search to the card anchor, never the next card", () => {
    // Dateless 26.14 sits immediately before dated 26.16: an unbounded
    // forward search would steal 26.16's date; the anchor bound skips it.
    const html = fixture("listing.html");
    const dateless = html.indexOf("26-14-notes");
    const next = html.indexOf("26-16-notes", dateless);
    expect(next).toBeGreaterThan(dateless);
    expect(findDateForward(html, dateless)).toBeNull();
  });

  it("bounds the date search before a following non-patch timestamp", () => {
    // Dateless 26.13 sits immediately before the trailer card (09-28):
    // only the card's own anchor region is searchable.
    const html = fixture("listing.html");
    const dateless = html.indexOf("26-13-notes");
    expect(findDateForward(html, dateless)).toBeNull();
  });

  it("findDateForward never searches backwards", () => {
    // A patch link preceded (within the window) by another card's date and
    // followed by nothing must yield null — never the neighbor's date.
    const html =
      `<a href="/en-us/news/game-updates/league-of-legends-patch-26-21-notes">x</a>` +
      `<div><time dateTime="2026-10-21T18:00:00.000Z">x</time></div>`.padEnd(1900, " ") +
      `<a href="/en-us/news/game-updates/league-of-legends-patch-26-22-notes">y</a>`;
    const second = html.indexOf("26-22-notes");
    expect(findDateForward(html, second)).toBeNull();
  });

  it("supports the stored-max fast path and bounded backfill", () => {
    const discovery = parseListingHtml(fixture("listing.html"));
    expect(hasNewPatch(discovery, null)).toBe(true);
    expect(hasNewPatch(discovery, 26020)).toBe(false);
    expect(hasNewPatch(discovery, 26018)).toBe(true);
    expect(latestNPatchVersions(discovery, 5).map((entry) => entry.version)).toEqual([
      "26.16",
      "26.17",
      "26.18",
      "26.19",
      "26.20",
    ]);
  });

  it("throws a safe validation error on empty or patch-less listings", () => {
    expect(() => parseListingHtml("")).toThrow();
    expect(() => parseListingHtml("<html><body><p>No patches here</p></body></html>")).toThrow();
  });
});
