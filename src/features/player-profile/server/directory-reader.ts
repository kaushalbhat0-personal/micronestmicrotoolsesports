// Public directory reader (G1-4).
// Authoritative: 04 sections 5-6, 05 section 5, 07 sections 1-4, 11 sections
//   3-4 (APPROVED D-G1-03 RPC-only; APPROVED D-G1-04 Option A omit 2026-11-11).
//
// Security posture (frozen):
// - Server-side only. Call sites may pass ANY client (anon included): the two
//   RPCs are the sole public path and enforce consent + active predicates
//   internally. No service-role import, no `next/headers` import (call-site
//   injects the client). No base-table reads for others' data.
// - No user ID is accepted anywhere in this module (neither session-derived
//   nor caller-supplied): directory reads are identity-free by design. There
//   is no owner override, no impersonation parameter, nothing to forge.
// - Inputs are Zod-validated at this boundary (shape + limits + per-game
//   allowlists where the game is known). Unknown game/region/role values pass
//   through to the RPC, which matches them against zero rows (fail closed, no
//   existence oracle: indistinguishable from a valid filter with no results).
// - Outputs are strictly mapped to the frozen 12 columns (no spread, no
//   `select *`); any extra RPC key (including a future game_user_id leak) is
//   dropped, never forwarded. Errors are generic domain errors (never raw
//   PostgREST detail to UI).
// - avatar_url: the RPC returns the stored relative object path in the
//   avatar_url column (06 section 2). This reader resolves it to a public
//   storage URL via the client's own storage config (offline URL building,
//   no extra read). NULL stays NULL (no avatar). Non-allowlisted shapes
//   (absolute URLs, traversal, wrong extensions) fail the row closed and are
//   never passed through (G1-5, 08 T1/T6). Signed-URL shapes are rejected.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DirectoryOperationError,
  DirectoryValidationError,
  type PublicPlayerCard,
} from "../domain/directory";
import { PUBLIC_PROJECTION_COLUMNS } from "../domain/public-projection";
import { isValidAvatarPath } from "../schemas/avatar";
import {
  getPlayerByHandleInputSchema,
  searchDirectoryInputSchema,
  type SearchDirectoryInput,
} from "../schemas/directory";
import { BGMI_ROLES, validateGameRegion } from "../schemas/game";

const AVATAR_BUCKET = "public-avatars";

const BGMI_ROLE_SET: readonly string[] = BGMI_ROLES;

interface DirectoryRpcRow {
  handle: unknown;
  display_name: unknown;
  avatar_url: unknown;
  bio: unknown;
  country_code: unknown;
  game_key: unknown;
  game_name: unknown;
  ign: unknown;
  primary_role: unknown;
  play_modes: unknown;
  region_code: unknown;
  availability: unknown;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  );
}

function resolveAvatarUrl(
  client: SupabaseClient,
  avatarPath: string | null,
): string | null {
  if (avatarPath === null) {
    return null;
  }
  // Fail closed (G1-5, 08 T1/T6): the RPC returns the stored relative
  // `avatar_path` in the `avatar_url` column. Only uid-scoped relative
  // raster paths resolve. Absolute URLs, traversal, query strings and any
  // non-matching shape never pass through — they fail the whole row rather
  // than leaking an attacker-controlled URL into a public projection.
  if (!isValidAvatarPath(avatarPath)) {
    throw new DirectoryOperationError();
  }
  const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
  const url = data?.publicUrl;
  if (typeof url !== "string" || url.length === 0) {
    throw new DirectoryOperationError();
  }
  // Defense in depth: public avatars use stable public URLs, never signed
  // URLs. A signed-URL shape here means a storage-contract drift — fail.
  if (url.includes("token=") || url.includes("?t=")) {
    throw new DirectoryOperationError();
  }
  return url;
}

