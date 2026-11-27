// Player game profile server operations (G1-3).
// Authoritative: 02 sections 2-3, 03 sections 3/5/7, 05 sections 1/3,
//   07 sections 1/3/5 (upsertGameProfile), 11 section 3 (D-G1-09).
//
// Security posture (frozen):
// - Server-side only. Call sites must be Route Handlers / Server Actions
//   holding the AUTHENTICATED OWNER client (never service-role, never the
//   browser client) — except listSupportedGames, which reads the public
//   catalogue and accepts any client including anon. No service-role import,
//   no `next/headers` import (call-site injects the client).
// - Identity comes EXCLUSIVELY from the verified session
//   (`client.auth.getUser()`). These functions accept NO user ID argument, so
//   a caller-supplied ID from body/query/state cannot override ownership.
//   The player_user_id column IS the owner key (RLS binds it directly; no
//   join needed for isolation).
// - Creation requires an existing canonical profile (FK enforces; the server
//   maps the violation to MissingPlayerProfileError — never auto-creates a
//   canonical row: no placeholder handles per 02) and a supported ACTIVE
//   catalogue row (inactive titles hidden from creation; existing profiles
//   preserved). Each operation is single-statement, so no transactional RPC
//   is needed (unlike G1-2 bootstrap+profile creation).
// - No mass assignment: Zod .strict() + explicit column lists. game_key is a
//   row selector on update, never patchable; id/player_user_id are rejected.
// - game_user_id is persisted owner-private and returned only on own rows;
//   G1-3 exposes no projection (D-G1-04 stays open; G1-4 owns the RPCs).
// - Errors are generic domain errors (never raw PostgREST detail to UI).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  GameProfileAlreadyExistsError,
  GameProfileNotFoundError,
  GameProfileOperationError,
  GameProfileValidationError,
  MissingPlayerProfileError,
  UnsupportedGameError,
  type GameCatalogueEntry,
  type GameProfile,
} from "../domain/game-profile";
import {
  createGameProfileInputSchema,
  isRegionAllowedForGame,
  updateGameProfileInputSchema,
} from "../schemas/game-profile";
import { gameKeySchema } from "../schemas/game";
import { ensureAppUser } from "./ensure-app-user";

// Explicit column lists (07 section 3: no `select *`).
const GAME_PROFILE_COLUMNS =
  "id,player_user_id,game_key,ign,game_user_id,primary_role,play_modes,region_code,availability,is_visible,created_at,updated_at";

const GAME_CATALOGUE_COLUMNS = "key,name,short_name";

interface GameProfileRow {
  id: string;
  player_user_id: string;
  game_key: string;
  ign: string;
  game_user_id: string | null;
  primary_role: string | null;
  play_modes: string[];
  region_code: string | null;
  availability: string[];
  is_visible: boolean;
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

function toGameProfile(row: GameProfileRow): GameProfile {
  return {
    id: row.id,
    player_user_id: row.player_user_id,
    game_key: row.game_key,
    ign: row.ign,
    game_user_id: row.game_user_id,
    primary_role: row.primary_role,
    play_modes: row.play_modes,
    region_code: row.region_code,
    availability: row.availability,
    is_visible: row.is_visible,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// List supported (active) catalogue titles (07: catalogue reads). Public:
// no session required — the catalogue is world-readable per 05 section 3
// (inactive titles filtered here, existing profiles preserved).
export async function listSupportedGames(
  client: SupabaseClient,
): Promise<GameCatalogueEntry[]> {
  const { data, error } = await client
    .from("games")
    .select(GAME_CATALOGUE_COLUMNS)
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new GameProfileOperationError();
  }
  return ((data ?? []) as GameCatalogueEntry[]).map((g) => ({
    key: g.key,
    name: g.name,
    short_name: g.short_name,
  }));
}

// Read the caller's own game profiles (owner RLS SELECT). Read-only.
export async function getOwnGameProfiles(
  client: SupabaseClient,
): Promise<GameProfile[]> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }

  const { data, error } = await client
    .from("player_game_profiles")
    .select(GAME_PROFILE_COLUMNS)
    .eq("player_user_id", user.id)
    .order("game_key");

  if (error) {
    throw new GameProfileOperationError();
  }
  const rows = (data ?? []) as GameProfileRow[];
  for (const row of rows) {
    if (row.player_user_id !== user.id) {
      throw new GameProfileOperationError();
    }
  }
  return rows.map(toGameProfile);
}

