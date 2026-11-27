// P4 News — domain unit tests (pure, no database).
// Covers lifecycle/category vocabulary, visibility separation (editorial
// status vs public visibility), reading-time, and excerpt.

import { describe, expect, it } from "vitest";
import {
  articleCategoryLabel,
  estimateReadingMinutes,
  excerptFromBlocks,
  isArticleCategory,
  isArticleContentBlock,
  isArticleLifecycle,
  isPubliclyVisible,
  type ArticleContentBlock,
} from "@/features/news/domain/article";

describe("article lifecycle vocabulary", () => {
  it("accepts the six frozen states and rejects unknowns", () => {
    for (const state of ["draft", "in_review", "scheduled", "published", "unpublished", "archived"]) {
      expect(isArticleLifecycle(state)).toBe(true);
    }
    expect(isArticleLifecycle("live")).toBe(false);
    expect(isArticleLifecycle("")).toBe(false);
    expect(isArticleLifecycle(null)).toBe(false);
  });
});

describe("article category vocabulary", () => {
  it("accepts the seven frozen categories and labels each", () => {
    const categories = ["industry", "game-update", "tournament", "team", "player", "platform", "guide"] as const;
    for (const category of categories) {
      expect(isArticleCategory(category)).toBe(true);
      expect(articleCategoryLabel(category).length).toBeGreaterThan(0);
    }
    expect(isArticleCategory("rumor")).toBe(false);
  });
});

describe("content block guard", () => {
  it("accepts paragraph/heading/quote/list and rejects raw HTML blocks", () => {
    expect(isArticleContentBlock({ type: "paragraph", text: "Hello" })).toBe(true);
    expect(isArticleContentBlock({ type: "heading", text: "Title" })).toBe(true);
    expect(isArticleContentBlock({ type: "quote", text: "Words" })).toBe(true);
    expect(isArticleContentBlock({ type: "list", items: ["a", "b"] })).toBe(true);
    expect(isArticleContentBlock({ type: "html", html: "<p>x</p>" })).toBe(false);
    expect(isArticleContentBlock({ type: "list", items: ["only-one"] })).toBe(true);
    expect(isArticleContentBlock(null)).toBe(false);
  });
});

describe("public visibility separation", () => {
  it("requires published lifecycle AND a live published_at", () => {
    expect(
      isPubliclyVisible({ lifecycle: "published", published_at: "2020-01-01T00:00:00.000Z" }),
    ).toBe(true);
    // Editorial status alone is not enough.
    expect(isPubliclyVisible({ lifecycle: "draft", published_at: "2020-01-01T00:00:00.000Z" })).toBe(
      false,
    );
    expect(
      isPubliclyVisible({ lifecycle: "in_review", published_at: "2020-01-01T00:00:00.000Z" }),
    ).toBe(false);
    expect(isPubliclyVisible({ lifecycle: "scheduled", published_at: "2020-01-01T00:00:00.000Z" })).toBe(
      false,
    );
    // A published row without a timestamp, or with a future timestamp, stays hidden.
    expect(isPubliclyVisible({ lifecycle: "published", published_at: null })).toBe(false);
    expect(
      isPubliclyVisible({ lifecycle: "published", published_at: "2999-01-01T00:00:00.000Z" }),
    ).toBe(false);
    expect(
      isPubliclyVisible({ lifecycle: "published", published_at: "not-a-date" }),
    ).toBe(false);
  });
});

describe("reading time + excerpt", () => {
  it("estimates a minimum of one minute", () => {
    expect(estimateReadingMinutes([{ type: "paragraph", text: "Short." }])).toBe(1);
    const long: ArticleContentBlock[] = [
      { type: "paragraph", text: `${"word ".repeat(400)}` },
    ];
    expect(estimateReadingMinutes(long)).toBe(2);
  });

  it("derives a capped plain-text excerpt", () => {
    const blocks: ArticleContentBlock[] = [
      { type: "paragraph", text: "First paragraph carries the excerpt." },
    ];
    expect(excerptFromBlocks(blocks)).toContain("First paragraph");
    const lengthy: ArticleContentBlock[] = [{ type: "paragraph", text: `x`.repeat(500) }];
    expect(excerptFromBlocks(lengthy).length).toBeLessThanOrEqual(160);
  });
});
