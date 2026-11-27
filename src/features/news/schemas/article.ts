// P4 News — Zod boundaries (new vertical, no legacy port).
// Layers:
// - Slug / URL primitives (shared by directory + draft contracts).
// - Structured content blocks (paragraph/heading/quote/list; never raw HTML).
// - Publishing draft: strict creation/editing contract (writes disabled).
// - Directory input: shape-only filters for the proposed RPC pair.

import { z } from "zod";
import { gameKeySchema } from "@/features/player-profile/schemas/game";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_LIFECYCLE_STATES,
  MAX_BLOCK_TEXT_LENGTH,
  MAX_CONTENT_BLOCKS,
  MAX_LIST_ITEMS,
} from "../domain/article";

export const MAX_HEADLINE_LENGTH = 140;
export const MAX_SUMMARY_LENGTH = 300;
export const MAX_TAG_LENGTH = 32;
export const MAX_TAGS = 8;
export const MAX_AUTHOR_NAME_LENGTH = 80;
export const MAX_SOURCE_NAME_LENGTH = 120;

export const articleSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words joined by hyphens")
  .min(2)
  .max(100);

const httpsUrlSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return (
          parsed.protocol === "https:" &&
          parsed.username === "" &&
          parsed.password === "" &&
          parsed.hostname !== ""
        );
      } catch {
        return false;
      }
    }, "URL must be a valid https URL without credentials");

export const articleSourceUrlSchema = httpsUrlSchema(2048);
export const heroImageUrlSchema = httpsUrlSchema(2048);

export const articleTagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Tag must be lowercase words joined by hyphens")
  .min(2)
  .max(MAX_TAG_LENGTH);

const blockText = z.string().trim().min(1).max(MAX_BLOCK_TEXT_LENGTH);

const paragraphBlockSchema = z
  .object({ type: z.literal("paragraph"), text: blockText })
  .strict();

const headingBlockSchema = z
  .object({ type: z.literal("heading"), text: blockText.max(180) })
  .strict();

const quoteBlockSchema = z
  .object({
    type: z.literal("quote"),
    text: blockText,
    attribution: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

const listBlockSchema = z
  .object({
    type: z.literal("list"),
    items: z
      .array(z.string().trim().min(1).max(MAX_BLOCK_TEXT_LENGTH))
      .min(2)
      .max(MAX_LIST_ITEMS),
  })
  .strict();

export const articleContentBlockSchema = z.union([
  paragraphBlockSchema,
  headingBlockSchema,
  quoteBlockSchema,
  listBlockSchema,
]);

export type ArticleContentBlockInput = z.infer<typeof articleContentBlockSchema>;

// Optional game association: omitted/null = platform-wide. When present it
// must be the supported catalogue key (bgmi today — P4 seeds no additional
// titles); planned titles are rejected here, never silently accepted.
const gameAssociationSchema = z.literal("bgmi").nullish();

// Publishing draft base (strict, NO refinements here): Zod v4 forbids
// .omit() after .refine(), so cross-field rules are applied separately to
// the draft and update schemas below (same pattern as tournaments).
const articleDraftBase = z
  .object({
    slug: articleSlugSchema,
    headline: z.string().trim().min(2, "Headline is required").max(MAX_HEADLINE_LENGTH),
    summary: z.string().trim().min(2, "Summary is required").max(MAX_SUMMARY_LENGTH),
    category: z.enum(ARTICLE_CATEGORIES),
    gameKey: gameAssociationSchema,
    tags: z.array(articleTagSchema).max(MAX_TAGS).optional(),
    heroImageUrl: heroImageUrlSchema.optional(),
    heroImageAlt: z.string().trim().min(2).max(180).optional(),
    authorDisplayName: z.string().trim().min(2).max(MAX_AUTHOR_NAME_LENGTH),
    body: z.array(articleContentBlockSchema).min(1).max(MAX_CONTENT_BLOCKS),
    sourceKind: z.enum(["original", "sourced"]),
    sourceName: z.string().trim().min(2).max(MAX_SOURCE_NAME_LENGTH).optional(),
    sourceUrl: articleSourceUrlSchema.optional(),
    lifecycle: z.enum(ARTICLE_LIFECYCLE_STATES),
    scheduledFor: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

function heroAltRefinement(value: {
  heroImageUrl?: string | undefined;
  heroImageAlt?: string | undefined;
}): boolean {
  return value.heroImageUrl === undefined || value.heroImageAlt !== undefined;
}

function sourcedRefinement(value: {
  sourceKind: string;
  sourceName?: string | undefined;
  sourceUrl?: string | undefined;
}): boolean {
  return (
    value.sourceKind === "original" ||
    (value.sourceName !== undefined && value.sourceUrl !== undefined)
  );
}

const HERO_ALT_RULE = {
  message: "Hero image requires alt text",
  path: ["heroImageAlt"] as string[],
};

const SOURCED_RULE = {
  message: "Sourced stories require a source name and URL",
  path: ["sourceUrl"] as string[],
};

export const articleDraftSchema = articleDraftBase
  .refine(heroAltRefinement, HERO_ALT_RULE)
  .refine(sourcedRefinement, SOURCED_RULE);

export type ArticleDraftInput = z.infer<typeof articleDraftSchema>;

export const articleUpdateSchema = articleDraftBase
  .omit({ slug: true })
  .refine(heroAltRefinement, HERO_ALT_RULE)
  .refine(sourcedRefinement, SOURCED_RULE);

export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;

export const articlePublishSchema = z
  .object({
    slug: articleSlugSchema,
    scheduledFor: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export type ArticlePublishInput = z.infer<typeof articlePublishSchema>;

export const articleUnpublishSchema = z
  .object({
    slug: articleSlugSchema,
    reason: z.string().trim().min(10).max(500).optional(),
  })
  .strict();

export type ArticleUnpublishInput = z.infer<typeof articleUnpublishSchema>;

// Directory input for the PROPOSED RPC pair (shape-only; supported-game
// membership is enforced at the reader for known games).
export const searchArticlesInputSchema = z
  .object({
    game: gameKeySchema.optional(),
    category: z.enum(ARTICLE_CATEGORIES).optional(),
    query: z.string().trim().min(1).max(120).optional(),
    tag: articleTagSchema.optional(),
    limit: z.number().int().min(1).max(60).default(24),
    offset: z.number().int().min(0).max(1000).default(0),
  })
  .strict();

export type SearchArticlesInput = z.infer<typeof searchArticlesInputSchema>;

export const getArticleBySlugInputSchema = z.object({
  slug: articleSlugSchema,
});

export type GetArticleBySlugInput = z.infer<typeof getArticleBySlugInputSchema>;
