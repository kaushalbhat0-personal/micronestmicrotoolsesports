// P4 News route-boundary unit tests (pure, no network, no client).
// Covers: valid filters (incl. category/tag), invalid params (fail safe),
// pagination bounds inside the proposed SQL clamps, href preservation and
// encoding, metadata from projection fields only (incl. the unavailable
// state), and canonical behavior without an invented domain.

import { describe, expect, it } from "vitest";
import type { PublicArticleDetail } from "@/features/news/domain/public-card";
import {
  buildNewsCanonicalUrl,
  buildNewsDetailMetadata,
  buildNewsHref,
  buildNewsMetadata,
  buildNewsNotFoundMetadata,
  buildNewsUnavailableMetadata,
  getNewsAppBaseUrl,
  NEWS_MAX_PAGE,
  NEWS_PAGE_SIZE,
  parseNewsQuery,
  toArticleSearchInput,
} from "./query";

const CARD: PublicArticleDetail = {
  slug: "test-bgmi-story",
  headline: "TEST FIXTURE headline (never publish)",
  summary: "TEST FIXTURE summary.",
  category: "team",
  game_key: "bgmi",
  tags: ["roster"],
  hero_image_url: null,
  hero_image_alt: null,
  author_display_name: "TEST Editorial Desk",
  published_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  reading_minutes: 1,
  excerpt: "TEST FIXTURE summary.",
  body: [{ type: "paragraph", text: "TEST FIXTURE body." }],
  source_kind: "original",
  source_name: null,
  source_url: null,
};

