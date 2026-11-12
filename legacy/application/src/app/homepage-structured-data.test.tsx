import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAvailableTools } from "@/config/marketing/tools";
import {
  HOMEPAGE_DESCRIPTION,
  HOMEPAGE_TITLE,
  buildHomepageItemListJsonLd,
  buildHomepageOrganizationJsonLd,
  buildHomepageWebsiteJsonLd,
  getHomepageToolboxItems,
} from "@/lib/marketing/homepage-seo";

/**
 * Homepage toolbox structured-data tests (identity/metadata stage).
 *
 * Homepage UI is intentionally unchanged in this stage — only `<title>`,
 * meta/OG/Twitter, and JSON-LD are toolbox-first. These tests pin the
 * structured-data contract: valid Organization/WebSite, an ItemList of
 * the released tools with canonical routes, truthful
 * SoftwareApplication fields only, and no hidden-FAQ markup.
 */

const HOMEPAGE = "src/app/page.tsx";

function sourceOf(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const EXPECTED_ROUTES = [
  "/tools/sponsorship-tracking",
  "/tools/prize-pool-splitter",
  "/tools/draft-ban",
  "/tools/tie-breaker",
  "/tools/prize-payout-tracker",
  "/tools/tournament-roster-builder",
  "/meta-parser",
  "/bgmi-qualification",
  "/bgmi-tournaments",
];

describe("homepage toolbox items derive from existing sources (no duplicated registry)", () => {
  it("contains the released tools in stable derived positions", () => {
    const items = getHomepageToolboxItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items.map((i) => i.position)).toEqual(items.map((_, i) => i + 1));
    expect(items.map((i) => i.url)).toEqual(EXPECTED_ROUTES);
  });

  it("workspace entries mirror the canonical marketing registry 1:1", () => {
    const items = getHomepageToolboxItems();
    const registry = getAvailableTools();
    expect(registry).toHaveLength(6);
    for (let i = 0; i < registry.length; i++) {
      expect(items[i]?.name).toBe(registry[i]?.name);
      expect(items[i]?.url).toBe(`/tools/${registry[i]?.slug}`);
      expect(items[i]?.kind).toBe("workspace-tool");
    }
  });

  it("Meta-Parser sits at position seven as public patch intelligence, not workspace SaaS", () => {
    const last = getHomepageToolboxItems()[6];
    expect(last?.name).toBe("Meta-Parser — Patch Notes Intelligence");
    expect(last?.url).toBe("/meta-parser");
    expect(last?.kind).toBe("patch-intelligence");
  });

  it("BGMI simulator sits at position eight as a free public microtool, not workspace SaaS", () => {
    const last = getHomepageToolboxItems()[7];
    expect(last?.name).toBe("BGMI Qualification Simulator");
    expect(last?.url).toBe("/bgmi-qualification");
    expect(last?.kind).toBe("public-microtool");
  });

  it("BGMI Tournament Hub closes the list as public tournament information, not workspace SaaS", () => {
    const last = getHomepageToolboxItems()[8];
    expect(last?.name).toBe("BGMI Tournament Hub");
    expect(last?.url).toBe("/bgmi-tournaments");
    expect(last?.kind).toBe("tournament-hub");
  });

  it("never includes removed or unreleased tools", () => {
    const haystack = JSON.stringify(getHomepageToolboxItems()).toLowerCase();
    for (const slug of ["scrim-matchmaker", "vod-clipper", "roster-sentinel"]) {
      expect(haystack).not.toContain(slug);
    }
    expect(getHomepageToolboxItems().map((i) => i.name)).not.toContain("Scrim Matchmaker");
  });
});

describe("Organization JSON-LD represents MicroNest itself", () => {
  it("is valid with no company-registration or secret claims", () => {
    const org = buildHomepageOrganizationJsonLd("https://example.com");
    expect(org["@context"]).toBe("https://schema.org");
    expect(org["@type"]).toBe("Organization");
    expect(org["name"]).toBe("MicroNest");
    expect(org["url"]).toBe("https://example.com");
    expect(String(org["description"]).toLowerCase()).toContain("toolbox behind esports");
    const raw = JSON.stringify(org).toLowerCase();
    expect(raw).not.toMatch(/gst|cin|llp|private limited|registration|secret|api[_-]?key/);
  });

  it("homepage wires the Organization builder (no hardcoded sponsorship copy)", () => {
    const code = sourceOf(HOMEPAGE);
    expect(code).toContain("buildHomepageOrganizationJsonLd");
    expect(code).not.toContain("Sponsorship Tracking for esports creators and teams.");
  });
});

describe("WebSite JSON-LD represents the toolbox site", () => {
  it("is valid and toolbox-first without a fabricated SearchAction", () => {
    const site = buildHomepageWebsiteJsonLd("https://example.com");
    expect(site["@type"]).toBe("WebSite");
    expect(site["name"]).toBe("MicroNest");
    expect(site["url"]).toBe("https://example.com");
    expect(String(site["description"]).toLowerCase()).toContain("toolbox behind esports");
    expect(JSON.stringify(site)).not.toContain("SearchAction");
  });

  it("homepage wires the WebSite builder", () => {
    expect(sourceOf(HOMEPAGE)).toContain("buildHomepageWebsiteJsonLd");
  });
});

