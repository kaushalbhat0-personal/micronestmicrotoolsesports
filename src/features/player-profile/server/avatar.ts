// Avatar storage flows (G1-5).
// Authoritative: 06 storage design (existing `public-avatars` bucket, no new
// buckets/policies), 05 section 1 (avatar_path CHECK), 07 sections 1/3/5,
// 11 section 3 (D-G1-01/D-G1-02), D-G1-06 Option A (canonicalize jpeg→jpg,
// recorded in the G1-5 report; no product approval required per 10, no
// migration).
//
// Security posture (frozen):
// - Server-side only. Call sites must hold the AUTHENTICATED OWNER client
//   (never service-role, never the browser client). No service-role import,
//   no `next/headers` import (call-site injects the owner client).
// - Identity comes EXCLUSIVELY from the verified session
//   (`client.auth.getUser()`). These functions accept NO user ID argument and
//   NO caller-supplied storage path, so a caller cannot target another user's
//   prefix. The canonical path is derived as `{sessionUid}/avatar.{ext}`.
// - Validation before any write: MIME allowlist (png/jpeg/webp, never SVG),
//   size 1..512 KB, non-empty bytes. Extension is canonical per MIME
//   (image/jpeg → `avatar.jpg`). Arbitrary external URLs can never enter
//   `avatar_path` (Zod + DB CHECK only accept uid-scoped relative paths).
// - Stable paths, never signed URLs: the DB stores the relative object path;
//   public reads use `getPublicUrl` (offline building). No
//   `createSignedUrl` for public avatars. `private-verification` is never
//   touched here.
// - Ordering (06 section 5, storage and DB are not transactional):
//   upload = storage upsert first, then DB `avatar_path` update; on storage
//   failure abort before the DB write (no dangling pointer). Removal =
//   storage delete first, then DB NULL; on storage failure abort the NULL
//   write (no stale public URL... the row still points at a live object and
//   the caller retries).
// - Replacement with an extension change deletes the stale extension object
//   (single live file per user). Deletion removes all canonical variants by
//   exact path (no broad prefix deletes, no bucket listing).
// - Errors are generic domain errors (never raw PostgREST/storage detail).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  AvatarOperationError,
  AvatarValidationError,
} from "../domain/avatar";
import type { PlayerProfile } from "../domain/player-profile";
import { ProfileNotFoundError } from "../domain/player-profile";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  canonicalAvatarPathForMime,
  isAvatarMime,
} from "../schemas/avatar";
import { ensureAppUser } from "./ensure-app-user";

const PLAYER_PROFILE_COLUMNS =
  "user_id,handle,display_name,avatar_path,bio,country_code,is_discoverable,handle_changed_at,created_at,updated_at";

