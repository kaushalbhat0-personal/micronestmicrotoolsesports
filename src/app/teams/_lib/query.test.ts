// P1 teams route-boundary unit tests (pure, no network, no Supabase client).
// Covers: valid filters, invalid params (fail safe), pagination boundaries
// inside the D1.5.1 SQL clamps, filter preservation in pagination URLs,
// metadata from projection fields only, and canonical behavior without an
// invented domain.

import { describe, expect, it } from "vitest";
import type { PublicTeamDetail } from "@/features/teams/domain/team-directory";
import {
  TEAMS_MAX_PAGE,
  TEAMS_PAGE_SIZE,
  buildTeamDetailMetadata,
  buildTeamNotFoundMetadata,
  buildTeamsCanonicalUrl,
  buildTeamsHref,
  buildTeamsMetadata,
  getTeamsAppBaseUrl,
  parseTeamsQuery,
  toTeamSearchInput,
} from "./query";

const CARD: PublicTeamDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "nova-esports",
  name: "Nova Esports",
  game_key: "bgmi",
  region_code: "india",
  description: "A competitive BGMI squad.",
  current_level: "competitive",
  target_level: "semi-pro",
  recruiting: true,
  member_count: 5,
};

describe("parseTeamsQuery — valid filters", () => {
  it("defaults to page 1 with zero offset and the frozen page size", () => {
    const parsed = parseTeamsQuery({});
    expect(parsed.filters).toEqual({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(TEAMS_PAGE_SIZE);
    expect(parsed.offset).toBe(0);
    expect(parsed.invalid).toEqual([]);
  });

  it("passes valid filters through and derives the offset", () => {
    const parsed = parseTeamsQuery({ game: "bgmi", region: "india", query: "nova", page: "3" });
    expect(parsed.filters).toEqual({ game: "bgmi", region: "india", query: "nova" });
    expect(parsed.page).toBe(3);
    expect(parsed.offset).toBe((3 - 1) * TEAMS_PAGE_SIZE);
    expect(parsed.invalid).toEqual([]);
  });

  it("normalizes game case and trims whitespace", () => {
    const parsed = parseTeamsQuery({ game: "  BGMI ", query: "  nova  " });
    expect(parsed.filters.game).toBe("bgmi");
    expect(parsed.filters.query).toBe("nova");
    expect(parsed.invalid).toEqual([]);
  });

  it("treats empty-string params as absent, not invalid", () => {
    const parsed = parseTeamsQuery({ game: "", region: "", query: "" });
    expect(parsed.filters).toEqual({});
    expect(parsed.invalid).toEqual([]);
  });

  it("takes the first value of repeated params", () => {
    const parsed = parseTeamsQuery({ query: ["nova", "other"], page: ["2", "5"] });
    expect(parsed.filters.query).toBe("nova");
    expect(parsed.page).toBe(2);
  });
});

describe("parseTeamsQuery — invalid params fail safely", () => {
  it("drops malformed filters and keeps the valid ones", () => {
    const parsed = parseTeamsQuery({
      game: "BGMI!",
      region: "x".repeat(49),
      query: "z".repeat(121),
    });
    expect(parsed.filters).toEqual({});
    expect(parsed.invalid).toEqual(expect.arrayContaining(["game", "region", "query"]));
  });

  it("keeps valid filters alongside invalid ones", () => {
    const parsed = parseTeamsQuery({ game: "BGMI!", query: "nova" });
    expect(parsed.filters).toEqual({ query: "nova" });
    expect(parsed.invalid).toEqual(["game"]);
  });

  it("never throws on hostile input", () => {
    expect(() =>
      parseTeamsQuery({
        game: ["<script>", "bgmi"],
        page: "' OR '1'='1",
        query: "'; DROP TABLE x; --",
      }),
    ).not.toThrow();
    const parsed = parseTeamsQuery({ page: "' OR '1'='1" });
    expect(parsed.page).toBe(1);
    expect(parsed.invalid).toEqual(["page"]);
  });
});

describe("parseTeamsQuery — pagination boundaries", () => {
  it("clamps page 0, negatives, fractions and overflow to page 1", () => {
    for (const page of ["0", "-3", "2.5", "abc", String(TEAMS_MAX_PAGE + 1), "9999"]) {
      const parsed = parseTeamsQuery({ page });
      expect(parsed.page).toBe(1);
      expect(parsed.offset).toBe(0);
      expect(parsed.invalid).toEqual(["page"]);
    }
  });

  it("accepts the maximum page whose offset stays in the SQL ceiling", () => {
    const parsed = parseTeamsQuery({ page: String(TEAMS_MAX_PAGE) });
    expect(parsed.page).toBe(TEAMS_MAX_PAGE);
    expect(parsed.offset).toBeLessThanOrEqual(1000);
    expect(parsed.invalid).toEqual([]);
  });
});

describe("toTeamSearchInput", () => {
  it("maps to the reader contract with a +1 over-read for next-page detection", () => {
    const parsed = parseTeamsQuery({ game: "bgmi", page: "2" });
    const input = toTeamSearchInput(parsed);
    expect(input).toEqual({ game: "bgmi", limit: TEAMS_PAGE_SIZE + 1, offset: TEAMS_PAGE_SIZE });
  });

  it("omits absent filters instead of forwarding undefined", () => {
    const input = toTeamSearchInput(parseTeamsQuery({}));
    expect(input).toEqual({ limit: TEAMS_PAGE_SIZE + 1, offset: 0 });
    expect("game" in input).toBe(false);
    expect("query" in input).toBe(false);
  });

  it("invents no recruiting or role filter (the RPC has neither)", () => {
    const input = toTeamSearchInput(parseTeamsQuery({ game: "bgmi", region: "india" }));
    expect("recruiting" in input).toBe(false);
    expect("role" in input).toBe(false);
  });
});

describe("buildTeamsHref — filter preservation", () => {
  it("preserves valid filters across pages", () => {
    const href = buildTeamsHref({ game: "bgmi", region: "india", query: "nova" }, 3);
    expect(href).toBe("/teams?game=bgmi&region=india&query=nova&page=3");
  });

  it("omits the page param on page 1 (canonical directory URL)", () => {
    expect(buildTeamsHref({ game: "bgmi" }, 1)).toBe("/teams?game=bgmi");
    expect(buildTeamsHref({}, 1)).toBe("/teams");
  });

  it("encodes hostile filter values instead of reflecting them raw", () => {
    const href = buildTeamsHref({ query: "<script>alert(1)</script>" }, 1);
    expect(href).not.toContain("<");
    expect(href).not.toContain(">");
    expect(href).toContain("/teams?query=%3Cscript%3E");
  });
});

describe("metadata builders — projection fields only", () => {
  it("builds the detail title and description from projection fields", () => {
    const copy = buildTeamDetailMetadata(CARD);
    expect(copy.title).toBe("Nova Esports (@nova-esports)");
    expect(copy.description).toBe(CARD.description);
  });

  it("falls back to a projection-derived description when description is absent", () => {
    const copy = buildTeamDetailMetadata({ ...CARD, description: null });
    expect(copy.title).toBe("Nova Esports (@nova-esports)");
    expect(copy.description).toContain("bgmi");
    expect(copy.description).toContain("india");
    expect(copy.description).toContain("competitive");
  });

  it("keeps directory and not-found copy generic (no PII, no existence signal)", () => {
    const directory = buildTeamsMetadata();
    expect(directory.title).toBe("Team directory");
    expect(JSON.stringify(directory)).not.toContain("owner_user_id");
    const missing = buildTeamNotFoundMetadata();
    expect(missing.title).toBe("Team not found");
    expect(JSON.stringify(missing)).not.toContain("owner_user_id");
  });
});

describe("canonical URLs — no invented domain", () => {
  it("returns undefined when no app URL is configured", () => {
    const previous = process.env["NEXT_PUBLIC_APP_URL"];
    delete process.env["NEXT_PUBLIC_APP_URL"];
    try {
      expect(getTeamsAppBaseUrl()).toBeUndefined();
      expect(buildTeamsCanonicalUrl("/teams/nova-esports")).toBeUndefined();
    } finally {
      if (previous !== undefined) {
        process.env["NEXT_PUBLIC_APP_URL"] = previous;
      }
    }
  });

  it("builds an absolute slug-based canonical when the app URL is configured", () => {
    const previous = process.env["NEXT_PUBLIC_APP_URL"];
    process.env["NEXT_PUBLIC_APP_URL"] = "https://esports.example.com";
    try {
      expect(buildTeamsCanonicalUrl("/teams/nova-esports")).toBe(
        "https://esports.example.com/teams/nova-esports",
      );
    } finally {
      if (previous === undefined) {
        delete process.env["NEXT_PUBLIC_APP_URL"];
      } else {
        process.env["NEXT_PUBLIC_APP_URL"] = previous;
      }
    }
  });
});
