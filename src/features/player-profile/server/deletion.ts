// Owner deletion operations (G1-7).
// Authoritative: D-G1-07 Option A (approved 2026-11-11: hard delete after
// explicit confirmation; game-profile removal + canonical-profile deletion
// only; whole-account deletion excluded), 04 section 7, 05 (owner DELETE
// policies/grants + cascade), 06 section 5 (storage-first ordering).
//
// Security posture:
// - Server-side only. Call sites must hold the AUTHENTICATED OWNER client
//   (never service-role, never the browser client). No service-role import,
//   no `next/headers` import (call-site injects the owner client). Explicit
//   UI confirmation happens at the call site; these functions perform the
//   authorized mutation only.
// - Identity comes EXCLUSIVELY from the verified session
//   (`client.auth.getUser()`). Both functions accept NO user ID argument.
//   Deletes are scoped by exact equality (user_id / player_user_id +
//   game_key); no broad selectors, no prefix sweeps.
// - removeGameProfile deletes ONE owned game row only: never the canonical
//   profile, never other game rows, never the catalogue entry.
// - deletePlayerProfile deletes the canonical row; associated game rows go
//   through the approved FK cascade. It preserves app_users, the Auth
//   identity, catalogue rows and all other users' data. The handle becomes
//   immediately reusable (unique row gone).
// - Storage ordering: owned avatar objects are deleted FIRST (exact owned
//   paths only: current avatar_path + canonical variants for the session
//   UID). On storage failure the DB delete is aborted and a safe,
//   retryable ProfileDeletionError surfaces (never a false success). If the
//   DB delete fails after storage, the next retry re-runs the same bounded
//   exact-path cleanup — no global sweeper, no orphan beyond one retry.
// - Suspended accounts cannot delete through this path (active-gated RLS +
//   ensureAppUser gate, mapped to SuspendedError). Reactivation restores the
//   normal path; administrative deletion while suspended is service-role only.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  GameProfileNotFoundError,
  GameProfileOperationError,
} from "../domain/game-profile";
import {
  ProfileDeletionError,
  ProfileNotFoundError,
  ProfileOperationError,
} from "../domain/player-profile";
import { AVATAR_BUCKET } from "../schemas/avatar";
import { gameKeySchema } from "../schemas/game";
import { ensureAppUser } from "./ensure-app-user";

async function getSessionUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }
  return user.id;
}

function allAvatarPathsForUser(userId: string): string[] {
  return [
    `${userId}/avatar.png`,
    `${userId}/avatar.jpg`,
    `${userId}/avatar.jpeg`,
    `${userId}/avatar.webp`,
  ];
}

// Remove ONE owned game-specific profile (07 removeGameProfile). When the
// deleted row is the last game profile, the canonical profile remains and
// becomes incomplete under D-G1-08 (derived helper, no flag write).
export async function removeGameProfile(
  client: SupabaseClient,
  gameKey: unknown,
): Promise<{ game_key: string }> {
  const parsedKey = gameKeySchema.parse(gameKey);
  const userId = await getSessionUserId(client);
  await ensureAppUser(client);

  const { data, error } = await client
    .from("player_game_profiles")
    .delete()
    .eq("player_user_id", userId)
    .eq("game_key", parsedKey)
    .select("game_key");

  if (error) {
    throw new GameProfileOperationError();
  }
  const rows = (data ?? []) as Array<{ game_key: string }>;
  if (rows.length === 0) {
    try {
      await ensureAppUser(client);
    } catch (e: unknown) {
      if (e instanceof SuspendedError) {
        throw e;
      }
    }
    throw new GameProfileNotFoundError();
  }
  if (rows.length !== 1 || rows[0]?.game_key !== parsedKey) {
    throw new GameProfileOperationError();
  }
  return { game_key: parsedKey };
}

// Delete the caller's canonical player profile and all associated game
// profiles (07 deletePlayerProfile). This is NOT account deletion:
// app_users and the Auth identity survive. UI must confirm explicitly
// (including a stronger step for this operation) before calling.
export async function deletePlayerProfile(
  client: SupabaseClient,
): Promise<void> {
  const userId = await getSessionUserId(client);
  await ensureAppUser(client);

  // Canonical row first (read-only): needed for the exact avatar cleanup
  // set and to fail closed when no profile exists.
  const { data: currentData, error: currentError } = await client
    .from("player_profiles")
    .select("user_id,avatar_path")
    .eq("user_id", userId);
  if (currentError) {
    throw new ProfileOperationError();
  }
  const currentRows = (currentData ?? []) as Array<{
    user_id: string;
    avatar_path: string | null;
  }>;
  if (currentRows.length === 0) {
    throw new ProfileNotFoundError();
  }
  if (currentRows.length !== 1 || currentRows[0]?.user_id !== userId) {
    throw new ProfileOperationError();
  }
  const current = currentRows[0] as {
    user_id: string;
    avatar_path: string | null;
  };

  // Storage first (06 section 5): exact owned paths only. Abort the DB
  // delete on failure so success is never falsely reported.
  if (current.avatar_path !== null) {
    const targets = Array.from(
      new Set([current.avatar_path, ...allAvatarPathsForUser(userId)]),
    );
    const { error: removeError } = await client.storage
      .from(AVATAR_BUCKET)
      .remove(targets);
    if (removeError) {
      throw new ProfileDeletionError();
    }
  }

  // Database second: the canonical delete cascades owned game profiles.
  // app_users, Auth identity, catalogue rows and other users are untouched.
  const { data, error } = await client
    .from("player_profiles")
    .delete()
    .eq("user_id", userId)
    .select("user_id");
  if (error) {
    throw new ProfileOperationError();
  }
  const rows = (data ?? []) as Array<{ user_id: string }>;
  if (rows.length === 0) {
    try {
      await ensureAppUser(client);
    } catch (e: unknown) {
      if (e instanceof SuspendedError) {
        throw e;
      }
    }
    throw new ProfileNotFoundError();
  }
  if (rows.length !== 1 || rows[0]?.user_id !== userId) {
    throw new ProfileOperationError();
  }
}
