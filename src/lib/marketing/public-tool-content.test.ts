import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildLabFaqJsonLd,
  buildLabItemListJsonLd,
  buildLabJsonLd,
  buildLabMetadata,
  getAvailableLabTools,
  getLabTool,
  getRelatedLabTools,
  labAbsoluteUrl,
  labSitemapPaths,
} from "./public-tool-content";
import { BGMI_LAB_TOOLS } from "@/config/public/bgmi-lab";

describe("public-tool-content — presentation-only helper", () => {
  it("resolves known tools and derives available-only sitemap paths from the registry", () => {
    expect(getLabTool("circle-iq")?.name).toBe("Circle IQ");
    expect(getLabTool("rotation-replay")?.name).toBe("Rotation Replay");
    expect(getLabTool("tournament-scenario-generator")?.name).toBe("Tournament Scenario Generator");
    expect(getLabTool("rotation-iq")?.name).toBe("Rotation IQ");
    expect(getLabTool("nope")).toBeNull();
    // Registry-derived: the available set and sitemap paths always agree —
    // adding a correctly registered available game needs no test update.
    expect(getAvailableLabTools().map((t) => t.slug)).toEqual(
      BGMI_LAB_TOOLS.filter((t) => t.status === "available").map((t) => t.slug)
    );
    expect(labSitemapPaths()).toEqual([
      "/bgmi-lab",
      ...BGMI_LAB_TOOLS.filter((t) => t.status === "available").map((t) => `/bgmi-lab/${t.slug}`),
    ]);
    // Experimental, planned, and archived entries never enter sitemap paths.
    for (const tool of BGMI_LAB_TOOLS.filter((t) => t.status !== "available")) {
      expect(labSitemapPaths()).not.toContain(`/bgmi-lab/${tool.slug}`);
    }
  });

  it("builds free SoftwareApplication JSON-LD with absolute URLs (price 0, no checkout)", () => {
    const tool = getLabTool("circle-iq");
    expect(tool).not.toBeNull();
    const json = buildLabJsonLd(tool!);
    expect(json["@type"]).toBe("SoftwareApplication");
    expect(json["url"]).toBe(labAbsoluteUrl("/bgmi-lab/circle-iq"));
    expect(String(json["url"])).toMatch(/^https?:\/\//);
    expect(JSON.stringify(json)).not.toMatch(/checkout|signup\?plan|PreOrder/i);
  });

  it("builds FAQ JSON-LD matching the visible registry FAQs", () => {
    const tool = getLabTool("circle-iq")!;
    const json = buildLabFaqJsonLd(tool) as { "@type": string; mainEntity: { name: string }[] };
    expect(json["@type"]).toBe("FAQPage");
    expect(json.mainEntity.map((q) => q.name)).toEqual(tool.faqs.map((f) => f.question));
  });

  it("builds an ItemList of available tools only, with absolute URLs", () => {
    const json = buildLabItemListJsonLd() as {
      "@type": string;
      numberOfItems: number;
      itemListElement: { position: number; name: string; url: string }[];
    };
    expect(json["@type"]).toBe("ItemList");
    expect(json.numberOfItems).toBe(getAvailableLabTools().length);
    expect(json.itemListElement.map((e) => e.url)).toEqual(
      getAvailableLabTools().map((t) => labAbsoluteUrl(`/bgmi-lab/${t.slug}`))
    );
    for (const entry of json.itemListElement) {
      expect(entry.url).toMatch(/^https?:\/\//);
      expect(entry.position).toBeGreaterThan(0);
    }
  });

  it("builds metadata with canonical + indexable defaults, noindex for experimental", () => {
    const tool = getLabTool("circle-iq")!;
    const meta = buildLabMetadata(tool);
    expect(meta.alternates).toEqual({ canonical: "/bgmi-lab/circle-iq" });
    expect(String(meta.title)).toContain("Circle IQ");
    expect(meta.description).toBe(tool.description);
    expect(meta.robots).toBeUndefined();
    const experimental = { ...tool, status: "experimental" as const };
    expect(buildLabMetadata(experimental).robots).toEqual({ index: false, follow: true });
  });

  it("prefers same-category games in related results (max 3, never the tool itself)", () => {
    const related = getRelatedLabTools("circle-iq");
    expect(related.length).toBeLessThanOrEqual(3);
    expect(related.map((t) => t.slug)).not.toContain("circle-iq");
    // circle-iq is practice: the first related entries should be practice tools.
    expect(related[0]?.category).toBe("practice");
    expect(related.every((t) => t.status !== "archived")).toBe(true);
  });

  it("imports no server/billing/auth boundary", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/marketing/public-tool-content.ts"), "utf8");
    for (const banned of [
      "createAdminClient",
      "service_role",
      "requireEntitlement",
      "requireOrganizationContext",
      "dodopayments",
      "razorpay",
      "server/billing",
      "supabase/admin",
    ]) {
      expect(source).not.toContain(banned);
    }
  });
});
