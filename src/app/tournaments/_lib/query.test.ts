// P3 tournaments route-boundary unit tests (pure, no network, no client).
// Covers: valid filters (incl. status), invalid params (fail safe),
// pagination bounds inside the proposed SQL clamps, href preservation and
// encoding, metadata from projection fields only, and canonical behavior
// without an invented domain.

import { describe, expect, it } from "vitest";
import type { PublicTournamentDetail } from "@/features/tournaments/domain/public-card";
import {
  TOURNAMENTS_MAX_PAGE,
  TOURNAMENTS_PAGE_SIZE,
  buildTournamentDetailMetadata,
  buildTournamentNotFoundMetadata,
  buildTournamentsCanonicalUrl,
  buildTournamentsHref,
  buildTournamentsMetadata,
  getTournamentsAppBaseUrl,
  parseTournamentsQuery,
  toTournamentSearchInput,
} from "./query";

const CARD: PublicTournamentDetail = {
  slug: "monsoon-showdown-cup",
  title: "Monsoon Showdown Cup",
  game_key: "bgmi",
  region_code: "india",
  format: "team",
  starts_at: "2099-12-01T10:00:00.000Z",
  ends_at: "2099-12-03T18:00:00.000Z",
  timezone: "Asia/Kolkata",
  entry_fee: { amountMinor: 0, currency: "INR" },
  prize_pool: { amountMinor: 10000000, currency: "INR" },
  organizer: { kind: "independent", name: "Nova Events", slug: null, verified: false },
  lifecycle: "published",
  registration_url: "https://events.example.com/register",
  registration_closes_at: null,
  status: "upcoming",
  description: "A weekend BGMI open.",
  contact_instructions: null,
  eligibility: null,
};

