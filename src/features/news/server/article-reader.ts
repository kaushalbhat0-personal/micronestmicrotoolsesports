// Public news reader (P4).
// Reads exclusively through the PROPOSED masked RPC pair
// `search_articles` / `get_article_by_slug` — no migration exists, so these
// calls resolve to the generic unavailable state until the content-model
// proposal (04-content-model.md) is accepted, migrated, and verified.
//
// Security posture (mirrors P1 teams / P3 tournaments readers):
// - Server-side only; call-site injects any client (anon included).
// - Identity-free: no user ID accepted anywhere in this module.
// - Zod-validated inputs; unknown games pass through to zero rows (fail closed).
// - Strict output mapping to the proposed columns (+ derived
//   reading_minutes/excerpt + detail body/source). Extra keys — author
//   identity internals, revision history, moderation metadata — are dropped.
// - External source/hero URLs are re-validated here (https-only); a bad URL
//   fails the row closed rather than rendering an attacker-controlled link.
// - Body blocks are re-validated and text is sanitized; raw HTML can never
//   reach the renderer (blocks carry plain text only).
// - Errors are generic domain errors (never raw PostgREST detail to UI).
// - No write path exists in this module.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  excerptFromBlocks,
  estimateReadingMinutes,
  isArticleCategory,
  isArticleContentBlock,
  type ArticleContentBlock,
} from "../domain/article";
import { NEWS_DIRECTORY_COLUMNS } from "../domain/columns";
import { isSafeExternalUrl, sanitizePlainText } from "../domain/sanitize";
import {
  NewsDirectoryOperationError,
  NewsDirectoryValidationError,
  type PublicArticleCard,
  type PublicArticleDetail,
} from "../domain/public-card";
import {
  articleTagSchema,
  getArticleBySlugInputSchema,
  searchArticlesInputSchema,
  type SearchArticlesInput,
} from "../schemas/article";
import { isSupportedGameKey } from "@/lib/game-catalog/catalog";

interface ArticleSearchRpcRow {
  slug: unknown;
  headline: unknown;
  summary: unknown;
  category: unknown;
  game_key: unknown;
  tags: unknown;
  hero_image_url: unknown;
  hero_image_alt: unknown;
  author_display_name: unknown;
  published_at: unknown;
  updated_at: unknown;
}

interface ArticleDetailRpcRow extends ArticleSearchRpcRow {
  body: unknown;
  source_kind: unknown;
  source_name: unknown;
  source_url: unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isIsoInstant(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function toTagsOrThrow(value: unknown): string[] {
  if (!isStringArray(value)) {
    throw new NewsDirectoryOperationError();
  }
  if (value.length > 8) {
    throw new NewsDirectoryOperationError();
  }
  for (const tag of value) {
    if (!articleTagSchema.safeParse(tag).success) {
      throw new NewsDirectoryOperationError();
    }
  }
  return value.map((tag) => tag.trim().toLowerCase());
}

function toGameKeyOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string" || !isSupportedGameKey(value.trim().toLowerCase())) {
    throw new NewsDirectoryOperationError();
  }
  return value.trim().toLowerCase();
}

function toUrlOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isSafeExternalUrl(value)) {
    throw new NewsDirectoryOperationError();
  }
  return (value as string).trim();
}

function toBodyOrThrow(value: unknown): PublicArticleDetail["body"] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 80) {
    throw new NewsDirectoryOperationError();
  }
  return value.map((entry) => {
    if (!isArticleContentBlock(entry)) {
      throw new NewsDirectoryOperationError();
    }
    const block = entry as ArticleContentBlock;
    if (block.type === "list") {
      const items = block.items.map((item) => sanitizePlainText(item));
      if (items.some((item) => item === "")) {
        throw new NewsDirectoryOperationError();
      }
      return { type: "list" as const, items };
    }
    const text = sanitizePlainText(block.text);
    if (text === "") {
      throw new NewsDirectoryOperationError();
    }
    if (block.type === "quote") {
      const attribution =
        block.attribution === undefined || block.attribution === null
          ? null
          : sanitizePlainText(block.attribution, 160);
      return { type: "quote" as const, text, attribution };
    }
    return { type: block.type, text } as PublicArticleDetail["body"][number];
  });
}

