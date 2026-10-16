import { describe, expect, it } from "vitest";
import { buildMetaParserSitemapPaths, listPublishedMetaParserPaths } from "./meta-parser-sitemap";

/**
 * Meta-Parser sitemap paths (RCCF-TOOLBOX-IA-02).
 *
 * Only published games/patches are listed; the publication filter itself
 * lives in the read repository. Never emits query-string filter URLs.
 */
describe("meta-parser sitemap paths", () => {
  it("always includes the index and sorts deterministically", () => {
    const paths = buildMetaParserSitemapPaths(
      [{ slug: "valorant" }, { slug: "dota-2" }],
      { "dota-2": ["7.41", "7.38"], valorant: ["10.08"] }
    );
    expect(paths[0]).toBe("/meta-parser");
    expect(paths).toEqual([
      "/meta-parser",
      "/meta-parser/dota-2",
      "/meta-parser/dota-2/7.38",
      "/meta-parser/dota-2/7.41",
      "/meta-parser/valorant",
      "/meta-parser/valorant/10.08",
    ]);
  });

  it("emits no duplicates and no query-string URLs", () => {
    const paths = buildMetaParserSitemapPaths([{ slug: "dota-2" }], { "dota-2": ["7.41", "7.41"] });
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).not.toContain("?");
  });

  it("fails closed to the index when the database is unreachable", async () => {
    const paths = await listPublishedMetaParserPaths();
    expect(paths[0]).toBe("/meta-parser");
    for (const path of paths) {
      expect(path.startsWith("/meta-parser")).toBe(true);
      expect(path).not.toContain("?");
    }
  });
});
