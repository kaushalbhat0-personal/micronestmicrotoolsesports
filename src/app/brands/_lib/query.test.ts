// P8 brands query tests (pure route-boundary parsing).
// Covers: game-interest/industry/region/interest/partnership/query/page
// parsing, invalid-drop behavior, bounded pagination, href round-trips.

import { describe, expect, it } from "vitest";
import {
  BRANDS_MAX_PAGE,
  BRANDS_PAGE_SIZE,
  buildBrandsHref,
  parseBrandsQuery,
  toBrandSearchInput,
} from "./query";

describe("parseBrandsQuery", () => {
  it("parses all filters and derives bounded pagination", () => {
    const parsed = parseBrandsQuery({
      game: "bgmi",
      industry: "energy-drink",
      region: "india",
      interest: "teams",
      partnership: "sponsorship",
      query: "volt",
      page: "2",
    });
    expect(parsed.filters).toEqual({
      gameInterest: "bgmi",
      industry: "energy-drink",
      region: "india",
      interest: "teams",
      partnership: "sponsorship",
      query: "volt",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(BRANDS_PAGE_SIZE);
    expect(parsed.offset).toBe(BRANDS_PAGE_SIZE);
    expect(parsed.invalid).toEqual([]);
  });

  it("drops invalid vocabularies without throwing", () => {
    const parsed = parseBrandsQuery({ industry: "esports-org", interest: "available-now", page: "99" });
    expect(parsed.invalid).toContain("industry");
    expect(parsed.invalid).toContain("interest");
    expect(parsed.filters.industry).toBeUndefined();
  });

  it("rejects pages beyond the OFFSET ceiling", () => {
    const parsed = parseBrandsQuery({ page: String(BRANDS_MAX_PAGE + 1) });
    expect(parsed.invalid).toContain("page");
    expect(parsed.page).toBe(1);
  });
});

describe("toBrandSearchInput", () => {
  it("maps to the reader contract with a +1 over-read", () => {
    const parsed = parseBrandsQuery({ industry: "fintech" });
    const input = toBrandSearchInput(parsed);
    expect(input).toMatchObject({ industry: "fintech", limit: BRANDS_PAGE_SIZE + 1, offset: 0 });
  });
});

describe("buildBrandsHref", () => {
  it("round-trips filters and omits page 1", () => {
    expect(buildBrandsHref({ industry: "fintech", interest: "teams" }, 1)).toBe(
      "/brands?industry=fintech&interest=teams",
    );
    expect(buildBrandsHref({}, 1)).toBe("/brands");
  });
});