function toPublicArticleCard(row: ArticleSearchRpcRow): PublicArticleCard {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.headline) ||
    !isNonEmptyString(row.summary) ||
    !isArticleCategory(row.category) ||
    !isNonEmptyString(row.author_display_name) ||
    !isIsoInstant(row.published_at) ||
    !isIsoInstant(row.updated_at)
  ) {
    throw new NewsDirectoryOperationError();
  }
  const headline = sanitizePlainText(row.headline, 140);
  const summary = sanitizePlainText(row.summary, 300);
  if (headline === "" || summary === "") {
    throw new NewsDirectoryOperationError();
  }
  const heroUrl = toUrlOrNull(row.hero_image_url);
  const heroAlt =
    typeof row.hero_image_alt === "string" && row.hero_image_alt.trim() !== ""
      ? sanitizePlainText(row.hero_image_alt, 180)
      : null;
  if (heroUrl !== null && heroAlt === null) {
    throw new NewsDirectoryOperationError();
  }
  const body: ArticleContentBlock[] = [{ type: "paragraph", text: summary }];
  return {
    slug: row.slug,
    headline,
    summary,
    category: row.category,
    game_key: toGameKeyOrNull(row.game_key),
    tags: toTagsOrThrow(row.tags),
    hero_image_url: heroUrl,
    hero_image_alt: heroAlt,
    author_display_name: sanitizePlainText(row.author_display_name, 80),
    published_at: row.published_at,
    updated_at: row.updated_at,
    reading_minutes: estimateReadingMinutes([{ type: "paragraph", text: summary }]),
    excerpt: excerptFromBlocks(body),
  };
}

function toPublicArticleDetail(row: ArticleDetailRpcRow): PublicArticleDetail {
  const card = toPublicArticleCard(row);
  const body = toBodyOrThrow(row.body);
  if (row.source_kind !== "original" && row.source_kind !== "sourced") {
    throw new NewsDirectoryOperationError();
  }
  const sourceName =
    row.source_name === null || row.source_name === undefined
      ? null
      : sanitizePlainText(String(row.source_name), 120);
  const sourceUrl = toUrlOrNull(row.source_url);
  if (row.source_kind === "sourced" && (sourceName === null || sourceUrl === null)) {
    throw new NewsDirectoryOperationError();
  }
  return {
    ...card,
    body,
    reading_minutes: estimateReadingMinutes(body),
    excerpt: excerptFromBlocks(body),
    source_kind: row.source_kind,
    source_name: sourceName,
    source_url: sourceUrl,
  };
}

function assertSearchKeySet(rows: ArticleSearchRpcRow[]): void {
  const expected = [...NEWS_DIRECTORY_COLUMNS];
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (keys.length !== expected.length || !expected.every((key, index) => keys[index] === key)) {
      throw new NewsDirectoryOperationError();
    }
  }
}

function assertDetailKeySet(rows: ArticleDetailRpcRow[]): void {
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (
      keys.length !== NEWS_DIRECTORY_COLUMNS.length + 4 ||
      !keys.includes("body") ||
      !keys.includes("source_kind") ||
      !keys.includes("source_name") ||
      !keys.includes("source_url")
    ) {
      throw new NewsDirectoryOperationError();
    }
  }
}

export async function searchArticles(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicArticleCard[]> {
  let parsed: SearchArticlesInput;
  try {
    parsed = searchArticlesInputSchema.parse(input);
  } catch {
    throw new NewsDirectoryValidationError();
  }

  const { data, error } = await client.rpc("search_articles", {
    p_game: parsed.game ?? null,
    p_category: parsed.category ?? null,
    p_query: parsed.query ?? null,
    p_tag: parsed.tag ?? null,
    p_limit: parsed.limit,
    p_offset: parsed.offset,
  });
  if (error) {
    throw new NewsDirectoryOperationError();
  }
  const rows = ((data ?? []) as ArticleSearchRpcRow[]).slice();
  assertSearchKeySet(rows);
  return rows.map((row) => toPublicArticleCard(row));
}

export async function getArticleBySlug(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicArticleDetail | null> {
  const normalized: unknown = typeof input === "string" ? { slug: input } : input;
  let parsed: { slug: string };
  try {
    parsed = getArticleBySlugInputSchema.parse(normalized);
  } catch {
    throw new NewsDirectoryValidationError();
  }

  const { data, error } = await client.rpc("get_article_by_slug", {
    p_slug: parsed.slug,
  });
  if (error) {
    throw new NewsDirectoryOperationError();
  }
  const rows = ((data ?? []) as ArticleDetailRpcRow[]).slice();
  if (rows.length === 0) {
    return null;
  }
  if (rows.length !== 1) {
    throw new NewsDirectoryOperationError();
  }
  assertDetailKeySet(rows);
  return toPublicArticleDetail(rows[0] as ArticleDetailRpcRow);
}
