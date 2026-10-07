import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOLS } from "@/config/app/tools";
import { MARKETING_TOOLS } from "@/config/marketing/tools";
import { toWorkspaceTools } from "@/server/services/workspace-tools";

const UNRELEASED = ["scrim-matchmaker", "vod-clipper", "roster-sentinel"] as const;
const AVAILABLE = ["sponsor-sentinel", "prize-splitter", "draft-ban"] as const;

function src(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("frontend availability truth — RCCF-AVAILABILITY-UI-02", () => {
  it("Sponsorship Tracking and Prize Pool Splitter are commercially available", () => {
    const available = new Set(TOOLS.filter((t) => !t.comingSoon).map((t) => t.slug));
    for (const slug of AVAILABLE) expect(available.has(slug)).toBe(true);
  });

  it("Scrim Matchmaker, VOD Clipper, Roster Sentinel are not available", () => {
    const available = new Set(TOOLS.filter((t) => !t.comingSoon).map((t) => t.slug));
    for (const slug of UNRELEASED) expect(available.has(slug)).toBe(false);
  });

  it("registry comingSoon set is exactly the three unreleased tools", () => {
    expect(TOOLS.filter((t) => t.comingSoon).map((t) => t.slug).sort()).toEqual([...UNRELEASED].sort());
  });

  it("marketing catalog marks the same tools available vs coming-soon", () => {
    const byInternal = new Map(MARKETING_TOOLS.map((t) => [t.internalSlug, t.status]));
    expect(byInternal.get("sponsor-sentinel")).toBe("available");
    expect(byInternal.get("prize-splitter")).toBe("available");
    expect(byInternal.get("draft-ban")).toBe("available");
    for (const slug of UNRELEASED) expect(byInternal.get(slug)).toBe("coming-soon");
  });

  it("every coming-soon teaser is honestly labelled in SEO copy", () => {
    for (const tool of MARKETING_TOOLS.filter((t) => t.status === "coming-soon")) {
      expect(tool.seoDescription.toLowerCase()).toContain("coming soon");
    }
  });

  it("workspace view-model propagates comingSoon so nav renders disabled", () => {
    const { entitled, available } = toWorkspaceTools(TOOLS, ["sponsor-sentinel", "prize-splitter", "draft-ban"], "acme");
    const all = [...entitled, ...available];
    for (const slug of UNRELEASED) {
      const tool = all.find((t) => t.slug === slug);
      expect(tool).toBeDefined();
      expect(tool!.comingSoon).toBe(true);
    }
    for (const slug of AVAILABLE) {
      const tool = all.find((t) => t.slug === slug);
      expect(tool).toBeDefined();
      expect(tool!.comingSoon).toBe(false);
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

  it("pricing offers no unreleased tool", () => {
    for (const path of ["src/app/pricing/pricing-client.tsx", "src/app/pricing/page.tsx"]) {
      const content = src(path);
      for (const slug of [...UNRELEASED, "draft_ban"]) {
        expect(content).not.toContain(slug);
      }
      expect(content).toContain("draft-ban");
    }
  });

  it("dashboard tool catalog labels upcoming tools honestly", () => {
    const content = src("src/app/(dashboard)/dashboard/page.tsx");
    expect(content).toContain("Coming soon");
    expect(content).toContain("Soon");
    expect(content).toMatch(/disabled/);
  });
});