describe("ItemList JSON-LD lists the released tools (count derived, never hardcoded)", () => {
  it("has positions, names, and canonical routes", () => {
    const list = buildHomepageItemListJsonLd();
    expect(list["@type"]).toBe("ItemList");
    expect(list["numberOfItems"]).toBe(getHomepageToolboxItems().length);
    const elements = list["itemListElement"] as Array<Record<string, unknown>>;
    expect(elements).toHaveLength(getHomepageToolboxItems().length);
    elements.forEach((el, i) => {
      expect(el["@type"]).toBe("ListItem");
      expect(el["position"]).toBe(i + 1);
    });
    expect(elements.map((el) => el["url"])).toEqual(EXPECTED_ROUTES);
  });

  it("contains only truthful SoftwareApplication fields — no ratings, prices, or reviews", () => {
    const raw = JSON.stringify(buildHomepageItemListJsonLd());
    for (const banned of ["aggregateRating", "reviewCount", "review", "price", "offers", "downloadUrl"]) {
      expect(raw).not.toContain(banned);
    }
    // Workspace tools share the per-tool-page SoftwareApplication shape.
    expect(raw).toContain('"@type":"SoftwareApplication"');
    expect(raw).toContain('"applicationCategory":"BusinessApplication"');
    expect(raw).toContain('"operatingSystem":"Web"');
  });

  it("Meta-Parser is a WebPage with public-facts framing, never predictions or coaching", () => {
    const raw = JSON.stringify(buildHomepageItemListJsonLd()).toLowerCase();
    for (const claim of ["predict", "recommendation", "coaching", "guaranteed", "live meta"]) {
      expect(raw).not.toContain(claim);
    }
    const elements = buildHomepageItemListJsonLd()["itemListElement"] as Array<Record<string, unknown>>;
    const meta = elements[6]?.["item"] as Record<string, unknown>;
    expect(meta["@type"]).toBe("WebPage");
    expect(meta["url"]).toBe("/meta-parser");
  });

  it("BGMI simulator is a SoftwareApplication with no outcome promises", () => {
    const raw = JSON.stringify(buildHomepageItemListJsonLd()).toLowerCase();
    for (const claim of ["guaranteed", "safe", "will qualify", "prediction"]) {
      expect(raw).not.toContain(claim);
    }
    const elements = buildHomepageItemListJsonLd()["itemListElement"] as Array<Record<string, unknown>>;
    const bgmi = elements[7]?.["item"] as Record<string, unknown>;
    expect(bgmi["@type"]).toBe("SoftwareApplication");
    expect(bgmi["url"]).toBe("/bgmi-qualification");
  });

  it("BGMI Tournament Hub is a WebPage with standings framing, never predictions", () => {
    const raw = JSON.stringify(buildHomepageItemListJsonLd()).toLowerCase();
    for (const claim of ["guaranteed", "will qualify", "prediction", "live standings", "real-time"]) {
      expect(raw).not.toContain(claim);
    }
    const elements = buildHomepageItemListJsonLd()["itemListElement"] as Array<Record<string, unknown>>;
    const hub = elements[8]?.["item"] as Record<string, unknown>;
    expect(hub["@type"]).toBe("WebPage");
    expect(hub["url"]).toBe("/bgmi-tournaments");
  });

  it("homepage wires the ItemList builder", () => {
    expect(sourceOf(HOMEPAGE)).toContain("buildHomepageItemListJsonLd");
  });
});

describe("no FAQ JSON-LD without visible FAQ content", () => {
  it("emits no FAQPage markup and adds no hidden SEO-only FAQ copy", () => {
    const code = sourceOf(HOMEPAGE);
    expect(code).not.toContain("FAQPage");
    expect(code).not.toContain("mainEntity");
    const seoRaw = JSON.stringify({
      title: HOMEPAGE_TITLE,
      description: HOMEPAGE_DESCRIPTION,
      list: buildHomepageItemListJsonLd(),
    });
    expect(seoRaw).not.toContain("FAQPage");
  });
});

describe("homepage UI reflects the toolbox IA", () => {
  it("composes the three-pillar sections with no sponsorship remnants", () => {
    const code = sourceOf(HOMEPAGE);
    for (const marker of [
      "ToolboxHero",
      "PillarSection",
      "LabFeatureSection",
      "ToolboxGroups",
      "CompetitionStrip",
      "HowItWorks",
      "PricingReassurance",
      "PhilosophySection",
      "TrustSection",
      "FinalToolboxCTA",
    ]) {
      expect(code).toContain(marker);
    }
    expect(code).not.toContain("ProofStrip");
    expect(code).not.toContain("Prove every sponsor deliverable.");
    expect(code).not.toContain("sponsorship-tracking-monthly");
  });
});
