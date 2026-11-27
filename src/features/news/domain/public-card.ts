// P4 News — public contracts for the PROPOSED masked RPC pair
// `search_articles` / `get_article_by_slug` (no migration exists; see
// docs/product-development/P4-news-editorial/04-content-model.md).
// Only published, publicly visible rows are projected: lifecycle internals
// beyond "published", author identity internals, draft/revision history,
// moderation metadata, and scheduling internals never leave the reader.

import type { NEWS_DIRECTORY_COLUMNS } from "./columns";
import type { ArticleCategory } from "./article";

export interface PublicArticleCard {
  slug: string;
  headline: string;
  summary: string;
  category: ArticleCategory;
  game_key: string | null;
  tags: string[];
  hero_image_url: string | null;
  hero_image_alt: string | null;
  author_display_name: string;
  published_at: string;
  updated_at: string;
  reading_minutes: number;
  excerpt: string;
}

export interface PublicArticleDetail extends PublicArticleCard {
  body: Array<
    | { type: "paragraph"; text: string }
    | { type: "heading"; text: string }
    | { type: "quote"; text: string; attribution?: string | null }
    | { type: "list"; items: string[] }
  >;
  source_kind: "original" | "sourced";
  source_name: string | null;
  source_url: string | null;
}

// Compile-time guard: card exposes exactly the proposed columns (+ derived
// reading_minutes/excerpt computed at read time, never stored authority).
type FrozenKey = (typeof NEWS_DIRECTORY_COLUMNS)[number] | "reading_minutes" | "excerpt";
type CardKey = keyof PublicArticleCard;
type Missing = Exclude<FrozenKey, CardKey>;
type Extra = Exclude<CardKey, FrozenKey>;
const _missingGuard: Missing = undefined as never;
const _extraGuard: Extra = undefined as never;
void _missingGuard;
void _extraGuard;

export class NewsDirectoryValidationError extends Error {
  constructor() {
    super("Invalid news search input.");
    this.name = "NewsDirectoryValidationError";
  }
}

export class NewsDirectoryOperationError extends Error {
  constructor() {
    super("Could not load news. Please retry.");
    this.name = "NewsDirectoryOperationError";
  }
}

export class NewsWriteDisabledError extends Error {
  constructor() {
    super(
      "News publishing is disabled in this phase: article authorization, content security and database policies are awaiting decisions.",
    );
    this.name = "NewsWriteDisabledError";
  }
}
