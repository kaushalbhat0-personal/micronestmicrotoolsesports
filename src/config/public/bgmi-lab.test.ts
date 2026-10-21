import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BGMI_LAB_TOOLS, getAvailableBgmiLabTools, getBgmiLabTool, isLabSlugRoutable } from "./bgmi-lab";

const SOURCE = readFileSync(join(process.cwd(), "src/config/public/bgmi-lab.ts"), "utf8");

describe("bgmi-lab registry — structural separation", () => {
  it("registers the eight Lab tools with the canonical scenario-generator slug", () => {
    expect(BGMI_LAB_TOOLS.map((t) => t.slug).sort()).toEqual(
      [
        "circle-iq",
        "final-circle",
        "igl-decision-drill",
        "lift-the-trophy",
        "rotation-iq",
        "rotation-replay",
        "tournament-scenario-generator",
        "zone-patterns",
      ].sort()
    );
    // The near-colliding planned stub is gone: exactly one canonical product.
    expect(getBgmiLabTool("tournament-scenarios")).toBeNull();
  });

  it("exposes circle-iq, zone-patterns, rotation-replay, and tournament-scenario-generator as available", () => {
    expect(BGMI_LAB_TOOLS.filter((t) => t.status === "available").map((t) => t.slug)).toEqual([
      "circle-iq",
      "igl-decision-drill",
      "zone-patterns",
      "rotation-replay",
      "tournament-scenario-generator",
    ]);
  });

  it("has unique slugs and required presentation fields", () => {
    const slugs = BGMI_LAB_TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const t of BGMI_LAB_TOOLS) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.tagline.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.methodology.length).toBeGreaterThan(0);
      expect(t.instructions.length).toBeGreaterThan(0);
      expect(t.faqs.length).toBeGreaterThan(0);
    }
  });

  it("carries no plan, price, workspace, or billing fields", () => {
    for (const t of BGMI_LAB_TOOLS) {
      const keys = Object.keys(t);
      for (const forbidden of ["internalSlug", "planId", "price", "entitlement", "comingSoon", "planPrefix"]) {
        expect(keys).not.toContain(forbidden);
      }
    }
    // Strip doc comments: the boundary is documented in prose, but no code
    // binding (property, import, identifier use) may reference it.
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const banned of [
      "internalSlug",
      "TOOL_PLAN_PREFIX",
      "createAdminClient",
      "service_role",
      "requireEntitlement",
      "requireOrganizationContext",
      "dodopayments",
      "razorpay",
    ]) {
      expect(code).not.toContain(banned);
    }
    expect(code).not.toMatch(/from\s+["']@\/server\/billing/);
    expect(code).not.toMatch(/from\s+["']@\/lib\/supabase\/admin["']/);
  });

  it("uses only known status/category/scenarioKind values", () => {
    for (const t of BGMI_LAB_TOOLS) {
      expect(["available", "planned", "experimental", "archived"]).toContain(t.status);
      expect(["practice", "learn", "fun"]).toContain(t.category);
      expect(["synthetic", "tournament-derived"]).toContain(t.scenarioKind);
    }
  });

  it("maps every slug to its product-family category", () => {
    const expected: Record<string, string> = {
      "circle-iq": "practice",
      "rotation-iq": "practice",
      "igl-decision-drill": "practice",
      "final-circle": "practice",
      "tournament-scenario-generator": "practice",
      "zone-patterns": "learn",
      "rotation-replay": "learn",
      "lift-the-trophy": "fun",
    };
    for (const [slug, category] of Object.entries(expected)) {
      expect(getBgmiLabTool(slug)?.category).toBe(category);
    }
  });

  it("holds the available-game content contract (no filler, no prediction claims)", () => {
    const available = BGMI_LAB_TOOLS.filter((t) => t.status === "available");
    expect(available.length).toBeGreaterThan(0);
    for (const t of available) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.tagline.length).toBeGreaterThan(0);
      expect(t.answer?.length ?? 0).toBeGreaterThan(40);
      expect(t.methodology.length).toBeGreaterThan(40);
      expect(t.instructions.length).toBeGreaterThanOrEqual(3);
      expect(t.faqs.length).toBeGreaterThanOrEqual(3);
      expect(t.disclaimer?.length ?? 0).toBeGreaterThan(0);
      expect(t.relatedHubHref ?? t.relatedSimulatorHref).toBeTruthy();
      const copy = [t.name, t.tagline, t.description, t.answer ?? "", t.methodology].join(" ");
      expect(copy).not.toMatch(/guarantee|95%\s*accura|100%\s*accura|best possible rotation/i);
      expect(copy).not.toMatch(/will predict|predicts the zone|predicts your zone/i);
      // Honest limits: the drill must explicitly deny zone prediction.
      const denial = t.faqs.some((f) => /predict/i.test(f.question) && /not zone prediction|no\.|illustrative/i.test(f.answer));
      expect(denial).toBe(true);
    }
  });

  it("keeps display naming consistent without renaming public slugs", () => {
    expect(getBgmiLabTool("final-circle")?.name).toBe("Final Circle");
  });

  it("resolves routes only for available/experimental tools — derived from the registry", () => {
    // Registry-derived: adding a correctly registered available game
    // automatically enters routability coverage.
    for (const tool of BGMI_LAB_TOOLS) {
      if (tool.status === "available" || tool.status === "experimental") {
        expect(isLabSlugRoutable(tool.slug)).toBe(true);
      } else {
        expect(isLabSlugRoutable(tool.slug)).toBe(false);
      }
    }
    expect(isLabSlugRoutable("circle-iq")).toBe(true);
    expect(isLabSlugRoutable("tournament-scenario-generator")).toBe(true);
    // Planned entries never route, however many exist.
    for (const tool of BGMI_LAB_TOOLS.filter((t) => t.status === "planned")) {
      expect(isLabSlugRoutable(tool.slug)).toBe(false);
    }
    // Archived entries never route.
    for (const tool of BGMI_LAB_TOOLS.filter((t) => t.status === "archived")) {
      expect(isLabSlugRoutable(tool.slug)).toBe(false);
    }
    expect(isLabSlugRoutable("nope")).toBe(false);
  });

  it("derives the available set from a single source — no shadow allowlist", () => {
    expect(getAvailableBgmiLabTools().map((t) => t.slug).sort()).toEqual(
      BGMI_LAB_TOOLS.filter((t) => t.status === "available")
        .map((t) => t.slug)
        .sort()
    );
  });
});
