// Route-boundary query parsing for /news (P4).
// Pure module: no Supabase, no next/headers, no rendering. The route awaits
// `searchParams`, passes the raw record here, and forwards the returned
// input to ArticleReader.searchArticles — the sole public news data path
// (PROPOSED RPC pair, no migration exists; reads resolve to the route
// unavailable state, never fake rows).
//
// Fail-safe rule: every invalid parameter is dropped (recorded in `invalid`
// for a user-facing notice) and valid filters are preserved. Pagination is
// bounded: the URL carries only a 1-based `page`; limit/offset derive from
// the frozen page size inside the proposed SQL clamps (limit 1..60, offset
// 0..1000). No unbounded fetching is expressible.

import { z } from "zod";
import type { SearchArticlesInput } from "@/features/news/schemas/article";
import type { PublicArticleDetail } from "@/features/news/domain/public-card";

// Frozen route page size (inside the proposed 1..60 limit). One extra row
// is fetched internally to detect a next page without leaking total counts.
export const NEWS_PAGE_SIZE = 12;

// Proposed OFFSET ceiling is 1000. (84 - 1) * 12 = 996 stays inside it;
// page 85+ can never address new rows, so it is rejected here.
export const NEWS_MAX_PAGE = 84;

const gameFieldSchema = z.string().regex(/^[a-z0-9-]{2,24}$/, "invalid game filter");

const categoryFieldSchema = z.enum([
  "industry",
  "game-update",
  "tournament",
  "team",
  "player",
  "platform",
  "guide",
]);

const queryFieldSchema = z.string().min(1).max(120);

const tagFieldSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid tag filter")
  .min(2)
  .max(32);

const pageFieldSchema = z.coerce.number().int().min(1).max(NEWS_MAX_PAGE);

export interface NewsFilters {
  game?: string | undefined;
  category?: string | undefined;
  query?: string | undefined;
  tag?: string | undefined;
}

export interface ParsedNewsQuery {
  filters: NewsFilters;
  page: number;
  limit: number;
  offset: number;
  // Names of dropped parameters ("game" | "category" | "query" | "tag" | "page").
  invalid: string[];
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

// Empty strings (e.g. "All ..." form options submitting `game=`) mean absent,
// not invalid.
function clean(value: string | string[] | undefined): string | undefined {
  const first = firstValue(value);
  if (first === undefined) {
    return undefined;
  }
  const trimmed = first.trim();
  return trimmed === "" ? undefined : trimmed;
}

// Parse raw route search params. Never throws: invalid fields are dropped and
// named in `invalid` so the route can show a safe notice.
export function parseNewsQuery(
  raw: Record<string, string | string[] | undefined>,
): ParsedNewsQuery {
  const invalid: string[] = [];
  const filters: NewsFilters = {};

  const game = clean(raw["game"])?.toLowerCase();
  if (game !== undefined) {
    if (gameFieldSchema.safeParse(game).success) {
      filters.game = game;
    } else {
      invalid.push("game");
    }
  }

  const category = clean(raw["category"])?.toLowerCase();
  if (category !== undefined) {
    if (categoryFieldSchema.safeParse(category).success) {
      filters.category = category;
    } else {
      invalid.push("category");
    }
  }

  const query = clean(raw["query"]);
  if (query !== undefined) {
    if (queryFieldSchema.safeParse(query).success) {
      filters.query = query;
    } else {
      invalid.push("query");
    }
  }

  const tag = clean(raw["tag"])?.toLowerCase();
  if (tag !== undefined) {
    if (tagFieldSchema.safeParse(tag).success) {
      filters.tag = tag;
    } else {
      invalid.push("tag");
    }
  }

  const pageRaw = clean(raw["page"]);
  let page = 1;
  if (pageRaw !== undefined) {
    const parsed = pageFieldSchema.safeParse(pageRaw);
    if (parsed.success) {
      page = parsed.data;
    } else {
      invalid.push("page");
    }
  }

  return {
    filters,
    page,
    limit: NEWS_PAGE_SIZE,
    offset: (page - 1) * NEWS_PAGE_SIZE,
    invalid,
  };
}

// Map the parsed route query to the reader input contract. Undefined fields
// are omitted (never forwarded).
export function toArticleSearchInput(parsed: ParsedNewsQuery): SearchArticlesInput {
  // +1 over-read detects a next page without total-count queries.
  const input: SearchArticlesInput = {
    limit: NEWS_PAGE_SIZE + 1,
    offset: parsed.offset,
  };
  if (parsed.filters.game !== undefined) {
    input.game = parsed.filters.game;
  }
  if (parsed.filters.category !== undefined) {
    input.category = parsed.filters.category as SearchArticlesInput["category"];
  }
  if (parsed.filters.query !== undefined) {
    input.query = parsed.filters.query;
  }
  if (parsed.filters.tag !== undefined) {
    input.tag = parsed.filters.tag;
  }
  return input;
}

// Shareable directory URL preserving exactly the valid filters. Page 1 is
// omitted (canonical directory URL has no page param).
export function buildNewsHref(filters: NewsFilters, page: number): `/news` | `/news?${string}` {
  const params = new URLSearchParams();
  if (filters.game !== undefined) {
    params.set("game", filters.game);
  }
  if (filters.category !== undefined) {
    params.set("category", filters.category);
  }
  if (filters.query !== undefined) {
    params.set("query", filters.query);
  }
  if (filters.tag !== undefined) {
    params.set("tag", filters.tag);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const queryString = params.toString();
  return queryString === "" ? "/news" : `/news?${queryString}`;
}

export interface RouteMetadata {
  title: string;
  description: string;
}

// Directory metadata: static copy only, no projection data, no PII.
export function buildNewsMetadata(): RouteMetadata {
  return {
    title: "Esports news",
    description: "MicroNest Esports news: industry stories, tournament coverage and guides.",
  };
}

// Detail metadata derived ONLY from the public article card
// (generateMetadata from projection only — no private value can leak here).
export function buildNewsDetailMetadata(card: PublicArticleDetail): RouteMetadata {
  const title = `${card.headline} (@${card.slug})`;
  if (card.summary.trim() !== "") {
    return { title, description: card.summary.slice(0, 160) };
  }
  return {
    title,
    description: `MicroNest Esports story: ${card.headline} (@${card.slug}).`,
  };
}

// Generic not-found metadata. Identical for missing and unpublished slugs
// (404-equivalence): no existence signal.
export function buildNewsNotFoundMetadata(): RouteMetadata {
  return {
    title: "Story not found",
    description: "The requested story could not be found.",
  };
}

// Intentional unavailable metadata. Used when the database cannot be
// reached (including the proposed-RPC missing case): distinct from
// not-found so caches, callers and readers never mistake an outage for a
// missing slug.
export function buildNewsUnavailableMetadata(): RouteMetadata {
  return {
    title: "News temporarily unavailable",
    description: "News is temporarily unavailable. Please try again later.",
  };
}

// Canonical base URL. Reads the documented public app URL only; when it is
// not configured no canonical is emitted (never invent a domain).
export function getNewsAppBaseUrl(): string | undefined {
  const raw = process.env["NEXT_PUBLIC_APP_URL"]?.trim();
  if (!raw) {
    return undefined;
  }
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

export function buildNewsCanonicalUrl(path: string): string | undefined {
  const base = getNewsAppBaseUrl();
  if (base === undefined) {
    return undefined;
  }
  return `${base}${path}`;
}
