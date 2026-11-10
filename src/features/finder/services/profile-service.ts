import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrThrow } from "@/lib/validation";
import { conflictError, internalError } from "@/lib/errors";
import { myProfileSaveSchema, type MyProfileSaveInput } from "../schemas/finder";
import {
  upsertFinderProfile,
  upsertGameProfile,
  type FinderGameProfileRow,
  type FinderProfileRow,
} from "../repositories/finder";

/**
 * Finder — owner profile writes.
 *
 * userId MUST come from requireUser() at the action boundary, never from
 * caller input. RLS (user_id = auth.uid()) enforces the same invariant
 * at the database layer; Zod is the application-layer contract.
 */

export interface SaveMyProfileResult {
  profile: FinderProfileRow;
  gameProfile: FinderGameProfileRow;
}

function isHandleConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "23505" &&
    typeof record.message === "string" &&
    record.message.includes("finder_profiles_handle_unique")
  );
}

function isGameCharacterConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "23505" &&
    typeof record.message === "string" &&
    record.message.includes("finder_game_profiles_game_character_unique")
  );
}

export async function saveMyProfile(
  supabase: SupabaseClient,
  userId: string,
  raw: unknown,
): Promise<SaveMyProfileResult> {
  const input: MyProfileSaveInput = parseOrThrow(myProfileSaveSchema, raw);

  let profile: FinderProfileRow;
  try {
    profile = await upsertFinderProfile(supabase, userId, {
      handle: input.profile.handle,
      display_name: input.profile.display_name,
      avatar_url: null,
      region: input.profile.region,
      languages: input.profile.languages,
      timezone: input.profile.timezone ?? null,
      current_level: input.profile.current_level,
      target_level: input.profile.target_level,
      primary_role: input.profile.primary_role,
      secondary_roles: input.profile.secondary_roles,
      availability: input.profile.availability,
      looking_for: input.profile.looking_for,
      open_to_tryout: input.profile.open_to_tryout,
      bio: input.profile.bio ?? null,
      allow_indexing: input.profile.allow_indexing,
    });
  } catch (error) {
    if (isHandleConflict(error)) {
      throw conflictError("This handle is already taken. Try another one.");
    }
    throw internalError();
  }

  let gameProfile: FinderGameProfileRow;
  try {
    gameProfile = await upsertGameProfile(supabase, userId, {
      game: input.game.game,
      ign: input.game.ign,
      character_id: input.game.character_id,
    });
  } catch (error) {
    if (isGameCharacterConflict(error)) {
      throw conflictError(
        "This Character ID is already linked to another profile. If this is your account, contact support.",
      );
    }
    throw internalError();
  }

  return { profile, gameProfile };
}
