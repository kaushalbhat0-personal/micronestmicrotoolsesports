// Canonical player profile server operations (G1-2).
// Authoritative: 02 sections 2-3, 03 section 1/7, 05 sections 1/3, 07 sections 1/3/5,
//   11 section 3 (D-G1-01/D-G1-02/D-G1-09).
//
// Security posture (frozen):
// - Server-side only. Call sites must be Route Handlers / Server Actions
//   holding the AUTHENTICATED OWNER client (never service-role, never the
//   browser client). No service-role import, no `next/headers` import
//   (call-site injects the owner client).
// - Identity comes EXCLUSIVELY from the verified session
//   (`client.auth.getUser()`). These functions accept NO user ID argument, so
//   a caller-supplied ID from body/query/state cannot override ownership.
// - Creation is atomic: the narrowly scoped SECURITY INVOKER function
//   public.create_player_profile() performs app_users ensure + profile INSERT
//   + re-select in ONE transaction (see migration 20261110000005). INVOKER
//   adds zero privilege: caller RLS still applies, auth.uid() internal.
//   The ensureAppUser() pre-gate is a read-only status check; the
//   recoverable "onboarding required" row it may leave is the normal
//   intermediate state, not unintended partial state.
// - Reads/updates use the owner client directly (single-statement, RLS
//   enforced). No mass assignment: Zod .strict() + explicit column lists.
// - Errors are generic domain errors (never raw PostgREST detail to UI).
//   Handle-taken is the accepted enumerable residual (08 T8).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  HandleTakenError,
  ProfileAlreadyExistsError,
  ProfileNotFoundError,
  ProfileOperationError,
  ProfileValidationError,
  type PlayerProfile,
} from "../domain/player-profile";
import { createPlayerProfileInputSchema } from "../schemas/create-profile";
import { updatePlayerProfileInputSchema } from "../schemas/update-profile";
import { ensureAppUser } from "./ensure-app-user";

// Explicit column list (07 section 3: no `select *`).
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

// Retrieve the caller's own profile (07 getOwnProfile). Read-only: never
// creates an app_users row (missing row simply means no profile yet).
export async function getOwnProfile(
  client: SupabaseClient,
): Promise<PlayerProfile | null> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }

  const { data, error } = await client
    .from("player_profiles")
    .select(PLAYER_PROFILE_COLUMNS)
    .eq("user_id", user.id);

  if (error) {
    throw new ProfileOperationError();
  }
  const rows = (data ?? []) as PlayerProfileRow[];
  if (rows.length === 0) {
    return null;
  }
  if (rows.length !== 1) {
    // PK guarantees at most one row; anything else fails closed.
    throw new ProfileOperationError();
  }
  const row = rows[0] as PlayerProfileRow;
  if (row.user_id !== user.id) {
    throw new ProfileOperationError();
  }
  return toPlayerProfile(row);
}

// Create the caller's own profile (07 createPlayerProfile). Input is Zod
// validated (creation forces undiscoverable: is_discoverable/user_id/status
// rejected by .strict()). Handle lowercased by the schema transform;
// uniqueness errors mapped to field errors.
export async function createPlayerProfile(
  client: SupabaseClient,
  input: unknown,
): Promise<PlayerProfile> {
  const parsed = createPlayerProfileInputSchema.parse(input);

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }

  // Account-status gate (02 section 2): suspended never passes. This may
  // idempotently ensure the app_users row (recoverable onboarding state);
  // the mutation itself stays atomic inside the RPC below.
  await ensureAppUser(client);

  const { data, error } = await client.rpc("create_player_profile", {
    p_handle: parsed.handle,
    p_display_name: parsed.display_name,
    p_bio: parsed.bio ?? null,
    p_country_code: parsed.country_code ?? null,
  });

  if (error) {
    if (isPostgrestError(error) && error.code === "23505") {
      // Unique violation: either the caller already has a profile (PK) or
      // the handle is taken (lower(handle)). Distinguish without parsing
      // constraint names: the caller's own row answers it.
      const { data: own } = await client
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", user.id);
      if (((own ?? []) as Array<{ user_id: string }>).length > 0) {
        throw new ProfileAlreadyExistsError();
      }
      throw new HandleTakenError();
    }
    if (isPostgrestError(error) && error.code === "23514") {
      // CHECK violation that slipped past Zod (defense in depth).
      throw new ProfileValidationError();
    }
    throw new ProfileOperationError();
  }

  const rows = (data ?? []) as PlayerProfileRow[];
  if (rows.length !== 1 || typeof rows[0]?.user_id !== "string") {
    throw new ProfileOperationError();
  }
  const row = rows[0] as PlayerProfileRow;

  // Defense in depth: the RPC can only return the caller's own row via RLS.
  if (row.user_id !== user.id) {
    throw new ProfileOperationError();
  }
  // Creation forces undiscoverable (DB default false; no RPC parameter).
  // Fail closed if the default ever drifts.
  if (row.is_discoverable !== false) {
    throw new ProfileOperationError();
  }

  return toPlayerProfile(row);
}

// Update the caller's own profile (07 updatePlayerProfile). Generic patch
// only (display_name/bio/country_code/avatar_path); handle and
// is_discoverable are rejected here (dedicated flows own them in G1-7;
// D-G1-05 stays open). RLS binds the row; Zod binds the columns.
export async function updatePlayerProfile(
  client: SupabaseClient,
  patch: unknown,
): Promise<PlayerProfile> {
  const parsed = updatePlayerProfileInputSchema.parse(patch);

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }

  await ensureAppUser(client);

  // Strict accepted-field allowlist (08 T4): only defined fields, no
  // user_id/status/flags, no passthrough.
  const payload: Record<string, string | null> = {};
  if (parsed.display_name !== undefined) {
    payload["display_name"] = parsed.display_name;
  }
  if (parsed.bio !== undefined) {
    payload["bio"] = parsed.bio;
  }
  if (parsed.country_code !== undefined) {
    payload["country_code"] = parsed.country_code;
  }
  if (parsed.avatar_path !== undefined) {
    payload["avatar_path"] = parsed.avatar_path;
  }
  if (Object.keys(payload).length === 0) {
    throw new ProfileValidationError();
  }

  const { data, error } = await client
    .from("player_profiles")
    .update(payload)
    .eq("user_id", user.id)
    .select(PLAYER_PROFILE_COLUMNS);

  if (error) {
    if (isPostgrestError(error) && error.code === "23514") {
      throw new ProfileValidationError();
    }
    throw new ProfileOperationError();
  }

  const rows = (data ?? []) as PlayerProfileRow[];
  if (rows.length === 0) {
    // Either no profile yet or a write denial landed mid-flow (e.g.
    // suspension between gate and update). Distinguish without leaking:
    // suspended surfaces as the generic account error, else not-found.
    // This re-gate is failure-path only; the happy path stays one UPDATE.
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
  const row = rows[0] as PlayerProfileRow;
  if (row.user_id !== user.id) {
    throw new ProfileOperationError();
  }
  return toPlayerProfile(row);
}
