// P4 News — schema tests (pure Zod, no database).
// Covers slug validation, URL validation, structured blocks, game
// association, source-attribution coherence, and strict protected-key
// rejection. Fixtures are clearly marked TEST fixtures (never production).

import { describe, expect, it } from "vitest";
import {
  articleDraftSchema,
  articleSlugSchema,
  articleSourceUrlSchema,
  articleTagSchema,
  getArticleBySlugInputSchema,
  searchArticlesInputSchema,
} from "@/features/news/schemas/article";

const TEST_DRAFT_BASE = {
  slug: "test-bgmi-roster-preview",
  headline: "TEST FIXTURE — BGMI roster preview (never publish)",
  summary: "TEST FIXTURE summary for schema tests only.",
  category: "team",
  authorDisplayName: "TEST Editorial Desk",
  body: [{ type: "paragraph", text: "TEST FIXTURE body paragraph." }],
  sourceKind: "original",
  lifecycle: "draft",
} as const;

describe("article slug validation", () => {
  it("accepts lowercase hyphenated slugs", () => {
    expect(articleSlugSchema.safeParse("monsoon-showdown-recap").success).toBe(true);
    expect(articleSlugSchema.safeParse("bgmi-2026-preview").success).toBe(true);
  });

  it("rejects spaces, underscores and hostile input (case is normalized, not rejected)", () => {
    for (const bad of ["BAD SLUG!", "Has Spaces", "under_score", "a", "<script>", "'; DROP TABLE x; --"]) {
      expect(articleSlugSchema.safeParse(bad).success, bad).toBe(false);
    }
    // Uppercase normalizes to lowercase (same posture as tournaments).
    expect(articleSlugSchema.parse("UPPER-CASE")).toBe("upper-case");
  });

  it("normalizes case and trims before matching", () => {
    expect(articleSlugSchema.parse("  Test-Story  ")).toBe("test-story");
  });

  it("getArticleBySlug rejects invalid syntax without touching the database", () => {
    expect(getArticleBySlugInputSchema.safeParse({ slug: "BAD SLUG!" }).success).toBe(false);
    expect(getArticleBySlugInputSchema.safeParse({ slug: "test-valid-slug" }).success).toBe(true);
  });
});

describe("URL validation", () => {
  it("accepts https URLs and rejects http, credentials, and junk", () => {
    expect(articleSourceUrlSchema.safeParse("https://example.com/announcement").success).toBe(true);
    expect(articleSourceUrlSchema.safeParse("http://example.com/x").success).toBe(false);
    expect(articleSourceUrlSchema.safeParse("https://user:pass@example.com/").success).toBe(false);
    expect(articleSourceUrlSchema.safeParse("not a url").success).toBe(false);
    expect(articleSourceUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
  });
});

describe("tags + game association", () => {
  it("accepts hyphenated tags and rejects hostile tags", () => {
    expect(articleTagSchema.safeParse("roster-moves").success).toBe(true);
    expect(articleTagSchema.safeParse("BAD TAG!").success).toBe(false);
  });

  it("allows platform-wide drafts (game omitted) and bgmi", () => {
    expect(articleDraftSchema.safeParse({ ...TEST_DRAFT_BASE }).success).toBe(true);
    expect(articleDraftSchema.safeParse({ ...TEST_DRAFT_BASE, gameKey: "bgmi" }).success).toBe(true);
  });

  it("rejects planned titles and unknown games at the schema boundary", () => {
    expect(articleDraftSchema.safeParse({ ...TEST_DRAFT_BASE, gameKey: "mlbb" }).success).toBe(
      false,
    );
    expect(articleDraftSchema.safeParse({ ...TEST_DRAFT_BASE, gameKey: "unknown-game!!" }).success).toBe(
      false,
    );
  });
});

describe("source attribution coherence", () => {
  it("requires source name+url for sourced stories", () => {
    expect(
      articleDraftSchema.safeParse({ ...TEST_DRAFT_BASE, sourceKind: "sourced" }).success,
    ).toBe(false);
    expect(
      articleDraftSchema.safeParse({
        ...TEST_DRAFT_BASE,
        sourceKind: "sourced",
        sourceName: "TEST Outlet",
        sourceUrl: "https://example.com/announcement",
      }).success,
    ).toBe(true);
  });

  it("requires hero alt text whenever a hero image is set", () => {
    expect(
      articleDraftSchema.safeParse({
        ...TEST_DRAFT_BASE,
        heroImageUrl: "https://example.com/hero.jpg",
      }).success,
    ).toBe(false);
    expect(
      articleDraftSchema.safeParse({
        ...TEST_DRAFT_BASE,
        heroImageUrl: "https://example.com/hero.jpg",
        heroImageAlt: "TEST hero description",
      }).success,
    ).toBe(true);
  });

  it("rejects raw-HTML blocks and protected keys (strict, never silently dropped)", () => {
    expect(
      articleDraftSchema.safeParse({
        ...TEST_DRAFT_BASE,
        body: [{ type: "html", html: "<p>evil</p>" }],
      }).success,
    ).toBe(false);
    expect(
      articleDraftSchema.safeParse({ ...TEST_DRAFT_BASE, author_user_id: "someone" }).success,
    ).toBe(false);
    expect(
      articleDraftSchema.safeParse({ ...TEST_DRAFT_BASE, id: "123" }).success,
    ).toBe(false);
  });
});

describe("directory input", () => {
  it("accepts shape-only filters and clamps limit/offset", () => {
    expect(
      searchArticlesInputSchema.safeParse({ game: "bgmi", category: "team", limit: 10, offset: 0 })
        .success,
    ).toBe(true);
    expect(searchArticlesInputSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(searchArticlesInputSchema.safeParse({ offset: 5000 }).success).toBe(false);
    expect(searchArticlesInputSchema.safeParse({ category: "rumor" }).success).toBe(false);
  });
});
