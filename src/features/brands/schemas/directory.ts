// P8 brand Zod boundaries (route/reader input only — no writes).
// Mirrors the PROPOSED `search_brands` contract (no migration exists):
// shape-only filters; per-game vocabulary enforced at the reader for known
// games, unknown values failing closed. limit 1..60, offset 0..1000.

import { z } from "zod";
import { gameKeySchema } from "@/features/player-profile/schemas/game";
import {
  BRAND_INDUSTRIES,
  PARTNERSHIP_TYPES,
  SPONSORSHIP_INTERESTS,
} from "../domain/vocabulary";

export const brandSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words joined by hyphens")
  .min(2)
  .max(60);

export const searchBrandsInputSchema = z
  .object({
    gameInterest: gameKeySchema.optional(),
    industry: z.enum(BRAND_INDUSTRIES).optional(),
    region: z.string().trim().min(1).max(48).optional(),
    interest: z.enum(SPONSORSHIP_INTERESTS).optional(),
    partnership: z.enum(PARTNERSHIP_TYPES).optional(),
    query: z.string().trim().min(1).max(120).optional(),
    limit: z.number().int().min(1).max(60).default(24),
    offset: z.number().int().min(0).max(1000).default(0),
  })
  .strict();

export type SearchBrandsInput = z.infer<typeof searchBrandsInputSchema>;

export const getBrandBySlugInputSchema = z.object({
  slug: brandSlugSchema,
});

export type GetBrandBySlugInput = z.infer<typeof getBrandBySlugInputSchema>;
