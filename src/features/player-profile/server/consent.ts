// Owner discoverability consent operations (G1-7).
// Authoritative: 04 section 2 (consent toggles + approved copy), 05 (column
// grants + set_player_discoverability DEFINER), 07 setDiscoverability,
// D-G1-05/D-G1-07/D-G1-08 approvals 2026-11-11.
//
// Security posture:
// - Server-side only. Call sites must hold the AUTHENTICATED OWNER client
//   (never service-role, never the browser client). No service-role import,
//   no `next/headers` import (call-site injects the owner client).
// - Identity comes EXCLUSIVELY from the verified session
//   (`client.auth.getUser()`); these functions accept NO user ID argument.
// - The flag is writable ONLY through the narrow DEFINER function
//   public.set_player_discoverability (column-level grants deny direct
//   PostgREST writes to is_discoverable). Generic updatePlayerProfile still
//   rejects the flag via Zod .strict().
// - Suspended accounts cannot change consent through this path (function
//   raises, mapped to SuspendedError). Suspension already suppresses public
//   rows via the RPC status predicate, so no private row leaks while
//   suspended; reactivation restores the prior stored value. Administrative
//   changes while suspended use the authorized service-role boundary only.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  ProfileNotFoundError,
  ProfileOperationError,
  ProfileValidationError,
  type PlayerProfile,
} from "../domain/player-profile";
import { setDiscoverabilityInputSchema } from "../schemas/discoverability";
import { ensureAppUser } from "./ensure-app-user";

interface ConsentRow {
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

function toPlayerProfile(row: ConsentRow): PlayerProfile {
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

// Read the caller's current discoverability state (07 consent read).
// Read-only: never creates rows, never touches other users.
export async function getDiscoverabilityState(
  client: SupabaseClient,
): Promise<{ is_discoverable: boolean }> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }
  const { data, error } = await client
    .from("player_profiles")
    .select("is_discoverable")
    .eq("user_id", user.id);
  if (error) {
    throw new ProfileOperationError();
  }
  const rows = (data ?? []) as Array<{ is_discoverable: boolean }>;
  if (rows.length === 0) {
    throw new ProfileNotFoundError();
  }
  if (rows.length !== 1 || typeof rows[0]?.is_discoverable !== "boolean") {
    throw new ProfileOperationError();
  }
  const row = rows[0] as { is_discoverable: boolean };
  return { is_discoverable: row.is_discoverable };
}

// Explicit consent toggle (07 setDiscoverability). Input is a strict
// { is_discoverable: boolean }; revocation is immediate at query time (the
// next public RPC call excludes the row — no cache is the final boundary).
export async function setDiscoverability(
  client: SupabaseClient,
  input: unknown,
): Promise<PlayerProfile> {
  const parsed = setDiscoverabilityInputSchema.parse(input);

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }

  await ensureAppUser(client);

  const { data, error } = await client.rpc("set_player_discoverability", {
    p_value: parsed.is_discoverable,
  });

  if (error) {
    if (isPostgrestError(error)) {
      if (error.code === "28000") {
        const message = String(error.message ?? "").toLowerCase();
        if (message.includes("not authenticated")) {
          throw new UnauthenticatedError();
        }
        throw new SuspendedError();
      }
      if (error.code === "22000") {
        throw new ProfileValidationError();
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

  const rows = (data ?? []) as ConsentRow[];
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
  const row = rows[0] as ConsentRow;
  if (row.user_id !== user.id) {
    throw new ProfileOperationError();
  }
  return toPlayerProfile(row);
}