describe("parseNewsQuery — valid filters", () => {
  it("defaults to page 1 with zero offset and the frozen page size", () => {
    const parsed = parseNewsQuery({});
    expect(parsed.filters).toEqual({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(NEWS_PAGE_SIZE);
    expect(parsed.offset).toBe(0);
    expect(parsed.invalid).toEqual([]);
  });

  it("passes valid filters through and derives the offset", () => {
    const parsed = parseNewsQuery({
      game: "bgmi",
      category: "team",
      query: "roster",
      tag: "roster",
      page: "3",
    });
    expect(parsed.filters).toEqual({
      game: "bgmi",
      category: "team",
      query: "roster",
      tag: "roster",
    });
    expect(parsed.page).toBe(3);
    expect(parsed.offset).toBe((3 - 1) * NEWS_PAGE_SIZE);
    expect(parsed.invalid).toEqual([]);
  });

  it("treats empty-string params as absent, not invalid", () => {
    const parsed = parseNewsQuery({ game: "", category: "", query: "", tag: "" });
    expect(parsed.filters).toEqual({});
    expect(parsed.invalid).toEqual([]);
  });

  it("takes the first value of repeated params", () => {
    const parsed = parseNewsQuery({ query: ["roster", "other"], page: ["2", "5"] });
    expect(parsed.filters.query).toBe("roster");
    expect(parsed.page).toBe(2);
  });
});

describe("parseNewsQuery — invalid params fail safely", () => {
  it("drops malformed filters and keeps the valid ones", () => {
    const parsed = parseNewsQuery({
      game: "BGMI!",
      category: "rumor",
      query: "z".repeat(121),
      tag: "BAD TAG!",
    });
    expect(parsed.filters).toEqual({});
    expect(parsed.invalid).toEqual(expect.arrayContaining(["game", "category", "query", "tag"]));
  });

  it("never throws on hostile input", () => {
    expect(() =>
      parseNewsQuery({
        category: "<script>",
        page: "' OR '1'='1",
        query: "'; DROP TABLE x; --",
      }),
    ).not.toThrow();
    const parsed = parseNewsQuery({ page: "' OR '1'='1" });
    expect(parsed.page).toBe(1);
    expect(parsed.invalid).toEqual(["page"]);
  });
});

describe("parseNewsQuery — pagination boundaries", () => {
  it("clamps page 0, negatives, fractions and overflow to page 1", () => {
    for (const page of ["0", "-3", "2.5", "abc", String(NEWS_MAX_PAGE + 1), "9999"]) {
      const parsed = parseNewsQuery({ page });
      expect(parsed.page).toBe(1);
      expect(parsed.offset).toBe(0);
      expect(parsed.invalid).toEqual(["page"]);
    }
  });

  it("accepts the maximum page whose offset stays in the SQL ceiling", () => {
    const parsed = parseNewsQuery({ page: String(NEWS_MAX_PAGE) });
    expect(parsed.page).toBe(NEWS_MAX_PAGE);
    expect(parsed.offset).toBeLessThanOrEqual(1000);
    expect(parsed.invalid).toEqual([]);
  });
});

describe("toArticleSearchInput", () => {
  it("maps to the reader contract with a +1 over-read for next-page detection", () => {
    const parsed = parseNewsQuery({ game: "bgmi", category: "team", page: "2" });
    const input = toArticleSearchInput(parsed);
    expect(input).toEqual({
      game: "bgmi",
      category: "team",
      limit: NEWS_PAGE_SIZE + 1,
      offset: NEWS_PAGE_SIZE,
    });
  });

  it("omits absent filters instead of forwarding undefined", () => {
    const input = toArticleSearchInput(parseNewsQuery({}));
    expect(input).toEqual({ limit: NEWS_PAGE_SIZE + 1, offset: 0 });
    expect("game" in input).toBe(false);
    expect("category" in input).toBe(false);
  });
});

describe("buildNewsHref — filter preservation", () => {
  it("preserves valid filters across pages", () => {
    const href = buildNewsHref({ game: "bgmi", category: "team", query: "roster", tag: "roster" }, 3);
    expect(href).toBe("/news?game=bgmi&category=team&query=roster&tag=roster&page=3");
  });

  it("omits the page param on page 1 (canonical directory URL)", () => {
    expect(buildNewsHref({ category: "team" }, 1)).toBe("/news?category=team");
    expect(buildNewsHref({}, 1)).toBe("/news");
  });

  it("encodes hostile filter values instead of reflecting them raw", () => {
    const href = buildNewsHref({ query: "<script>alert(1)</script>" }, 1);
    expect(href).not.toContain("<");
    expect(href).not.toContain(">");
    expect(href).toContain("/news?query=%3Cscript%3E");
  });
});

describe("metadata builders — projection fields only", () => {
  it("builds the detail title and description from projection fields", () => {
    const copy = buildNewsDetailMetadata(CARD);
    expect(copy.title).toBe("TEST FIXTURE headline (never publish) (@test-bgmi-story)");
    expect(copy.description).toBe(CARD.summary);
  });

  it("keeps directory, not-found and unavailable copy generic (no PII, no existence signal)", () => {
    const directory = buildNewsMetadata();
    expect(directory.title).toBe("Esports news");
    expect(JSON.stringify(directory)).not.toContain("author_user_id");
    const missing = buildNewsNotFoundMetadata();
    expect(missing.title).toBe("Story not found");
    expect(JSON.stringify(missing)).not.toContain("author_user_id");
    const unavailable = buildNewsUnavailableMetadata();
    expect(unavailable.title).toBe("News temporarily unavailable");
    expect(unavailable.title).not.toBe(missing.title);
    expect(JSON.stringify(unavailable)).not.toContain("author_user_id");
  });
});

describe("canonical URLs — no invented domain", () => {
  it("returns undefined when no app URL is configured", () => {
    const previous = process.env["NEXT_PUBLIC_APP_URL"];
    delete process.env["NEXT_PUBLIC_APP_URL"];
    try {
      expect(getNewsAppBaseUrl()).toBeUndefined();
      expect(buildNewsCanonicalUrl("/news/test-bgmi-story")).toBeUndefined();
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
      expect(buildNewsCanonicalUrl("/news/test-bgmi-story")).toBe(
        "https://esports.example.com/news/test-bgmi-story",
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
