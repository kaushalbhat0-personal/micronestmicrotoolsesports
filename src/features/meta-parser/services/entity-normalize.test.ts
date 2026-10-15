import { describe, expect, it } from "vitest";
import { normalizeEntityName } from "./entity-normalize";

describe("normalizeEntityName", () => {
  it("lowercases, de-apostrophes, and collapses whitespace", () => {
    expect(normalizeEntityName("Nature's Prophet")).toBe("natures prophet");
    expect(normalizeEntityName("  Clockwerk  ")).toBe("clockwerk");
    expect(normalizeEntityName("K'Sante")).toBe("ksante");
  });

  it("returns empty string for non-string input", () => {
    expect(normalizeEntityName(null as unknown as string)).toBe("");
  });
});
