// P4 News — reader unit tests with a fake Supabase client (no network).
// Covers: shape validation, hostile URL/row fail-closed, invalid slug
// without RPC call, missing -> null, transport -> generic operation error.

import { describe, expect, it, vi } from "vitest";
import {
  NewsDirectoryOperationError,
  NewsDirectoryValidationError,
} from "@/features/news/domain/public-card";
import { NEWS_DIRECTORY_COLUMNS } from "@/features/news/domain/columns";
import { getArticleBySlug, searchArticles } from "@/features/news/server/article-reader";

function orderedSearchRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of NEWS_DIRECTORY_COLUMNS) {
    row[key] = {
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
    }[key];
  }
  return { ...row, ...overrides };
}

function fakeClient(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc } as never, calls: rpc };
}

describe("searchArticles", () => {
  it("maps ordered rows to public cards without leaking internals", async () => {
    const { client } = fakeClient([orderedSearchRow()]);
    const cards = await searchArticles(client, { limit: 13, offset: 0 });
    expect(cards).toHaveLength(1);
    expect(cards[0]?.slug).toBe("test-bgmi-story");
    expect(JSON.stringify(cards[0])).not.toContain("author_user_id");
  });

  it("supports platform-wide rows (game_key null)", async () => {
    const { client } = fakeClient([orderedSearchRow({ game_key: null })]);
    const cards = await searchArticles(client, { limit: 13, offset: 0 });
    expect(cards[0]?.game_key).toBeNull();
  });

  it("fails closed on hostile source rows (http URL, bad shape)", async () => {
    const badUrl = fakeClient([orderedSearchRow({ hero_image_url: "http://evil.example/x" })]);
    await expect(searchArticles(badUrl.client, { limit: 13, offset: 0 })).rejects.toThrow(
      NewsDirectoryOperationError,
    );
    const badKeys = fakeClient([{ ...orderedSearchRow(), injected: "x" }]);
    await expect(searchArticles(badKeys.client, { limit: 13, offset: 0 })).rejects.toThrow(
      NewsDirectoryOperationError,
    );
  });

  it("maps transport failures to a generic operation error (no raw detail)", async () => {
    const { client } = fakeClient(null, { message: "function search_articles does not exist" });
    const error = await searchArticles(client, { limit: 13, offset: 0 }).catch((e) => e);
    expect(error).toBeInstanceOf(NewsDirectoryOperationError);
    expect(String(error.message)).not.toContain("does not exist");
  });
});

describe("getArticleBySlug", () => {
  function detailRow(): Record<string, unknown> {
    return {
      ...orderedSearchRow(),
      body: [{ type: "paragraph", text: "TEST FIXTURE body." }],
      source_kind: "original",
      source_name: null,
      source_url: null,
    };
  }

  it("rejects invalid slug syntax without calling the RPC", async () => {
    const { client, calls } = fakeClient([]);
    await expect(getArticleBySlug(client, "BAD SLUG!")).rejects.toThrow(
      NewsDirectoryValidationError,
    );
    expect(calls).not.toHaveBeenCalled();
  });

  it("returns null for zero rows (404-equivalence)", async () => {
    const { client } = fakeClient([]);
    await expect(getArticleBySlug(client, "test-missing-story")).resolves.toBeNull();
  });

  it("returns the detail for a valid row", async () => {
    const { client } = fakeClient([detailRow()]);
    const detail = await getArticleBySlug(client, "test-bgmi-story");
    expect(detail?.headline).toContain("TEST FIXTURE");
  });

  it("requires source attribution for sourced stories", async () => {
    const { client } = fakeClient([
      { ...detailRow(), source_kind: "sourced", source_name: null, source_url: null },
    ]);
    await expect(getArticleBySlug(client, "test-bgmi-story")).rejects.toThrow(
      NewsDirectoryOperationError,
    );
  });

  it("maps transport failures to a generic operation error", async () => {
    const { client } = fakeClient(null, { message: "function get_article_by_slug does not exist" });
    const error = await getArticleBySlug(client, "test-valid-slug").catch((e) => e);
    expect(error).toBeInstanceOf(NewsDirectoryOperationError);
    expect(String(error.message)).not.toContain("does not exist");
  });
});
