// G1-6 route-boundary unit tests (pure, no network, no Supabase client).
// Authoritative: 04 section 5 + 05 section 5 + 07 sections 1-4 + 11 section 3
// (APPROVED D-G1-03 RPC-only; APPROVED D-G1-04 Option A omit 2026-11-11).
//
// Covers: valid filters, invalid query params (fail safe), pagination
// boundaries, filter preservation in pagination URLs, profile metadata from
// projection fields only, and canonical behavior without an invented domain.

import { describe, expect, it } from "vitest";
import type { PublicPlayerCard } from "@/features/player-profile/domain/directory";
import {
  DIRECTORY_MAX_PAGE,
  DIRECTORY_PAGE_SIZE,
  buildCanonicalUrl,
  buildDirectoryHref,
  buildDirectoryMetadata,
  buildNotFoundMetadata,
  buildProfileMetadata,
  getAppBaseUrl,
  parseDirectoryQuery,
  toDirectoryInput,
} from "./query";

const CARD: PublicPlayerCard = {
  handle: "nova_01",
  display_name: "Nova",
  avatar_url: "https://cdn.example/avatars/nova.png",
  bio: "BGMI scout looking for a competitive squad.",
  country_code: "IN",
  game_key: "bgmi",
  game_name: "Battlegrounds Mobile India",
  ign: "NovaScout",
  primary_role: "Scout",
  play_modes: ["squad", "tpp"],
  region_code: "india",
  availability: ["weekend"],
};

