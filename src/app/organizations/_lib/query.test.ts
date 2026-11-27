// P8 organizations query tests (pure route-boundary parsing).
// Covers: game/region/type/query/page parsing, invalid-drop behavior, bounded
// pagination math, href round-trips, and metadata copy (no data, no PII).

import { describe, expect, it } from "vitest";
import {
  buildOrganizationsHref,
  ORGANIZATIONS_MAX_PAGE,
  ORGANIZATIONS_PAGE_SIZE,
  parseOrganizationsQuery,
  toOrganizationSearchInput,
} from "./query";

describe("parseOrganizationsQuery", () => {
  it("parses all filters and derives bounded pagination", () => {
    const parsed = parseOrganizationsQuery({
      game: "bgmi",
      region: "india",
      type: "professional",
      query: "nova",
      page: "2",
    });
    expect(parsed.filters).toEqual({ game: "bgmi", region: "india", orgType: "professional", query: "nova" });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(ORGANIZATIONS_PAGE_SIZE);
    expect(parsed.offset).toBe(ORGANIZATIONS_PAGE_SIZE);
    expect(parsed.invalid).toEqual([]);
  });

  it("drops invalid params and records them without throwing", () => {
    const parsed = parseOrganizationsQuery({ game: "!!!", type: "investor", page: "99" });
    expect(parsed.invalid).toContain("game");
    expect(parsed.invalid).toContain("type");
    expect(parsed.filters.game).toBeUndefined();
    expect(parsed.filters.orgType).toBeUndefined();
  });

  it("rejects pages beyond the OFFSET ceiling", () => {
    const parsed = parseOrganizationsQuery({ page: String(ORGANIZATIONS_MAX_PAGE + 1) });
    expect(parsed.invalid).toContain("page");
    expect(parsed.page).toBe(1);
  });

  it("treats empty strings as absent", () => {
    const parsed = parseOrganizationsQuery({ game: "", type: "" });
    expect(parsed.filters.game).toBeUndefined();
    expect(parsed.invalid).toEqual([]);
  });
});

describe("toOrganizationSearchInput", () => {
  it("maps to the reader contract with a +1 over-read and omits undefined", () => {
    const parsed = parseOrganizationsQuery({ game: "bgmi", page: "1" });
    const input = toOrganizationSearchInput(parsed);
    expect(input).toMatchObject({ game: "bgmi", limit: ORGANIZATIONS_PAGE_SIZE + 1, offset: 0 });
    expect("region" in input).toBe(false);
  });
});

describe("buildOrganizationsHref", () => {
  it("round-trips valid filters and omits page 1", () => {
    expect(buildOrganizationsHref({ game: "bgmi", orgType: "academy" }, 1)).toBe(
      "/organizations?game=bgmi&type=academy",
    );
    expect(buildOrganizationsHref({}, 3)).toBe("/organizations?page=3");
    expect(buildOrganizationsHref({}, 1)).toBe("/organizations");
  });
});
