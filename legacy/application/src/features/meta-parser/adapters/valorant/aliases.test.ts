import { describe, expect, it } from "vitest";
import { canonicalizeValorantName, resolveValorantName } from "./aliases";

describe("valorant aliases (heading-derived)", () => {
  it("canonicalizes headings for Yoru, Outlaw, Iso, and Corrode", () => {
    expect(canonicalizeValorantName("  Yoru ")).toBe("Yoru");
    expect(resolveValorantName("Yoru", new Map()).displayName).toBe("Yoru");
    expect(resolveValorantName("Outlaw", new Map()).displayName).toBe("Outlaw");
    expect(resolveValorantName("Iso", new Map()).displayName).toBe("Iso");
    expect(resolveValorantName("CORRODE", new Map()).normalized).toBe("corrode");
  });

  it("prefers the alias map when a mapping exists", () => {
    const map = new Map([["yoru", "Yoru"]]);
    expect(resolveValorantName("yoru", map)).toMatchObject({ displayName: "Yoru", hit: "canonical" });
  });

  it("falls back to the cleaned heading for unknown names", () => {
    expect(resolveValorantName("New Agent", new Map())).toMatchObject({
      displayName: "New Agent",
      hit: "fallback",
    });
  });
});
