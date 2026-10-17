import { describe, expect, it } from "vitest";
import { buildBgmiTournamentSitemapPaths } from "./bgmi-tournaments-sitemap";

describe("BGMI sitemap paths", () => {
  it("always includes the hub index", () => {
    expect(buildBgmiTournamentSitemapPaths([])).toEqual(["/bgmi-tournaments"]);
  });

  it("emits deterministic tournament + stage paths with no query strings", () => {
    const paths = buildBgmiTournamentSitemapPaths([
      { slug: "bmsd-2026", stages: [{ slug: "playoffs" }, { slug: "grand-finals" }] },
    ]);
    expect(paths).toEqual([
      "/bgmi-tournaments",
      "/bgmi-tournaments/bmsd-2026",
      "/bgmi-tournaments/bmsd-2026/grand-finals",
      "/bgmi-tournaments/bmsd-2026/playoffs",
    ]);
    for (const path of paths) expect(path).not.toContain("?");
  });

  it("deduplicates repeated entries", () => {
    const paths = buildBgmiTournamentSitemapPaths([
      { slug: "bmsd-2026", stages: [{ slug: "grand-finals" }, { slug: "grand-finals" }] },
      { slug: "bmsd-2026", stages: [] },
    ]);
    expect(paths).toEqual(["/bgmi-tournaments", "/bgmi-tournaments/bmsd-2026", "/bgmi-tournaments/bmsd-2026/grand-finals"]);
  });
});
