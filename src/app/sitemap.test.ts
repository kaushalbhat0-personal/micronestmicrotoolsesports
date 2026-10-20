import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { BGMI_LAB_TOOLS } from "@/config/public/bgmi-lab";

const RELEASED_TOOL_URLS = [
  "/tools/sponsorship-tracking",
  "/tools/prize-pool-splitter",
  "/tools/draft-ban",
  "/tools/tie-breaker",
  "/tools/prize-payout-tracker",
  "/tools/tournament-roster-builder",
];
const REMOVED_TOOL_URLS = ["/tools/scrim-matchmaker", "/tools/vod-clipper", "/tools/roster-sentinel"];

describe("sitemap — RCCF-CLEANUP-02 (released tools only) + RCCF-TOOLBOX-IA-02 (meta-parser)", () => {
  it("contains exactly the six released tool URLs", async () => {
    const urls = (await sitemap()).map((e) => new URL(e.url, "http://localhost:3000").pathname);
    for (const path of RELEASED_TOOL_URLS) expect(urls).toContain(path);
  });

  it("contains none of the removed unbuilt tool URLs", async () => {
    const urls = (await sitemap()).map((e) => new URL(e.url, "http://localhost:3000").pathname);
    for (const path of REMOVED_TOOL_URLS) expect(urls).not.toContain(path);
  });

  it("still exposes the collection, pricing, and legal surfaces", async () => {
    const urls = (await sitemap()).map((e) => new URL(e.url, "http://localhost:3000").pathname);
    for (const path of ["/", "/tools", "/pricing", "/contact"]) expect(urls).toContain(path);
  });

  it("exposes the Meta-Parser index without query-string URLs", async () => {
    const urls = (await sitemap()).map((e) => new URL(e.url, "http://localhost:3000").pathname);
    expect(urls).toContain("/meta-parser");
    for (const url of urls) expect(url).not.toContain("?");
  });

  it("exposes the BGMI Tournament Hub and qualification simulator", async () => {
    const urls = (await sitemap()).map((e) => new URL(e.url, "http://localhost:3000").pathname);
    expect(urls).toContain("/bgmi-qualification");
    expect(urls).toContain("/bgmi-tournaments");
  });

  it("exposes the BGMI Lab index, its available drills, and Paid Tools — derived from the registry", async () => {
    const urls = (await sitemap()).map((e) => new URL(e.url, "http://localhost:3000").pathname);
    expect(urls).toContain("/bgmi-lab");
    // Registry-derived: every available Lab game automatically enters
    // sitemap coverage — no per-game allowlist to update.
    const available = BGMI_LAB_TOOLS.filter((t) => t.status === "available");
    expect(available.length).toBeGreaterThan(0);
    for (const tool of available) {
      expect(urls).toContain(`/bgmi-lab/${tool.slug}`);
    }
    // Explicit pins for the shipped drills keep the intent readable.
    for (const path of ["/bgmi-lab/circle-iq", "/bgmi-lab/rotation-replay", "/bgmi-lab/zone-patterns", "/bgmi-lab/tournament-scenario-generator"]) {
      expect(urls).toContain(path);
    }
    expect(urls).toContain("/paid-tools");
    // Planned, experimental, and archived entries never enter the sitemap.
    for (const tool of BGMI_LAB_TOOLS.filter((t) => t.status !== "available")) {
      expect(urls).not.toContain(`/bgmi-lab/${tool.slug}`);
    }
  });
});
