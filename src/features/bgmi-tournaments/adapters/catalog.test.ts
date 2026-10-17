import { describe, expect, it } from "vitest";
import {
  SUPPORTED_STAGE_KEYS,
  TOURNAMENT_CATALOG,
  getCatalogEntry,
  type SupportedStageKey,
} from "./liquipedia";

describe("BMPS Phase 1 catalog (BMPS-02)", () => {
  it("registers bmps-2026 against the main BMPS page", () => {
    const entry = getCatalogEntry("bmps-2026");
    expect(entry).not.toBeNull();
    expect(entry?.sourcePage).toBe("Battlegrounds Mobile India Pro Series/2026");
    expect(entry?.seasonYear).toBe(2026);
    expect(entry?.shortName).toBe("BMPS 2026");
  });

  it("supports exactly grand-finals and last-chance for bmps-2026", () => {
    expect(getCatalogEntry("bmps-2026")?.stages).toEqual(["grand-finals", "last-chance"]);
  });

  it("registers last-chance as a supported stage key", () => {
    expect((SUPPORTED_STAGE_KEYS as readonly string[])).toContain("last-chance");
  });

  it("does NOT register semi-finals anywhere (Phase 2 work)", () => {
    expect((SUPPORTED_STAGE_KEYS as readonly string[])).not.toContain("semi-finals");
    expect(getCatalogEntry("bmps-2026")?.stages).not.toContain("semi-finals");
    for (const entry of TOURNAMENT_CATALOG) {
      expect(entry.stages as readonly string[]).not.toContain("semi-finals");
    }
  });

  it("keeps every catalogued stage within the supported key union", () => {
    const allowed = new Set<string>(SUPPORTED_STAGE_KEYS as readonly string[]);
    for (const entry of TOURNAMENT_CATALOG) {
      for (const stage of entry.stages as readonly SupportedStageKey[]) {
        expect(allowed.has(stage)).toBe(true);
      }
    }
  });

  it("returns null for unknown tournaments", () => {
    expect(getCatalogEntry("nope-2026")).toBeNull();
  });

  it("leaves bmsd-2026 untouched", () => {
    expect(getCatalogEntry("bmsd-2026")?.stages).toEqual(["grand-finals", "playoffs"]);
    expect(getCatalogEntry("bmsd-2026")?.sourcePage).toBe("BGMI Masters Series/Season 5");
  });
});
