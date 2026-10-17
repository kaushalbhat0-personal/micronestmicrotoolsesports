import { describe, expect, it } from "vitest";
import {
  ROTATION_STAGE_KEYS,
  SUPPORTED_STAGE_KEYS,
  TOURNAMENT_CATALOG,
  getCatalogEntry,
  isRotationStage,
  type SupportedStageKey,
} from "./liquipedia";

describe("BMPS Phase 2 catalog (BMPS-03)", () => {
  it("registers bmps-2026 against the main BMPS page", () => {
    const entry = getCatalogEntry("bmps-2026");
    expect(entry).not.toBeNull();
    expect(entry?.sourcePage).toBe("Battlegrounds Mobile India Pro Series/2026");
    expect(entry?.seasonYear).toBe(2026);
    expect(entry?.shortName).toBe("BMPS 2026");
  });

  it("supports exactly grand-finals, last-chance, and semi-finals for bmps-2026", () => {
    expect(getCatalogEntry("bmps-2026")?.stages).toEqual(["grand-finals", "last-chance", "semi-finals"]);
  });

  it("registers semi-finals as a supported stage key", () => {
    expect((SUPPORTED_STAGE_KEYS as readonly string[])).toContain("semi-finals");
  });

  it("scopes rotation validation to bmps-2026/semi-finals only", () => {
    expect((ROTATION_STAGE_KEYS as readonly string[])).toEqual(["semi-finals"]);
    expect(isRotationStage("bmps-2026", "semi-finals")).toBe(true);
    expect(isRotationStage("bmps-2026", "grand-finals")).toBe(false);
    expect(isRotationStage("bmps-2026", "last-chance")).toBe(false);
    expect(isRotationStage("bmsd-2026", "grand-finals")).toBe(false);
    expect(isRotationStage("bmsd-2026", "playoffs")).toBe(false);
    expect(isRotationStage("bmps-2026", "playoffs")).toBe(false);
  });

  it("does NOT register qualifiers or survival-stage anywhere", () => {
    expect((SUPPORTED_STAGE_KEYS as readonly string[])).not.toContain("qualifiers");
    expect((SUPPORTED_STAGE_KEYS as readonly string[])).not.toContain("survival-stage");
    for (const entry of TOURNAMENT_CATALOG) {
      expect(entry.stages as readonly string[]).not.toContain("qualifiers");
      expect(entry.stages as readonly string[]).not.toContain("survival-stage");
    }
    expect(getCatalogEntry("bmps-2026")?.stages).not.toContain("qualifiers");
    expect(getCatalogEntry("bmps-2026")?.stages).not.toContain("survival-stage");
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
