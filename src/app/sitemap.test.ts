import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

const RELEASED_TOOL_URLS = [
  "/tools/sponsorship-tracking",
  "/tools/prize-pool-splitter",
  "/tools/draft-ban",
  "/tools/tie-breaker",
];
const REMOVED_TOOL_URLS = ["/tools/scrim-matchmaker", "/tools/vod-clipper", "/tools/roster-sentinel"];

describe("sitemap — RCCF-CLEANUP-02 (released tools only)", () => {
  it("contains exactly the four released tool URLs", () => {
    const urls = sitemap().map((e) => new URL(e.url, "http://localhost:3000").pathname);
    for (const path of RELEASED_TOOL_URLS) expect(urls).toContain(path);
  });

  it("contains none of the removed unbuilt tool URLs", () => {
    const urls = sitemap().map((e) => new URL(e.url, "http://localhost:3000").pathname);
    for (const path of REMOVED_TOOL_URLS) expect(urls).not.toContain(path);
  });

  it("still exposes the collection, pricing, and legal surfaces", () => {
    const urls = sitemap().map((e) => new URL(e.url, "http://localhost:3000").pathname);
    for (const path of ["/", "/tools", "/pricing", "/contact"]) expect(urls).toContain(path);
  });
});
