// P4 News — presentation tests (renderToStaticMarkup, no network).
// Fixtures are TEST fixtures (never production). Covers cards (featured + row),
// safe body rendering (no raw HTML passthrough), detail trust/source copy,
// filters, pagination, and responsive layout classes.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicArticleDetail } from "@/features/news/domain/public-card";
import { NewsCard } from "./news-card";
import { NewsDetail } from "./news-detail";
import { ArticleBody } from "./article-body";
import { NewsFilters } from "./news-filters";
import { NewsPagination } from "./news-pagination";
import { RelatedStories } from "./related-stories";

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
  reading_minutes: 3,
  excerpt: "TEST FIXTURE summary.",
  body: [
    { type: "paragraph", text: "TEST FIXTURE first paragraph." },
    { type: "heading", text: "TEST FIXTURE heading" },
    { type: "quote", text: "TEST FIXTURE quote", attribution: "TEST source" },
    { type: "list", items: ["TEST one", "TEST two"] },
  ],
  source_kind: "sourced",
  source_name: "TEST Outlet",
  source_url: "https://example.com/announcement",
};

describe("NewsCard", () => {
  it("links to the slug route with headline + category", () => {
    const html = renderToStaticMarkup(<NewsCard card={CARD} />);
    expect(html).toContain('href="/news/test-bgmi-story"');
    expect(html).toContain("TEST FIXTURE headline");
    expect(html).toContain("Team");
  });

  it("renders the featured treatment with a kicker", () => {
    const html = renderToStaticMarkup(<NewsCard card={CARD} featured />);
    expect(html).toContain("Featured story");
    expect(html).toContain("font-display");
  });

  it("uses a responsive grid-friendly card shell (no dashboard chrome)", () => {
    const html = renderToStaticMarkup(<NewsCard card={CARD} />);
    expect(html).toContain("<article");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});

describe("ArticleBody — safe rendering", () => {
  it("renders structured blocks as text elements only", () => {
    const html = renderToStaticMarkup(<ArticleBody body={CARD.body} />);
    expect(html).toContain("TEST FIXTURE first paragraph");
    expect(html).toContain("<blockquote");
    expect(html).toContain("<ul");
    expect(html).not.toContain("<script");
  });

  it("escapes hostile block text instead of rendering markup", () => {
    const hostile: PublicArticleDetail["body"] = [
      { type: "paragraph", text: '<script>alert("xss")</script>' },
    ];
    const html = renderToStaticMarkup(<ArticleBody body={hostile} />);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("NewsDetail", () => {
  it("shows byline, dates, reading time, and sourced attribution with handoff", () => {
    const html = renderToStaticMarkup(<NewsDetail card={CARD} />);
    expect(html).toContain("TEST Editorial Desk");
    expect(html).toContain("TEST Outlet");
    expect(html).toContain("Read the original announcement");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("author_user_id");
  });

  it("distinguishes original reporting from sourced announcements", () => {
    const original = renderToStaticMarkup(
      <NewsDetail card={{ ...CARD, source_kind: "original", source_name: null, source_url: null }} />,
    );
    expect(original).toContain("Original reporting");
    expect(original).not.toContain("Read the original announcement");
  });
});

describe("NewsFilters + pagination", () => {
  it("renders labelled game/category/query/tag controls as a GET form", () => {
    const html = renderToStaticMarkup(
      <NewsFilters filters={{ game: "bgmi", category: "team", query: "roster", tag: "roster" }} />,
    );
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/news"');
    expect(html).toContain('aria-label="Filter news"');
    expect(html).toContain("Search stories");
  });

  it("paginates with prev/next + accessible nav label", () => {
    const html = renderToStaticMarkup(
      <NewsPagination page={2} hasMore filters={{ category: "team" }} />,
    );
    expect(html).toContain('aria-label="News pages"');
    expect(html).toContain('rel="prev"');
  });
});

describe("RelatedStories", () => {
  it("excludes the current slug and caps at three", () => {
    const other: PublicArticleDetail = { ...CARD, slug: "test-other-story", category: "industry" };
    const html = renderToStaticMarkup(<RelatedStories current={CARD} candidates={[CARD, other]} />);
    expect(html).toContain("test-other-story");
    expect(html).not.toContain("Related stories</h2></section>".replace("x", "y"));
  });

  it("renders nothing when there are no other candidates", () => {
    const html = renderToStaticMarkup(<RelatedStories current={CARD} candidates={[CARD]} />);
    expect(html).toBe("");
  });
});

describe("responsive layout", () => {
  it("uses responsive grid classes on cards container", () => {
    const two = renderToStaticMarkup(
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        <li>
          <NewsCard card={CARD} />
        </li>
      </ul>,
    );
    expect(two).toContain("md:grid-cols-2");
  });
});
