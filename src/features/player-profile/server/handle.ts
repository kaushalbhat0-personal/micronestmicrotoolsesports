// Dedicated owner handle-change operation (G1-7).
// Authoritative: D-G1-05 Option A (approved 2026-11-11: ~30-day cooldown,
// case-insensitive uniqueness, existing normalization, no generic-patch
// mutation, no permanent audit history), 05 (handle_changed_at persistence +
// update_player_handle DEFINER + column-grant bypass closure), 07 updateHandle.
//
// Security posture:
// - Server-side only. Call sites must hold the AUTHENTICATED OWNER client
//   (never service-role, never the browser client). No service-role import,
//   no `next/headers` import (call-site injects the owner client).
// - Identity comes EXCLUSIVELY from the verified session
//   (`client.auth.getUser()`); this function accepts NO user ID argument and
//   the DEFINER function binds auth.uid() internally.
// - `handle` is writable ONLY through public.update_player_handle (direct
//   PostgREST UPDATE of handle is denied at the column-grant layer even
//   though the RLS row predicate would match). updatePlayerProfile still
//   rejects `handle` via Zod .strict().
// - Cooldown is enforced atomically inside the DEFINER function (row lock +
//   timestamp check + update in one transaction): only a successful change
//   sets handle_changed_at; validation/collision failures leave it intact;
//   concurrent attempts serialize on FOR UPDATE. A same-value no-op returns
//   the row without advancing the cooldown.
// - Suspended accounts cannot change handle (mapped to SuspendedError).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  HandleCooldownError,
  HandleTakenError,
  ProfileNotFoundError,
  ProfileOperationError,
  ProfileValidationError,
  type PlayerProfile,
} from "../domain/player-profile";
import { handleInputSchema } from "../schemas/handle";
import { ensureAppUser } from "./ensure-app-user";

interface HandleRow {
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

interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

function isPostgrestError(value: unknown): value is PostgrestErrorLike {
  return (
    typeof value === "object" &&
    value !== null &&
    ("code" in value || "message" in value)
  );
}

function toPlayerProfile(row: HandleRow): PlayerProfile {
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

function toCooldownError(error: PostgrestErrorLike): HandleCooldownError {
  const message = String(error.message ?? "");
  const marker = "HANDLE_COOLDOWN:";
  const index = message.indexOf(marker);
  if (index >= 0) {
    const eligible = message.slice(index + marker.length).trim();
    if (eligible.length > 0) {
      return new HandleCooldownError(eligible);
    }
  }
  return new HandleCooldownError(null);
}

// Change the caller's own handle (07 updateHandle). Normalization
// (trim/lowercase) happens at the Zod boundary and again SQL-side; the
// UNIQUE lower(handle) index keeps collisions case-insensitive.
export async function updateHandle(
  client: SupabaseClient,
  input: unknown,
): Promise<PlayerProfile> {
  const parsed = handleInputSchema.parse(input);

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }

  await ensureAppUser(client);

  const { data, error } = await client.rpc("update_player_handle", {
    p_handle: parsed.handle,
  });

  if (error) {
    if (isPostgrestError(error)) {
      if (error.code === "P0001") {
        throw toCooldownError(error);
      }
      if (error.code === "23505") {
        throw new HandleTakenError();
      }
      if (error.code === "22000") {
        throw new ProfileValidationError();
      }
      if (error.code === "28000") {
        const message = String(error.message ?? "").toLowerCase();
        if (message.includes("not authenticated")) {
          throw new UnauthenticatedError();
        }
        throw new SuspendedError();
      }
      if (error.code === "02000") {
        try {
          await ensureAppUser(client);
        } catch (e: unknown) {
          if (e instanceof SuspendedError) {
            throw e;
          }
        }
        throw new ProfileNotFoundError();
      }
    }
    throw new ProfileOperationError();
  }

  const rows = (data ?? []) as HandleRow[];
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
  if (rows.length !== 1) {
    throw new ProfileOperationError();
  }
  const row = rows[0] as HandleRow;
  if (row.user_id !== user.id) {
    throw new ProfileOperationError();
  }
  return toPlayerProfile(row);
}

// Read the caller's handle cooldown state for owner guidance (no write).
// Returns the current handle, the last-change marker and the next eligible
// change time (null when currently eligible).
export async function getHandleChangeState(
  client: SupabaseClient,
): Promise<{
  handle: string;
  handleChangedAt: string | null;
  nextEligibleAt: string | null;
}> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }
  const { data, error } = await client
    .from("player_profiles")
    .select("handle,handle_changed_at")
    .eq("user_id", user.id);
  if (error) {
    throw new ProfileOperationError();
  }
  const rows = (data ?? []) as Array<{
    handle: string;
    handle_changed_at: string | null;
  }>;
  if (rows.length === 0) {
    throw new ProfileNotFoundError();
  }
  if (rows.length !== 1 || typeof rows[0]?.handle !== "string") {
    throw new ProfileOperationError();
  }
  const row = rows[0] as { handle: string; handle_changed_at: string | null };
  const changedAt = row.handle_changed_at ?? null;
  if (changedAt === null) {
    return { handle: row.handle, handleChangedAt: null, nextEligibleAt: null };
  }
  const eligibleMs = Date.parse(changedAt) + 30 * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(eligibleMs) || eligibleMs <= Date.now()) {
    return { handle: row.handle, handleChangedAt: changedAt, nextEligibleAt: null };
  }
  return {
    handle: row.handle,
    handleChangedAt: changedAt,
    nextEligibleAt: new Date(eligibleMs).toISOString(),
  };
}
