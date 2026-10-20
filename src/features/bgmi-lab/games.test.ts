import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasLabGame, resolveLabGame } from "./games";
import { BGMI_LAB_TOOLS, getAvailableBgmiLabTools, getBgmiLabTool } from "@/config/public/bgmi-lab";

const SOURCE = readFileSync(join(process.cwd(), "src/features/bgmi-lab/games.tsx"), "utf8");

describe("bgmi-lab loader map — registry to island resolution", () => {
  it("resolves every available game to its island — derived from the registry", () => {
    // Registry-derived: adding a correctly registered available game with a
    // loader entry automatically enters coverage here.
    const available = getAvailableBgmiLabTools();
    expect(available.length).toBeGreaterThan(0);
    for (const tool of available) {
      expect(hasLabGame(tool.slug)).toBe(true);
      const island = resolveLabGame(tool.slug);
      expect(island).not.toBeNull();
      expect(island).toBeTruthy();
    }
    // Explicit pins for the shipped experiences keep the intent readable.
    for (const slug of ["circle-iq", "rotation-replay", "zone-patterns", "tournament-scenario-generator"]) {
      expect(getBgmiLabTool(slug)?.status).toBe("available");
      expect(hasLabGame(slug)).toBe(true);
    }
  });

  it("resolves nothing for unknown slugs (route must 404)", () => {
    expect(hasLabGame("nope")).toBe(false);
    expect(resolveLabGame("nope")).toBeNull();
  });

  it("has no loader for planned or archived tools — derived from the registry", () => {
    // Registry-derived: any future planned/archived entry is excluded by
    // status, not by a hardcoded slug list.
    const excluded = BGMI_LAB_TOOLS.filter((t) => t.status === "planned" || t.status === "archived");
    expect(excluded.length).toBeGreaterThan(0);
    for (const tool of excluded) {
      expect(resolveLabGame(tool.slug)).toBeNull();
      expect(hasLabGame(tool.slug)).toBe(false);
    }
  });

  it("imports no server/billing/auth boundary", () => {
    for (const banned of [
      "createAdminClient",
      "service_role",
      "requireEntitlement",
      "requireOrganizationContext",
      "dodopayments",
      "razorpay",
      "server/billing",
      "supabase/admin",
      "entitlement",
    ]) {
      expect(SOURCE).not.toContain(banned);
    }
  });
});
