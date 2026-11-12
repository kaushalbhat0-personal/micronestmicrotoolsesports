// P1 team-directory Zod boundaries (route/reader input only — no writes).
// Mirrors the D1 `search_teams(text, text, text, integer, integer)` contract
// (local, UNAPPLIED): game/region/query are shape-only here; per-game
// vocabulary allowlists are enforced at the reader layer (known games) and
// SQL-side, with unknown values failing closed to zero rows. limit 1..60 and
// offset 0..1000 match the remediated SQL clamps (000003 §H); the route uses
// a frozen page size inside those bounds. Slug shape reuses the team slug
// contract (lowercase hyphen-joined, 2..60).

import { z } from "zod";
import { gameKeySchema } from "@/features/player-profile/schemas/game";
import { teamSlugSchema } from "./team";

export const searchTeamsInputSchema = z
  .object({
    game: gameKeySchema.optional(),
    region: z.string().trim().min(1).max(48).optional(),
    query: z.string().trim().min(1).max(120).optional(),
    limit: z.number().int().min(1).max(60).default(24),
    offset: z.number().int().min(0).max(1000).default(0),
  })
  .strict();

export type SearchTeamsInput = z.infer<typeof searchTeamsInputSchema>;

export const getTeamBySlugInputSchema = z.object({
  slug: teamSlugSchema,
});

export type GetTeamBySlugInput = z.infer<typeof getTeamBySlugInputSchema>;
