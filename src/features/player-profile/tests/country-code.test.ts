import { describe, expect, it } from "vitest";
import { countryCodeInputSchema, countryCodeSchema } from "../schemas/country-code";

describe("countryCodeSchema (D-G1-09 frozen)", () => {
  it("accepts ISO alpha-2 and normalizes to uppercase", () => {
    expect(countryCodeSchema.parse("in")).toBe("IN");
    expect(countryCodeSchema.parse(" US ")).toBe("US");
  });

  it("is optional at the profile boundary", () => {
    expect(countryCodeInputSchema.parse(undefined)).toBeUndefined();
  });

  it("rejects non-alpha-2 values", () => {
    for (const bad of ["", "U", "USA", "12", "U1", "ZZ!"]) {
      expect(countryCodeSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects ONLINE as a country code", () => {
    expect(countryCodeSchema.safeParse("ONLINE").success).toBe(false);
    expect(countryCodeInputSchema.safeParse("online").success).toBe(false);
  });
});