// Create the caller's game profile for one supported active title.
// 07 upsertGameProfile is provided as explicit create-or-update: creation
// takes the full input; a second create for the same (player, game) is a
// predictable GameProfileAlreadyExistsError (NOT silent overwrite), and the
// caller composes update for full replacement.
export async function createGameProfile(
  client: SupabaseClient,
  input: unknown,
): Promise<GameProfile> {
  const parsed = createGameProfileInputSchema.parse(input);

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }

  // Account-status gate (02 section 2): suspended never passes.
  await ensureAppUser(client);

  // Canonical profile must exist first (02: no placeholder handles, no
  // auto-drafted profiles). The FK would enforce this; the explicit check
  // maps it to a friendly, safe domain error.
  const { data: canonical, error: canonicalError } = await client
    .from("player_profiles")
    .select("user_id")
    .eq("user_id", user.id);
  if (canonicalError) {
    throw new GameProfileOperationError();
  }
  if (((canonical ?? []) as Array<{ user_id: string }>).length === 0) {
    throw new MissingPlayerProfileError();
  }

  // Catalogue membership + active status (05 section 3: inactive titles
  // hidden from creation; the FK alone cannot express is_active).
  const { data: games, error: gamesError } = await client
    .from("games")
    .select("key,is_active")
    .eq("key", parsed.game_key);
  if (gamesError) {
    throw new GameProfileOperationError();
  }
  const game = ((games ?? []) as Array<{ key: string; is_active: boolean }>)[0];
  if (!game || game.is_active !== true) {
    // Identical for unknown vs inactive: no existence oracle.
    throw new UnsupportedGameError();
  }

  const { data, error } = await client
    .from("player_game_profiles")
    .insert({
      player_user_id: user.id,
      game_key: parsed.game_key,
      ign: parsed.ign,
      game_user_id: parsed.game_user_id ?? null,
      primary_role: parsed.primary_role ?? null,
      ...(parsed.play_modes !== undefined
        ? { play_modes: parsed.play_modes }
        : {}),
      region_code: parsed.region_code ?? null,
      ...(parsed.availability !== undefined
        ? { availability: parsed.availability }
        : {}),
      ...(parsed.is_visible !== undefined
        ? { is_visible: parsed.is_visible }
        : {}),
    })
    .select(GAME_PROFILE_COLUMNS);

  if (error) {
    // 23505 can only be UNIQUE (player_user_id, game_key): id is random, so
    // the mapping is deterministic (unlike the two-unique profile case).
    if (isPostgrestError(error) && error.code === "23505") {
      throw new GameProfileAlreadyExistsError();
    }
    if (isPostgrestError(error) && error.code === "23503") {
      // FK race (catalogue row removed/deactivated between check and
      // insert — RESTRICT blocks deletes with profiles, but the window
      // exists for deactivation): safe generic, catalogue re-check on retry.
      throw new UnsupportedGameError();
    }
    if (isPostgrestError(error) && error.code === "23514") {
      throw new GameProfileValidationError();
    }
    throw new GameProfileOperationError();
  }

  const rows = (data ?? []) as GameProfileRow[];
  if (rows.length !== 1 || typeof rows[0]?.id !== "string") {
    throw new GameProfileOperationError();
  }
  const row = rows[0] as GameProfileRow;
  if (row.player_user_id !== user.id || row.game_key !== parsed.game_key) {
    throw new GameProfileOperationError();
  }
  return toGameProfile(row);
}

// Update the caller's game profile for one title. gameKey selects the row
// (natural key; surrogate ids never appear in URLs per 03); patch is a
// strict partial — game_key/id/player_user_id are rejected (ownership
// immutable). Region re-validated against the row's game vocabulary.
export async function updateGameProfile(
  client: SupabaseClient,
  gameKey: unknown,
  patch: unknown,
): Promise<GameProfile> {
  const parsedKey = gameKeySchema.parse(gameKey);
  const parsed = updateGameProfileInputSchema.parse(patch);

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new UnauthenticatedError();
  }

  await ensureAppUser(client);

  if (
    parsed.region_code !== undefined &&
    parsed.region_code !== null &&
    !isRegionAllowedForGame(parsedKey, parsed.region_code)
  ) {
    throw new GameProfileValidationError();
  }

  // Strict accepted-field allowlist (08 T4): only defined fields.
  const payload: Record<string, unknown> = {};
  if (parsed.ign !== undefined) {
    payload["ign"] = parsed.ign;
  }
  if (parsed.game_user_id !== undefined) {
    payload["game_user_id"] = parsed.game_user_id;
  }
  if (parsed.primary_role !== undefined) {
    payload["primary_role"] = parsed.primary_role;
  }
  if (parsed.play_modes !== undefined) {
    payload["play_modes"] = parsed.play_modes;
  }
  if (parsed.region_code !== undefined) {
    payload["region_code"] = parsed.region_code;
  }
  if (parsed.availability !== undefined) {
    payload["availability"] = parsed.availability;
  }
  if (parsed.is_visible !== undefined) {
    payload["is_visible"] = parsed.is_visible;
  }
  if (Object.keys(payload).length === 0) {
    throw new GameProfileValidationError();
  }

  const { data, error } = await client
    .from("player_game_profiles")
    .update(payload)
    .eq("player_user_id", user.id)
    .eq("game_key", parsedKey)
    .select(GAME_PROFILE_COLUMNS);

  if (error) {
    if (isPostgrestError(error) && error.code === "23514") {
      throw new GameProfileValidationError();
    }
    throw new GameProfileOperationError();
  }

  const rows = (data ?? []) as GameProfileRow[];
  if (rows.length === 0) {
    // Missing row or a write denial landed mid-flow. Distinguish without
    // leaking: suspended surfaces as the generic account error.
    try {
      await ensureAppUser(client);
    } catch (e: unknown) {
      if (e instanceof SuspendedError) {
        throw e;
      }
    }
    throw new GameProfileNotFoundError();
  }
  if (rows.length !== 1) {
    throw new GameProfileOperationError();
  }
  const row = rows[0] as GameProfileRow;
  if (row.player_user_id !== user.id || row.game_key !== parsedKey) {
    throw new GameProfileOperationError();
  }
  return toGameProfile(row);
}
