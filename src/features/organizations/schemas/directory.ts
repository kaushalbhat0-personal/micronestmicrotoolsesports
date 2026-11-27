// P8 organization Zod boundaries (route/reader input only — no writes).
// Mirrors the PROPOSED `search_organizations(text, text, text, text, integer,
// integer)` contract (no migration exists): shape-only filters; per-game
// vocabulary allowlists are enforced at the reader layer for known games,
// with unknown values failing closed to zero rows. limit 1..60 and offset
// 0..1000 match the D1/P1 remediated SQL clamps; the route uses a frozen
// page size inside those bounds. Slug shape is lowercase hyphen-joined 2..60.

import { z } from "zod";
import { gameKeySchema } from "@/features/player-profile/schemas/game";
import { ORG_TYPES } from "../domain/org-type";

export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words joined by hyphens")
  .min(2)
  .max(60);

export const searchOrganizationsInputSchema = z
  .object({
    game: gameKeySchema.optional(),
    region: z.string().trim().min(1).max(48).optional(),
    orgType: z.enum(ORG_TYPES).optional(),
    query: z.string().trim().min(1).max(120).optional(),
    limit: z.number().int().min(1).max(60).default(24),
    offset: z.number().int().min(0).max(1000).default(0),
  })
  .strict();

export type SearchOrganizationsInput = z.infer<typeof searchOrganizationsInputSchema>;

export const getOrganizationBySlugInputSchema = z.object({
  slug: organizationSlugSchema,
});

export type GetOrganizationBySlugInput = z.infer<typeof getOrganizationBySlugInputSchema>;
