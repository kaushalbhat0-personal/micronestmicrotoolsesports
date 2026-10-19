import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildLabJsonLd, getAvailableLabTools, getLabTool, labSitemapPaths } from "./public-tool-content";

describe("public-tool-content — presentation-only helper", () => {
  it("resolves circle-iq and lists only available tools for sitemap", () => {
    expect(getLabTool("circle-iq")?.name).toBe("Circle IQ");
    expect(getLabTool("rotation-iq")?.name).toBe("Rotation IQ");
    expect(getLabTool("nope")).toBeNull();
    expect(getAvailableLabTools().map((t) => t.slug)).toEqual(["circle-iq"]);
    expect(labSitemapPaths()).toEqual(["/bgmi-lab", "/bgmi-lab/circle-iq"]);
  });

  it("builds free SoftwareApplication JSON-LD (price 0, no checkout)", () => {
    const tool = getLabTool("circle-iq");
    expect(tool).not.toBeNull();
    const json = buildLabJsonLd(tool!);
    expect(json["@type"]).toBe("SoftwareApplication");
    expect(json["url"]).toBe("/bgmi-lab/circle-iq");
    expect(JSON.stringify(json)).not.toMatch(/checkout|signup\?plan|PreOrder/i);
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
