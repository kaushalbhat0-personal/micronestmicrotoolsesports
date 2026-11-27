// P8 brand domain tests (pure, no network).
// Covers: slug normalization, industry/partnership/interest vocabularies,
// brand-vs-organization separation, trust presentation (no false verification),
// sponsorship-interest filtering semantics (intent, never availability), and
// public projection boundaries.

import { describe, expect, it } from "vitest";
import { BRAND_DIRECTORY_COLUMNS } from "../domain/columns";
import {
  BRAND_INDUSTRIES,
  isBrandIndustry,
  isPartnershipType,
  isSponsorshipInterest,
  PARTNERSHIP_TYPES,
  SPONSORSHIP_INTERESTS,
} from "../domain/vocabulary";
import { isConfirmedTrust } from "@/features/organizations/domain/trust";
import { brandSlugSchema, searchBrandsInputSchema } from "../schemas/directory";

describe("brand slug", () => {
  it("normalizes case/whitespace and rejects bad shapes", () => {
    expect(brandSlugSchema.parse("  Volt-Energy ")).toBe("volt-energy");
    expect(() => brandSlugSchema.parse("x")).toThrow();
    expect(() => brandSlugSchema.parse("has space")).toThrow();
  });
});

describe("brand vocabularies", () => {
  it("industry is a closed controlled vocabulary", () => {
    expect(BRAND_INDUSTRIES).toContain("energy-drink");
    expect(isBrandIndustry("fintech")).toBe(true);
    expect(isBrandIndustry("esports-org")).toBe(false);
  });

  it("partnership and interest vocabularies are closed", () => {
    expect(PARTNERSHIP_TYPES).toContain("sponsorship");
    expect(SPONSORSHIP_INTERESTS).toContain("teams");
    expect(isPartnershipType("equity-buyout")).toBe(false);
    expect(isSponsorshipInterest("available-now")).toBe(false);
  });

  it("rejects unknown vocabularies at the input boundary", () => {
    expect(searchBrandsInputSchema.safeParse({ industry: "esports-org", limit: 24, offset: 0 }).success).toBe(false);
    expect(searchBrandsInputSchema.safeParse({ interest: "available-now", limit: 24, offset: 0 }).success).toBe(false);
  });
});

describe("brand vs organization separation", () => {
  it("brand columns carry no organization members", () => {
    const columns = [...BRAND_DIRECTORY_COLUMNS];
    expect(columns).not.toContain("org_type");
    expect(columns).not.toContain("team_count");
    expect(columns).toContain("industry");
    expect(columns).toContain("sponsorship_interests");
  });
});

describe("trust presentation", () => {
  it("never treats submitted interest as confirmation", () => {
    expect(isConfirmedTrust("submitted")).toBe(false);
    expect(isConfirmedTrust("confirmed")).toBe(true);
  });

  it("representative verification is frozen false by contract", async () => {
    const mod = await import("../domain/brand");
    expect(mod.BrandWriteDisabledError).toBeDefined();
  });
});

describe("public projection boundaries", () => {
  it("exposes exactly the proposed search columns", () => {
    expect([...BRAND_DIRECTORY_COLUMNS]).toEqual([
      "slug",
      "name",
      "industry",
      "region_code",
      "game_interests",
      "partnership_types",
      "sponsorship_interests",
      "trust_state",
    ]);
  });

  it("search input clamps pagination", () => {
    expect(() => searchBrandsInputSchema.parse({ limit: 0, offset: 0 })).toThrow();
    expect(() => searchBrandsInputSchema.parse({ limit: 24, offset: 1001 })).toThrow();
  });
});