describe("parseTournamentsQuery — valid filters", () => {
  it("defaults to page 1 with zero offset and the frozen page size", () => {
    const parsed = parseTournamentsQuery({});
    expect(parsed.filters).toEqual({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(TOURNAMENTS_PAGE_SIZE);
    expect(parsed.offset).toBe(0);
    expect(parsed.invalid).toEqual([]);
  });

  it("passes valid filters through and derives the offset", () => {
    const parsed = parseTournamentsQuery({
      game: "bgmi",
      region: "india",
      status: "upcoming",
      query: "monsoon",
      page: "3",
    });
    expect(parsed.filters).toEqual({
      game: "bgmi",
      region: "india",
      status: "upcoming",
      query: "monsoon",
    });
    expect(parsed.page).toBe(3);
    expect(parsed.offset).toBe((3 - 1) * TOURNAMENTS_PAGE_SIZE);
    expect(parsed.invalid).toEqual([]);
  });

  it("treats empty-string params as absent, not invalid", () => {
    const parsed = parseTournamentsQuery({ game: "", region: "", status: "", query: "" });
    expect(parsed.filters).toEqual({});
    expect(parsed.invalid).toEqual([]);
  });

  it("takes the first value of repeated params", () => {
    const parsed = parseTournamentsQuery({ query: ["monsoon", "other"], page: ["2", "5"] });
    expect(parsed.filters.query).toBe("monsoon");
    expect(parsed.page).toBe(2);
  });
});

describe("parseTournamentsQuery — invalid params fail safely", () => {
  it("drops malformed filters and keeps the valid ones", () => {
    const parsed = parseTournamentsQuery({
      game: "BGMI!",
      region: "x".repeat(49),
      status: "live",
      query: "z".repeat(121),
    });
    expect(parsed.filters).toEqual({});
    expect(parsed.invalid).toEqual(expect.arrayContaining(["game", "region", "status", "query"]));
  });

  it("never throws on hostile input", () => {
    expect(() =>
      parseTournamentsQuery({
        status: "<script>",
        page: "' OR '1'='1",
        query: "'; DROP TABLE x; --",
      }),
    ).not.toThrow();
    const parsed = parseTournamentsQuery({ page: "' OR '1'='1" });
    expect(parsed.page).toBe(1);
    expect(parsed.invalid).toEqual(["page"]);
  });
});

describe("parseTournamentsQuery — pagination boundaries", () => {
  it("clamps page 0, negatives, fractions and overflow to page 1", () => {
    for (const page of ["0", "-3", "2.5", "abc", String(TOURNAMENTS_MAX_PAGE + 1), "9999"]) {
      const parsed = parseTournamentsQuery({ page });
      expect(parsed.page).toBe(1);
      expect(parsed.offset).toBe(0);
      expect(parsed.invalid).toEqual(["page"]);
    }
  });

  it("accepts the maximum page whose offset stays in the SQL ceiling", () => {
    const parsed = parseTournamentsQuery({ page: String(TOURNAMENTS_MAX_PAGE) });
    expect(parsed.page).toBe(TOURNAMENTS_MAX_PAGE);
    expect(parsed.offset).toBeLessThanOrEqual(1000);
    expect(parsed.invalid).toEqual([]);
  });
});

describe("toTournamentSearchInput", () => {
  it("maps to the reader contract with a +1 over-read for next-page detection", () => {
    const parsed = parseTournamentsQuery({ game: "bgmi", status: "upcoming", page: "2" });
    const input = toTournamentSearchInput(parsed);
    expect(input).toEqual({
      game: "bgmi",
      status: "upcoming",
      limit: TOURNAMENTS_PAGE_SIZE + 1,
      offset: TOURNAMENTS_PAGE_SIZE,
    });
  });

  it("omits absent filters instead of forwarding undefined", () => {
    const input = toTournamentSearchInput(parseTournamentsQuery({}));
    expect(input).toEqual({ limit: TOURNAMENTS_PAGE_SIZE + 1, offset: 0 });
    expect("game" in input).toBe(false);
    expect("status" in input).toBe(false);
  });
});

describe("buildTournamentsHref — filter preservation", () => {
  it("preserves valid filters across pages", () => {
    const href = buildTournamentsHref(
      { game: "bgmi", region: "india", status: "upcoming", query: "monsoon" },
      3,
    );
    expect(href).toBe("/tournaments?game=bgmi&region=india&status=upcoming&query=monsoon&page=3");
  });

  it("omits the page param on page 1 (canonical directory URL)", () => {
    expect(buildTournamentsHref({ status: "ongoing" }, 1)).toBe("/tournaments?status=ongoing");
    expect(buildTournamentsHref({}, 1)).toBe("/tournaments");
  });

  it("encodes hostile filter values instead of reflecting them raw", () => {
    const href = buildTournamentsHref({ query: "<script>alert(1)</script>" }, 1);
    expect(href).not.toContain("<");
    expect(href).not.toContain(">");
    expect(href).toContain("/tournaments?query=%3Cscript%3E");
  });
});

describe("metadata builders — projection fields only", () => {
  it("builds the detail title and description from projection fields", () => {
    const copy = buildTournamentDetailMetadata(CARD);
    expect(copy.title).toBe("Monsoon Showdown Cup (@monsoon-showdown-cup)");
    expect(copy.description).toBe(CARD.description);
  });

  it("falls back to a projection-derived description when description is absent", () => {
    const copy = buildTournamentDetailMetadata({ ...CARD, description: null });
    expect(copy.title).toBe("Monsoon Showdown Cup (@monsoon-showdown-cup)");
    expect(copy.description).toContain("bgmi");
    expect(copy.description).toContain("india");
    expect(copy.description).toContain("upcoming");
  });

  it("keeps directory and not-found copy generic (no PII, no existence signal)", () => {
    const directory = buildTournamentsMetadata();
    expect(directory.title).toBe("Tournament directory");
    expect(JSON.stringify(directory)).not.toContain("owner_user_id");
    const missing = buildTournamentNotFoundMetadata();
    expect(missing.title).toBe("Tournament not found");
    expect(JSON.stringify(missing)).not.toContain("owner_user_id");
  });
});

describe("canonical URLs — no invented domain", () => {
  it("returns undefined when no app URL is configured", () => {
    const previous = process.env["NEXT_PUBLIC_APP_URL"];
    delete process.env["NEXT_PUBLIC_APP_URL"];
    try {
      expect(getTournamentsAppBaseUrl()).toBeUndefined();
      expect(buildTournamentsCanonicalUrl("/tournaments/monsoon-showdown-cup")).toBeUndefined();
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
      expect(buildTournamentsCanonicalUrl("/tournaments/monsoon-showdown-cup")).toBe(
        "https://esports.example.com/tournaments/monsoon-showdown-cup",
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
