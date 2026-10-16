import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOLS } from "@/config/app/tools";
import { MARKETING_TOOLS } from "@/config/marketing/tools";
import { getHomepageToolboxItems } from "@/lib/marketing/homepage-seo";
import { toWorkspaceTools } from "@/server/services/workspace-tools";

const RELEASED = ["sponsor-sentinel", "prize-splitter", "draft-ban", "tie-breaker", "payout-tracker", "roster-builder"] as const;
const REMOVED = ["scrim-matchmaker", "vod-clipper", "roster-sentinel"] as const;

function src(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("frontend availability truth — RCCF-CLEANUP-02 (released-only catalog)", () => {
  it("registry contains exactly the six released tools", () => {
    expect(TOOLS.map((t) => t.slug).sort()).toEqual([...RELEASED].sort());
  });

  it("registry contains zero coming-soon entries", () => {
    expect(TOOLS.filter((t) => t.comingSoon)).toEqual([]);
  });

  it("registry contains none of the removed unbuilt slugs", () => {
    const slugs = new Set(TOOLS.map((t) => t.slug));
    for (const slug of REMOVED) expect(slugs.has(slug)).toBe(false);
  });

  it("marketing catalog contains exactly the six released tools, all available", () => {
    expect(MARKETING_TOOLS.map((t) => t.internalSlug).sort()).toEqual([...RELEASED].sort());
    for (const tool of MARKETING_TOOLS) expect(tool.status).toBe("available");
    const slugs = new Set(MARKETING_TOOLS.map((t) => t.slug));
    for (const slug of REMOVED) expect(slugs.has(slug)).toBe(false);
  });

  it("workspace view-model covers the released tools with no comingSoon flags", () => {
    const { entitled, available } = toWorkspaceTools(TOOLS, ["sponsor-sentinel", "prize-splitter", "draft-ban", "tie-breaker", "payout-tracker", "roster-builder"], "acme");
    const all = [...entitled, ...available];
    expect(all.map((t) => t.slug).sort()).toEqual([...RELEASED].sort());
    for (const tool of all) expect(tool.comingSoon).toBe(false);
  });

  it("footer links the released tools and none of the removed tools", () => {
    // Footer derives its Tools column from the canonical toolbox source
    // (`getHomepageToolboxItems`) — assert the wiring plus the resolved
    // entries rather than hardcoded href literals.
    const footer = src("src/components/layout/footer.tsx");
    expect(footer).toContain("getHomepageToolboxItems");
    const items = getHomepageToolboxItems();
    expect(items.map((i) => i.url)).toContain("/tools/tie-breaker");
    expect(items.map((i) => i.name)).toContain("Tie-Breaker Resolver");
    expect(items.map((i) => i.url)).toContain("/tools/prize-payout-tracker");
    expect(items.map((i) => i.name)).toContain("Prize Payout Tracker");
    expect(items.map((i) => i.url)).toContain("/tools/tournament-roster-builder");
    expect(items.map((i) => i.url)).toContain("/meta-parser");
    expect(items.map((i) => i.url)).toContain("/bgmi-qualification");
    expect(items.map((i) => i.name)).toContain("BGMI Qualification Simulator");
    for (const slug of REMOVED) expect(footer).not.toContain(slug);
    for (const name of ["Scrim Matchmaker", "VOD Clipper", "Roster Sentinel"]) {
      expect(footer).not.toContain(name);
    }
  });

  it("billing surfaces state the at-purchase-time policy without promising future tools", () => {
    const billing = src("src/features/billing/components/billing-client.tsx");
    // Explicit policy only: future tools are NOT automatically included.
    expect(billing).toContain("not automatically included");
    expect(billing).not.toMatch(/future tools are included|future tools included automatically|all future tools/i);
    expect(billing).toMatch(/currently available tools/);
    // Pricing card carries the same policy.
    expect(src("src/app/pricing/pricing-client.tsx")).toContain("not automatically included");
  });

  it("pricing offers no removed or invalid tool slug", () => {
    for (const path of ["src/app/pricing/pricing-client.tsx", "src/app/pricing/page.tsx"]) {
      const content = src(path);
      for (const slug of [...REMOVED, "draft_ban"]) {
        expect(content).not.toContain(slug);
      }
      expect(content).toContain("draft-ban");
    }
  });

  it("dashboard tool catalog shows released tools only", () => {
    const content = src("src/app/(dashboard)/dashboard/page.tsx");
    for (const slug of REMOVED) expect(content).not.toContain(slug);
    for (const name of ["Scrim Matchmaker", "VOD Clipper", "Roster Sentinel"]) {
      expect(content).not.toContain(name);
    }
  });
});
