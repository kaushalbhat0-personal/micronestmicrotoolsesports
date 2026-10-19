import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BGMI_LAB_TOOLS } from "./bgmi-lab";

const SOURCE = readFileSync(join(process.cwd(), "src/config/public/bgmi-lab.ts"), "utf8");

describe("bgmi-lab registry — structural separation", () => {
  it("registers all eight planned tools", () => {
    expect(BGMI_LAB_TOOLS.map((t) => t.slug).sort()).toEqual(
      [
        "circle-iq",
        "final-circle",
        "igl-decision-drill",
        "lift-the-trophy",
        "rotation-iq",
        "rotation-replay",
        "tournament-scenarios",
        "zone-patterns",
      ].sort()
    );
  });

  it("exposes only circle-iq as available", () => {
    expect(BGMI_LAB_TOOLS.filter((t) => t.status === "available").map((t) => t.slug)).toEqual(["circle-iq"]);
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
});