describe("parseDirectoryQuery — valid filters", () => {
  it("defaults to page 1 with zero offset and the frozen page size", () => {
    const parsed = parseDirectoryQuery({});
    expect(parsed.filters).toEqual({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(DIRECTORY_PAGE_SIZE);
    expect(parsed.offset).toBe(0);
    expect(parsed.invalid).toEqual([]);
  });

  it("passes valid filters through and derives the offset", () => {
    const parsed = parseDirectoryQuery({
      game: "bgmi",
      region: "india",
      role: "Scout",
      query: "nova",
      page: "3",
    });
    expect(parsed.filters).toEqual({
      game: "bgmi",
      region: "india",
      role: "Scout",
      query: "nova",
    });
    expect(parsed.page).toBe(3);
    expect(parsed.offset).toBe((3 - 1) * DIRECTORY_PAGE_SIZE);
    expect(parsed.invalid).toEqual([]);
  });

  it("normalizes game case and trims whitespace", () => {
    const parsed = parseDirectoryQuery({
      game: "  BGMI ",
      query: "  nova  ",
    });
    expect(parsed.filters.game).toBe("bgmi");
    expect(parsed.filters.query).toBe("nova");
    expect(parsed.invalid).toEqual([]);
  });

  it("treats empty-string params as absent, not invalid", () => {
    const parsed = parseDirectoryQuery({
      game: "",
      region: "",
      role: "",
      query: "",
    });
    expect(parsed.filters).toEqual({});
    expect(parsed.invalid).toEqual([]);
  });

  it("takes the first value of repeated params", () => {
    const parsed = parseDirectoryQuery({
      query: ["nova", "other"],
      page: ["2", "5"],
    });
    expect(parsed.filters.query).toBe("nova");
    expect(parsed.page).toBe(2);
  });
});

describe("parseDirectoryQuery — invalid params fail safely", () => {
  it("drops malformed filters and keeps the valid ones", () => {
    const parsed = parseDirectoryQuery({
      game: "BGMI!",
      region: "x".repeat(49),
      role: "y".repeat(33),
      query: "z".repeat(121),
    });
    expect(parsed.filters).toEqual({});
    expect(parsed.invalid).toEqual(expect.arrayContaining(["game", "region", "role", "query"]));
  });

  it("keeps valid filters alongside invalid ones", () => {
    const parsed = parseDirectoryQuery({ game: "BGMI!", query: "nova" });
    expect(parsed.filters).toEqual({ query: "nova" });
    expect(parsed.invalid).toEqual(["game"]);
  });

  it("never throws on hostile input", () => {
    expect(() =>
      parseDirectoryQuery({
        game: ["<script>", "bgmi"],
        page: "' OR '1'='1",
        query: "'; DROP TABLE x; --",
      })
    ).not.toThrow();
    const parsed = parseDirectoryQuery({ page: "' OR '1'='1" });
    expect(parsed.page).toBe(1);
    expect(parsed.invalid).toEqual(["page"]);
  });
});

describe("parseDirectoryQuery — pagination boundaries", () => {
  it("clamps page 0, negatives, fractions and overflow to page 1", () => {
    for (const page of ["0", "-3", "2.5", "abc", String(DIRECTORY_MAX_PAGE + 1), "9999"]) {
      const parsed = parseDirectoryQuery({ page });
      expect(parsed.page).toBe(1);
      expect(parsed.offset).toBe(0);
      expect(parsed.invalid).toEqual(["page"]);
    }
  });

  it("accepts the maximum page whose offset stays in the SQL ceiling", () => {
    const parsed = parseDirectoryQuery({ page: String(DIRECTORY_MAX_PAGE) });
    expect(parsed.page).toBe(DIRECTORY_MAX_PAGE);
    expect(parsed.offset).toBeLessThanOrEqual(1000);
    expect(parsed.invalid).toEqual([]);
  });
});

describe("toDirectoryInput", () => {
  it("maps to the reader contract with a +1 over-read for next-page detection", () => {
    const parsed = parseDirectoryQuery({ game: "bgmi", page: "2" });
    const input = toDirectoryInput(parsed);
    expect(input).toEqual({
      game: "bgmi",
      limit: DIRECTORY_PAGE_SIZE + 1,
      offset: DIRECTORY_PAGE_SIZE,
    });
  });

  it("omits absent filters instead of forwarding undefined", () => {
    const input = toDirectoryInput(parseDirectoryQuery({}));
    expect(input).toEqual({ limit: DIRECTORY_PAGE_SIZE + 1, offset: 0 });
    expect("game" in input).toBe(false);
    expect("query" in input).toBe(false);
  });
});

describe("buildDirectoryHref — filter preservation", () => {
  it("preserves valid filters across pages", () => {
    const href = buildDirectoryHref(
      { game: "bgmi", region: "india", role: "Scout", query: "nova" },
      3
    );
    expect(href).toBe("/players?game=bgmi&region=india&role=Scout&query=nova&page=3");
  });

  it("omits the page param on page 1 (canonical directory URL)", () => {
    expect(buildDirectoryHref({ game: "bgmi" }, 1)).toBe("/players?game=bgmi");
    expect(buildDirectoryHref({}, 1)).toBe("/players");
  });

  it("encodes hostile filter values instead of reflecting them raw", () => {
    const href = buildDirectoryHref({ query: "<script>alert(1)</script>" }, 1);
    expect(href).not.toContain("<");
    expect(href).not.toContain(">");
    expect(href).toContain("/players?query=%3Cscript%3E");
  });
});

describe("metadata builders — projection fields only", () => {
  it("builds the profile title and description from projection fields", () => {
    const copy = buildProfileMetadata(CARD);
    expect(copy.title).toBe("Nova (@nova_01)");
    expect(copy.description).toBe(CARD.bio);
  });

  it("falls back to a projection-derived description when bio is absent", () => {
    const copy = buildProfileMetadata({ ...CARD, bio: null });
    expect(copy.title).toBe("Nova (@nova_01)");
    expect(copy.description).toContain("NovaScout");
    expect(copy.description).toContain("Battlegrounds Mobile India");
    expect(copy.description).toContain("Scout");
    expect(copy.description).toContain("india");
  });

  it("handles empty optional fields without inventing values", () => {
    const copy = buildProfileMetadata({
      ...CARD,
      bio: "   ",
      primary_role: null,
      region_code: null,
    });
    expect(copy.description).toContain("NovaScout");
    expect(copy.description).not.toContain("null");
    expect(copy.description).not.toContain("undefined");
  });

  it("keeps directory and not-found copy generic (no PII, no existence signal)", () => {
    const directory = buildDirectoryMetadata();
    expect(directory.title).toBe("Player directory");
    expect(JSON.stringify(directory)).not.toContain("game_user_id");
    const missing = buildNotFoundMetadata();
    expect(missing.title).toBe("Player not found");
    expect(JSON.stringify(missing)).not.toContain("game_user_id");
  });
});

describe("canonical URLs — no invented domain", () => {
  it("returns undefined when no app URL is configured", () => {
    const previous = process.env["NEXT_PUBLIC_APP_URL"];
    delete process.env["NEXT_PUBLIC_APP_URL"];
    try {
      expect(getAppBaseUrl()).toBeUndefined();
      expect(buildCanonicalUrl("/players/nova_01")).toBeUndefined();
    } finally {
      if (previous !== undefined) {
        process.env["NEXT_PUBLIC_APP_URL"] = previous;
      }
    }
  });

  it("builds an absolute handle-based canonical when the app URL is configured", () => {
    const previous = process.env["NEXT_PUBLIC_APP_URL"];
    process.env["NEXT_PUBLIC_APP_URL"] = "https://esports.example.com";
    try {
      expect(buildCanonicalUrl("/players/nova_01")).toBe(
        "https://esports.example.com/players/nova_01"
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
