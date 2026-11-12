import { z } from "zod";
import {
  availabilitySchema,
  bgmiPlayModesSchema,
  bgmiPrimaryRoleSchema,
  gameKeySchema,
  gameUserIdSchema,
  ignSchema,
  validateGameRegion,
} from "./game";

// Authoritative: 07 upsertGameProfile + 08 T4 (mass assignment) + D-G1-09.
// Game-profile creation input. Explicit allowlist ONLY:
//   game_key, ign, game_user_id?, primary_role?, play_modes?,
//   region_code?, availability?, is_visible?
// Rejected by .strict(): player_user_id / id / status / timestamps /
// administrative flags (never client-writable; identity is session-derived).
//
// region_code is validated against the vocabulary of the given game_key
// (D-G1-09); a region for an unknown game is rejected (fail closed — the
// catalogue, enforced by FK, is the authority for game membership).
// play_modes/primary_role mirror the currently frozen BGMI vocabulary;
// future titles arrive with a catalogue migration widening Zod + CHECK
// together (03 section 7). availability stays shape-only: its value
// vocabulary was never frozen (03 section 3 cites examples only).

const nullableRegion = z.string().trim().toLowerCase().min(1).max(48).nullable().optional();

export const createGameProfileInputSchema = z
  .object({
    game_key: gameKeySchema,
    ign: ignSchema,
    game_user_id: gameUserIdSchema,
    primary_role: bgmiPrimaryRoleSchema.nullable().optional(),
    play_modes: bgmiPlayModesSchema.optional(),
    region_code: nullableRegion,
    availability: availabilitySchema.optional(),
    is_visible: z.boolean().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.region_code !== undefined && v.region_code !== null) {
      if (!validateGameRegion(v.game_key, v.region_code)) {
        ctx.addIssue({
          code: "custom",
          path: ["region_code"],
          message: "region not in this game's vocabulary",
        });
      }
    }
  });

export type CreateGameProfileInput = z.infer<
  typeof createGameProfileInputSchema
>;

// Owner-only generic patch (07; removeGameProfile is a separate G1-7 flow).
// game_key identifies the row (selector, not patchable); id /
// player_user_id are rejected here (dedicated flows own identity changes,
// of which there are none — ownership is immutable).
export const updateGameProfileInputSchema = z
  .object({
    ign: ignSchema.optional(),
    game_user_id: gameUserIdSchema.nullable().optional(),
    primary_role: bgmiPrimaryRoleSchema.nullable().optional(),
    play_modes: bgmiPlayModesSchema.optional(),
    region_code: nullableRegion,
    availability: availabilitySchema.optional(),
    is_visible: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "no fields to update");

export type UpdateGameProfileInput = z.infer<
  typeof updateGameProfileInputSchema
>;

// Region validation bound to an already-selected game key (update path:
// the row's game_key is the selector). Unknown games fail closed.
export function isRegionAllowedForGame(
  gameKey: string,
  regionCode: string,
): boolean {
  return validateGameRegion(gameKey, regionCode);
}

// Explicit per-game visibility toggle input (G1-7 consent controls).
// game_key stays the row selector (parsed separately); only is_visible is
// patchable here. Rejected by .strict(): every sibling game-profile field.
export const setGameVisibilityInputSchema = z
  .object({ is_visible: z.boolean() })
  .strict();

export type SetGameVisibilityInput = z.infer<
  typeof setGameVisibilityInputSchema
>;
