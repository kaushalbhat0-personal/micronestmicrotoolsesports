import { describe, expect, it } from "vitest";
import { displayName, isBlank, normalizeIdentity, stripZeroWidth } from "./normalize";

const ZW = "⁠";
const ZWSP = "​";
const ZWNJ = "‌";
const ZWJ = "‍";
const BOM = "﻿";
const NBSP = " ";
const TAB = "	";
const C1 = "";
const DEL = "";
const E_ACUTE = "é";
const E_COMBINING = "é";

describe("normalizeIdentity — comparison keys", () => {
  it("collapses the audit example to one key", () => {
    expect(normalizeIdentity("  Rahul  Patil ")).toBe("rahul patil");
    expect(normalizeIdentity("rahul patil")).toBe("rahul patil");
  });

  it("unifies Unicode NFC equivalents", () => {
    expect(normalizeIdentity(E_ACUTE)).toBe(normalizeIdentity(E_COMBINING));
    expect(normalizeIdentity("Caf" + E_ACUTE)).toBe("café");
  });

  it("removes zero-width characters from WhatsApp/Discord copies", () => {
    expect(normalizeIdentity("Rahul" + ZWSP + " Patil")).toBe("rahul patil");
    expect(normalizeIdentity(BOM + "Alpha")).toBe("alpha");
    expect(normalizeIdentity("Tea" + ZWJ + "M")).toBe("team");
    expect(normalizeIdentity("A" + ZWSP + "l" + ZWNJ + "p" + ZWJ + "h" + BOM + "a")).toBe("alpha");
  });

  it("collapses tabs and mixed whitespace runs", () => {
    expect(normalizeIdentity("Alpha" + TAB + "Esports")).toBe("alpha esports");
    expect(normalizeIdentity("Alpha  " + TAB + "  Esports")).toBe("alpha esports");
    expect(normalizeIdentity("Alpha" + NBSP + "Esports")).toBe("alpha esports");
  });

  it("lowercases without locale-specific mappings", () => {
    expect(normalizeIdentity("ALPHA ESPORTS")).toBe("alpha esports");
  });

  it("preserves punctuation (never folds distinct tags together)", () => {
    expect(normalizeIdentity("Viper-OP")).not.toBe(normalizeIdentity("Viper OP"));
    expect(normalizeIdentity(" obw! ")).not.toBe(normalizeIdentity("obw"));
  });

  it("preserves diacritics (José is not Jose)", () => {
    expect(normalizeIdentity("José")).not.toBe(normalizeIdentity("Jose"));
  });

  it("preserves numbers (Rogue2 is not Rogue)", () => {
    expect(normalizeIdentity("Rogue2")).not.toBe(normalizeIdentity("Rogue"));
  });

  it("returns empty for non-string input instead of throwing", () => {
    expect(normalizeIdentity(undefined as unknown as string)).toBe("");
  });

  it("is deterministic across repeated calls", () => {
    const value = "  Alpha   Esports" + NBSP + " ";
    expect(normalizeIdentity(value)).toBe(normalizeIdentity(value));
  });
});

describe("displayName — user-facing values", () => {
  it("preserves case and punctuation, collapses spacing", () => {
    expect(displayName("  Rahul  PATIL ")).toBe("Rahul PATIL");
    expect(displayName("Viper-OP")).toBe("Viper-OP");
  });

  it("strips zero-width and control characters invisibly", () => {
    expect(displayName("Rahul" + ZWSP + " Patil")).toBe("Rahul Patil");
    expect(displayName("Alpha" + C1 + "Esports")).toBe("AlphaEsports");
    expect(displayName("Team" + DEL + " X")).toBe("Team X");
  });

  it("returns empty for non-string input", () => {
    expect(displayName(undefined as unknown as string)).toBe("");
  });
});

describe("isBlank / stripZeroWidth helpers", () => {
  it("treats empty, whitespace-only, and zero-width-only as blank", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank("   ")).toBe(true);
    expect(isBlank(ZWSP + BOM)).toBe(true);
    expect(isBlank(" x ")).toBe(false);
  });

  it("stripZeroWidth removes only zero-width characters", () => {
    expect(stripZeroWidth("a" + ZWSP + "b" + BOM + "c")).toBe("abc");
    expect(stripZeroWidth("José")).toBe("José");
    expect(stripZeroWidth(ZW + ZWNJ + ZWJ)).toBe("");
  });
});
