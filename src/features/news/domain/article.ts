// P4 News — editorial domain: lifecycle, categories, content blocks.
// Game-agnostic: articles may be platform-wide (game_key null) or attached
// to one supported title (BGMI today). Editorial status is separate from
// public visibility: only lifecycle === "published" is publicly readable,
// and visibility additionally requires a non-null published_at that is not
// in the future. No author identities are invented here.

export const ARTICLE_LIFECYCLE_STATES = [
  "draft",
  "in_review",
  "scheduled",
  "published",
  "unpublished",
  "archived",
] as const;

export type ArticleLifecycle = (typeof ARTICLE_LIFECYCLE_STATES)[number];

export function isArticleLifecycle(value: unknown): value is ArticleLifecycle {
  return (
    typeof value === "string" &&
    (ARTICLE_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

export const ARTICLE_CATEGORIES = [
  "industry",
  "game-update",
  "tournament",
  "team",
  "player",
  "platform",
  "guide",
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export function isArticleCategory(value: unknown): value is ArticleCategory {
  return (
    typeof value === "string" &&
    (ARTICLE_CATEGORIES as readonly string[]).includes(value)
  );
}

export const ARTICLE_CATEGORY_LABELS: Record<ArticleCategory, string> = {
  industry: "Industry",
  "game-update": "Game update",
  tournament: "Tournament",
  team: "Team",
  player: "Player",
  platform: "Platform",
  guide: "Guide",
};

export function articleCategoryLabel(category: ArticleCategory): string {
  return ARTICLE_CATEGORY_LABELS[category];
}

export type ArticleSourceKind = "original" | "sourced";

export function isArticleSourceKind(value: unknown): value is ArticleSourceKind {
  return value === "original" || value === "sourced";
}

/** Structured body blocks. Raw HTML is never a block kind. */
export type ArticleContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "quote"; text: string; attribution?: string | null }
  | { type: "list"; items: string[] };

export function isArticleContentBlock(value: unknown): value is ArticleContentBlock {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  switch (record["type"]) {
    case "paragraph":
    case "heading":
    case "quote":
      return typeof record["text"] === "string";
    case "list":
      return (
        Array.isArray(record["items"]) &&
        (record["items"] as unknown[]).every((entry) => typeof entry === "string")
      );
    default:
      return false;
  }
}

export const MAX_CONTENT_BLOCKS = 80;
export const MAX_BLOCK_TEXT_LENGTH = 2000;
export const MAX_LIST_ITEMS = 24;

/** Public visibility: published lifecycle + live published_at. */
export function isPubliclyVisible(input: {
  lifecycle: ArticleLifecycle;
  published_at: string | null;
  nowMs?: number;
}): boolean {
  if (input.lifecycle !== "published") {
    return false;
  }
  if (input.published_at === null) {
    return false;
  }
  const ms = Date.parse(input.published_at);
  if (Number.isNaN(ms)) {
    return false;
  }
  return ms <= (input.nowMs ?? Date.now());
}

/** Reading-time estimate (200 wpm, minimum 1 minute). Pure presentation. */
export function estimateReadingMinutes(blocks: ArticleContentBlock[]): number {
  let words = 0;
  for (const block of blocks) {
    if (block.type === "list") {
      for (const item of block.items) {
        words += item.trim().split(/\s+/).filter(Boolean).length;
      }
    } else {
      words += block.text.trim().split(/\s+/).filter(Boolean).length;
      if (block.type === "quote" && block.attribution) {
        words += block.attribution.trim().split(/\s+/).filter(Boolean).length;
      }
    }
  }
  return Math.max(1, Math.ceil(words / 200));
}

/** Plain-text excerpt for cards/metadata (no markup, length-capped). */
export function excerptFromBlocks(blocks: ArticleContentBlock[], maxLength = 160): string {
  const first = blocks.find(
    (block): block is Extract<ArticleContentBlock, { text: string }> =>
      (block.type === "paragraph" || block.type === "heading" || block.type === "quote") &&
      block.text.trim() !== "",
  );
  const text = (first?.text ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
