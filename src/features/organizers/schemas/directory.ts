// P9 organizer directory schemas — shape-only filters for the PROPOSED
// RPC pair `search_organizers` / `get_organizer_by_slug`. Per-game region
// vocabulary is enforced at the reader for known games (BGMI), mirroring
// the P1/P3/P8 posture. Unknown games pass through to zero rows.

import { z } from "zod";
import { gameKeySchema } from "@/features/player-profile/schemas/game";
import { ORGANIZER_TYPES } from "../domain/organizer-type";

export const organizerSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words joined by hyphens")
  .min(2)
  .max(80);

export const searchOrganizersInputSchema = z
  .object({
    game: gameKeySchema.optional(),
    region: z.string().trim().min(1).max(48).optional(),
    organizerType: z.enum(ORGANIZER_TYPES).optional(),
    query: z.string().trim().min(1).max(120).optional(),
    limit: z.number().int().min(1).max(60).default(24),
    offset: z.number().int().min(0).max(1000).default(0),
  })
  .strict();

export type SearchOrganizersInput = z.infer<typeof searchOrganizersInputSchema>;

export const getOrganizerBySlugInputSchema = z.object({
  slug: organizerSlugSchema,
});

export type GetOrganizerBySlugInput = z.infer<typeof getOrganizerBySlugInputSchema>;
