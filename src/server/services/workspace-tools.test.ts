import { describe, expect, it } from "vitest";
import { TOOLS } from "@/config/app/tools";
import { toWorkspaceTools } from "./workspace-tools";

const ALL_COMMERCIAL = ["sponsor-sentinel", "prize-splitter", "draft-ban", "tie-breaker"];

describe("toWorkspaceTools — entitled workspace sidebar model", () => {
  it("entitled commercial tools appear in entitled", () => {
    const { entitled } = toWorkspaceTools(TOOLS, ALL_COMMERCIAL, "acme");
    expect(entitled.map((t) => t.slug).sort()).toEqual([...ALL_COMMERCIAL].sort());
  });

  it("unentitled commercial tools do NOT appear in entitled", () => {
    const { entitled } = toWorkspaceTools(TOOLS, ["sponsor-sentinel"], "acme");
    expect(entitled.map((t) => t.slug)).toEqual(["sponsor-sentinel"]);
    expect(entitled.some((t) => t.slug === "draft-ban")).toBe(false);
  });

  it("coming-soon tools never appear in entitled", () => {
    const { entitled } = toWorkspaceTools(TOOLS, ["sponsor-sentinel", "scrim-matchmaker", "vod-clipper", "roster-sentinel"], "acme");
    expect(entitled.map((t) => t.slug)).toEqual(["sponsor-sentinel"]);
  });

  it("sponsor subItems are Campaigns, Checks, Channels, Connections with exact hrefs", () => {
    const { entitled } = toWorkspaceTools(TOOLS, ["sponsor-sentinel"], "tag-esports");
    const sponsor = entitled.find((t) => t.slug === "sponsor-sentinel");
    expect(sponsor).toBeDefined();
    expect(sponsor!.subItems!.map((s) => s.label)).toEqual(["Campaigns", "Checks", "Channels", "Connections"]);
    const hrefs = Object.fromEntries(sponsor!.subItems!.map((s) => [s.label, s.href]));
    expect(hrefs["Campaigns"]).toBe("/dashboard/tag-esports/sponsor-sentinel/campaigns");
    expect(hrefs["Checks"]).toBe("/dashboard/tag-esports/sponsor-sentinel/scans");
    expect(hrefs["Channels"]).toBe("/dashboard/tag-esports/channels");
    expect(hrefs["Connections"]).toBe("/dashboard/tag-esports/connections");
  });

  it("operational tools expose no subItems (no parent/child duplication)", () => {
    const { entitled } = toWorkspaceTools(TOOLS, ALL_COMMERCIAL, "acme");
    for (const slug of ["prize-splitter", "draft-ban", "tie-breaker"]) {
      const tool = entitled.find((t) => t.slug === slug);
      expect(tool).toBeDefined();
      expect(tool!.subItems ?? []).toEqual([]);
      expect(tool!.href).toBe(`/dashboard/acme/${slug}`);
    }
  });

  it("org slug interpolates into every href", () => {
    const { entitled } = toWorkspaceTools(TOOLS, ALL_COMMERCIAL, "my-org-123");
    for (const tool of entitled) {
      expect(tool.href).toContain("/dashboard/my-org-123/");
      for (const sub of tool.subItems ?? []) {
        expect(sub.href).toContain("/dashboard/my-org-123/");
      }
    }
  });

  it("Case 1: Sponsorship + Prize + Tie-Breaker entitled → Draft & Ban absent", () => {
    const { entitled } = toWorkspaceTools(TOOLS, ["sponsor-sentinel", "prize-splitter", "tie-breaker"], "acme");
    expect(entitled.map((t) => t.slug).sort()).toEqual(["prize-splitter", "sponsor-sentinel", "tie-breaker"].sort());
  });

  it("Case 2: Sponsorship only → only Sponsorship Tracking under Your Tools", () => {
    const { entitled } = toWorkspaceTools(TOOLS, ["sponsor-sentinel"], "acme");
    expect(entitled).toHaveLength(1);
    expect(entitled[0]!.slug).toBe("sponsor-sentinel");
  });

  it("Case 3: no commercial entitlement → no operational tool links", () => {
    const { entitled } = toWorkspaceTools(TOOLS, [], "acme");
    expect(entitled).toHaveLength(0);
  });

  it("Case 4/5: Channels + Connections follow Sponsorship entitlement only", () => {
    const withSponsor = toWorkspaceTools(TOOLS, ["sponsor-sentinel"], "acme").entitled.find((t) => t.slug === "sponsor-sentinel");
    expect(withSponsor!.subItems!.some((s) => s.label === "Channels")).toBe(true);
    expect(withSponsor!.subItems!.some((s) => s.label === "Connections")).toBe(true);
    const withoutSponsor = toWorkspaceTools(TOOLS, ["prize-splitter"], "acme").entitled;
    expect(withoutSponsor.some((t) => t.slug === "sponsor-sentinel")).toBe(false);
  });

  it("exposes no database IDs or entitlement details", () => {
    const { entitled } = toWorkspaceTools(TOOLS, ALL_COMMERCIAL, "acme");
    const json = JSON.stringify(entitled);
    expect(json).not.toMatch(/entitlement_id|organization_id|tool_id/);
    const allowed = new Set(["slug", "name", "internalSlug", "description", "icon", "href", "entitled", "comingSoon", "subItems", "label"]);
    const collectKeys = (v: unknown): string[] => {
      if (Array.isArray(v)) return v.flatMap(collectKeys);
      if (v && typeof v === "object") return Object.entries(v as Record<string, unknown>).flatMap(([k, val]) => [k, ...collectKeys(val)]);
      return [];
    };
    for (const key of collectKeys(entitled)) {
      expect(allowed.has(key)).toBe(true);
    }
  });
});
