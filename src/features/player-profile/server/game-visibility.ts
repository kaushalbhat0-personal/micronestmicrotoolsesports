// Owner per-game visibility operations (G1-7).
// Authoritative: 04 section 2 (per-game is_visible + effective AND rule),
// 07 updateGameProfile, D-G1-07 approvals 2026-11-11 (consent remains
// reversible, game visibility independently manageable).
//
// Security posture: session-derived identity only (delegates to
// updateGameProfile, which binds player_user_id = auth.uid() and gates on
// active status). Master discoverability off still overrides game visibility
// on at the RPC predicate layer — this helper never implies publication.

import type { SupabaseClient } from "@supabase/supabase-js";
import { UnauthenticatedError } from "../domain/app-user";
import {
  GameProfileOperationError,
  type GameProfile,
} from "../domain/game-profile";
import { gameKeySchema } from "../schemas/game";
import { setGameVisibilityInputSchema } from "../schemas/game-profile";
import { updateGameProfile } from "./game-profile";

// Read the caller's visibility flag for one owned game profile.
// Returns null when the caller has no profile for that game.
export async function getGameVisibility(
  client: SupabaseClient,
  gameKey: unknown,
): Promise<{ game_key: string; is_visible: boolean } | null> {
  const parsedKey = gameKeySchema.parse(gameKey);
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }
  const { data, error } = await client
    .from("player_game_profiles")
    .select("game_key,is_visible")
    .eq("player_user_id", user.id)
    .eq("game_key", parsedKey);
  if (error) {
    throw new GameProfileOperationError();
  }
  const rows = (data ?? []) as Array<{
    game_key: string;
    is_visible: boolean;
  }>;
  if (rows.length === 0) {
    return null;
  }
  if (rows.length !== 1 || typeof rows[0]?.is_visible !== "boolean") {
    throw new GameProfileOperationError();
  }
  const row = rows[0] as { game_key: string; is_visible: boolean };
  if (row.game_key !== parsedKey) {
    throw new GameProfileOperationError();
  }
  return { game_key: row.game_key, is_visible: row.is_visible };
}

// Explicit per-game visibility toggle for one owned game profile.
export async function setGameProfileVisibility(
  client: SupabaseClient,
  gameKey: unknown,
  input: unknown,
): Promise<GameProfile> {
  const parsedKey = gameKeySchema.parse(gameKey);
  const parsed = setGameVisibilityInputSchema.parse(input);
  return updateGameProfile(client, parsedKey, {
    is_visible: parsed.is_visible,
  });
}