// Strict allowlist mapping: exactly the frozen 12 keys, in frozen order
// (assertFrozenKeySet enforces the set first). Field-level shape failures
// also fail closed. Nothing extra is ever forwarded.
function toPublicPlayerCard(
  client: SupabaseClient,
  row: DirectoryRpcRow,
): PublicPlayerCard {
  if (
    typeof row.handle !== "string" ||
    typeof row.display_name !== "string" ||
    (typeof row.avatar_url !== "string" && row.avatar_url !== null) ||
    (typeof row.bio !== "string" && row.bio !== null) ||
    (typeof row.country_code !== "string" && row.country_code !== null) ||
    typeof row.game_key !== "string" ||
    typeof row.game_name !== "string" ||
    typeof row.ign !== "string" ||
    (typeof row.primary_role !== "string" && row.primary_role !== null) ||
    !isStringArray(row.play_modes) ||
    (typeof row.region_code !== "string" && row.region_code !== null) ||
    !isStringArray(row.availability)
  ) {
    throw new DirectoryOperationError();
  }
  return {
    handle: row.handle,
    display_name: row.display_name,
    avatar_url: resolveAvatarUrl(client, row.avatar_url),
    bio: row.bio,
    country_code: row.country_code,
    game_key: row.game_key,
    game_name: row.game_name,
    ign: row.ign,
    primary_role: row.primary_role,
    play_modes: row.play_modes,
    region_code: row.region_code,
    availability: row.availability,
  };
}

function assertFrozenKeySet(rows: DirectoryRpcRow[]): void {
  const expected = [...PUBLIC_PROJECTION_COLUMNS];
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (
      keys.length !== expected.length ||
      !expected.every((key, index) => keys[index] === key)
    ) {
      throw new DirectoryOperationError();
    }
  }
}

// Per-game allowlists at the action layer (D-G1-09): when the caller names a
// known game, region/role are checked against that game's vocabulary here so
// malformed filters are rejected before any RPC call. Unknown games pass
// through (the RPC matches them against zero rows, fail closed).
function enforceKnownGameVocabulary(input: {
  game?: string | undefined;
  region?: string | undefined;
  role?: string | undefined;
}): void {
  if (input.game === undefined) {
    return;
  }
  if (input.game === "bgmi") {
    if (
      input.region !== undefined &&
      !validateGameRegion(input.game, input.region)
    ) {
      throw new DirectoryValidationError();
    }
    if (input.role !== undefined && !BGMI_ROLE_SET.includes(input.role)) {
      throw new DirectoryValidationError();
    }
  }
}

// Search the public directory (07 searchDirectory). Anon-safe: any client.
export async function searchDirectory(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicPlayerCard[]> {
  let parsed: SearchDirectoryInput;
  try {
    parsed = searchDirectoryInputSchema.parse(input);
  } catch {
    throw new DirectoryValidationError();
  }
  enforceKnownGameVocabulary(parsed);

  const { data, error } = await client.rpc("search_player_directory", {
    p_game: parsed.game ?? null,
    p_region: parsed.region ?? null,
    p_role: parsed.role ?? null,
    p_query: parsed.query ?? null,
    p_limit: parsed.limit,
    p_offset: parsed.offset,
  });
  if (error) {
    throw new DirectoryOperationError();
  }
  const rows = ((data ?? []) as DirectoryRpcRow[]).slice();
  assertFrozenKeySet(rows);
  // Deterministic order is enforced SQL-side (handle, game_key); re-check
  // cheapest here by trusting the RPC and mapping strictly.
  return rows.map((row) => toPublicPlayerCard(client, row));
}

// Fetch one public profile by handle (07 getPlayerByHandle). Anon-safe.
// Zero rows (missing, private, suspended, inactive) map to null without
// distinction (404-equivalence, 08 T5/T8).
export async function getPlayerByHandle(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicPlayerCard | null> {
  const normalized: unknown =
    typeof input === "string" ? { handle: input } : input;
  let parsed: { handle: string };
  try {
    parsed = getPlayerByHandleInputSchema.parse(normalized);
  } catch {
    throw new DirectoryValidationError();
  }

  const { data, error } = await client.rpc("get_player_by_handle", {
    p_handle: parsed.handle,
  });
  if (error) {
    throw new DirectoryOperationError();
  }
  const rows = ((data ?? []) as DirectoryRpcRow[]).slice();
  if (rows.length === 0) {
    return null;
  }
  // G1 holds a single catalogue title, so at most one row per handle is
  // possible (UNIQUE (player, game)). More than one row is a data anomaly:
  // fail closed rather than silently dropping game profiles.
  if (rows.length !== 1) {
    throw new DirectoryOperationError();
  }
  assertFrozenKeySet(rows);
  return toPublicPlayerCard(client, rows[0] as DirectoryRpcRow);
}
