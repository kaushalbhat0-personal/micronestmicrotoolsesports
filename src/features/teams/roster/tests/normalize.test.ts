// D1 roster — normalize tests (independent greenfield coverage).
import { describe, expect, it } from "vitest";
import { displayName, isBlank, normalizeIdentity, stripZeroWidth } from "../normalize";

describe("normalizeIdentity", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeIdentity("  Viper   OP  ")).toBe("viper op");
  });
  it("strips zero-width characters", () => {
    expect(normalizeIdentity("Vi\u200bper")).toBe("viper");
  });
  it("preserves punctuation, diacritics, numbers (no aggressive folding)", () => {
    expect(normalizeIdentity("Viper-OP")).not.toBe(normalizeIdentity("Viper OP"));
    expect(normalizeIdentity("José")).not.toBe(normalizeIdentity("Jose"));
    expect(normalizeIdentity("Rogue2")).not.toBe(normalizeIdentity("Rogue"));
  });
  it("returns empty for non-strings and blanks", () => {
    expect(normalizeIdentity(42 as unknown as string)).toBe("");
    expect(isBlank("   ")).toBe(true);
  });
  it("is deterministic", () => {
    expect(normalizeIdentity("Alpha Esports")).toBe(normalizeIdentity("Alpha Esports"));
  });
});

describe("displayName", () => {
  it("preserves case and punctuation", () => {
    expect(displayName("  Viper-OP  ")).toBe("Viper-OP");
  });
  it("strips zero-width", () => {
    expect(stripZeroWidth("a\u200bb")).toBe("ab");
  });
});