interface PlayerProfileRow {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  country_code: string | null;
  is_discoverable: boolean;
  handle_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvatarUploadInput {
  bytes: Uint8Array;
  mimeType: string;
}

function toPlayerProfile(row: PlayerProfileRow): PlayerProfile {
  return {
    user_id: row.user_id,
    handle: row.handle,
    display_name: row.display_name,
    avatar_path: row.avatar_path,
    bio: row.bio,
    country_code: row.country_code,
    is_discoverable: row.is_discoverable,
    handle_changed_at: row.handle_changed_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateUploadInput(input: unknown): {
  bytes: Uint8Array;
  mimeType: string;
} {
  if (typeof input !== "object" || input === null) {
    throw new AvatarValidationError();
  }
  const { bytes, mimeType } = input as {
    bytes?: unknown;
    mimeType?: unknown;
  };
  if (!(bytes instanceof Uint8Array)) {
    throw new AvatarValidationError();
  }
  if (typeof mimeType !== "string" || !isAvatarMime(mimeType)) {
    throw new AvatarValidationError();
  }
  if (bytes.byteLength < 1 || bytes.byteLength > AVATAR_MAX_BYTES) {
    throw new AvatarValidationError();
  }
  return { bytes, mimeType };
}

// All canonical object paths that may exist for one user (legacy `jpeg`
// included so a stale pre-canonicalization object can be swept by exact
// path; new writes never create `jpeg`).
function allAvatarPathsForUser(userId: string): string[] {
  return [
    `${userId}/avatar.png`,
    `${userId}/avatar.jpg`,
    `${userId}/avatar.jpeg`,
    `${userId}/avatar.webp`,
  ];
}

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

// Upload (or replace) the caller's avatar (D-G1-06 Option A canonical path).
// Session-derived identity only; no target UID, no caller path.
export async function uploadAvatar(
  client: SupabaseClient,
  input: unknown,
): Promise<PlayerProfile> {
  const { bytes, mimeType } = validateUploadInput(input);

  const userId = await getSessionUserId(client);
  await ensureAppUser(client);

  const canonicalPath = canonicalAvatarPathForMime(userId, mimeType);
  if (canonicalPath === null) {
    throw new AvatarValidationError();
  }

  // Current row: needed to detect an extension change and to fail closed
  // when the caller has no canonical profile yet (never auto-creates).
  const { data: currentData, error: currentError } = await client
    .from("player_profiles")
    .select(PLAYER_PROFILE_COLUMNS)
    .eq("user_id", userId);
  if (currentError) {
    throw new AvatarOperationError();
  }
  const currentRows = (currentData ?? []) as PlayerProfileRow[];
  if (currentRows.length !== 1) {
    throw new ProfileNotFoundError();
  }
  const current = currentRows[0] as PlayerProfileRow;
  if (current.user_id !== userId) {
    throw new AvatarOperationError();
  }
  const previousPath =
    typeof current.avatar_path === "string" ? current.avatar_path : null;

  // Storage first (06 section 5). Upsert to the canonical path so retries
  // are idempotent and replacement never fans out.
  const { error: uploadError } = await client.storage
    .from(AVATAR_BUCKET)
    .upload(canonicalPath, bytes, {
      upsert: true,
      contentType: mimeType,
    });
  if (uploadError) {
    const message = String(
      (uploadError as { message?: unknown }).message ?? "",
    ).toLowerCase();
    if (
      message.includes("mime") ||
      message.includes("size") ||
      message.includes("too large") ||
      message.includes("limit")
    ) {
      throw new AvatarValidationError();
    }
    throw new AvatarOperationError();
  }

  // Extension change: delete the stale object by exact path (no listing, no
  // broad prefix delete). Best-effort after the new object is live: a
  // delete failure must not roll back a good upload (orphan ≤1 file, swept
  // by the next replace/remove).
  if (previousPath !== null && previousPath !== canonicalPath) {
    await client.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  const { data, error } = await client
    .from("player_profiles")
    .update({ avatar_path: canonicalPath })
    .eq("user_id", userId)
    .select(PLAYER_PROFILE_COLUMNS);
  if (error) {
    const code = (error as { code?: unknown }).code;
    if (code === "23514") {
      throw new AvatarValidationError();
    }
    throw new AvatarOperationError();
  }
  const rows = (data ?? []) as PlayerProfileRow[];
  if (rows.length !== 1) {
    try {
      await ensureAppUser(client);
    } catch (e: unknown) {
      if (e instanceof SuspendedError) {
        throw e;
      }
    }
    throw new ProfileNotFoundError();
  }
  const row = rows[0] as PlayerProfileRow;
  if (row.user_id !== userId) {
    throw new AvatarOperationError();
  }
  if (row.avatar_path !== canonicalPath) {
    throw new AvatarOperationError();
  }
  return toPlayerProfile(row);
}

// Remove the caller's avatar: storage deletes first, then `avatar_path`
// is nulled, so the next directory response carries NULL (no stale URL).
// Idempotent when no avatar is set.
export async function removeAvatar(
  client: SupabaseClient,
): Promise<PlayerProfile> {
  const userId = await getSessionUserId(client);
  await ensureAppUser(client);

  const { data: currentData, error: currentError } = await client
    .from("player_profiles")
    .select(PLAYER_PROFILE_COLUMNS)
    .eq("user_id", userId);
  if (currentError) {
    throw new AvatarOperationError();
  }
  const currentRows = (currentData ?? []) as PlayerProfileRow[];
  if (currentRows.length !== 1) {
    throw new ProfileNotFoundError();
  }
  const current = currentRows[0] as PlayerProfileRow;
  if (current.user_id !== userId) {
    throw new AvatarOperationError();
  }
  if (current.avatar_path === null) {
    return toPlayerProfile(current);
  }

  // Exact-path deletes only (current path + any stale canonical variant).
  // No bucket listing, no prefix sweep.
  const targets = Array.from(
    new Set([current.avatar_path, ...allAvatarPathsForUser(userId)]),
  );
  const { error: removeError } = await client.storage
    .from(AVATAR_BUCKET)
    .remove(targets);
  if (removeError) {
    throw new AvatarOperationError();
  }

  const { data, error } = await client
    .from("player_profiles")
    .update({ avatar_path: null })
    .eq("user_id", userId)
    .select(PLAYER_PROFILE_COLUMNS);
  if (error) {
    throw new AvatarOperationError();
  }
  const rows = (data ?? []) as PlayerProfileRow[];
  if (rows.length !== 1) {
    try {
      await ensureAppUser(client);
    } catch (e: unknown) {
      if (e instanceof SuspendedError) {
        throw e;
      }
    }
    throw new ProfileNotFoundError();
  }
  const row = rows[0] as PlayerProfileRow;
  if (row.user_id !== userId) {
    throw new AvatarOperationError();
  }
  if (row.avatar_path !== null) {
    throw new AvatarOperationError();
  }
  return toPlayerProfile(row);
}
