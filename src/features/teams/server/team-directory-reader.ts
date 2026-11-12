// Public team directory reader (P1).
// Reads exclusively through the D1 masked RPC pair `search_teams` /
// `get_team_by_slug` (local, UNAPPLIED — integration boundary, see
// docs/product-development/P1-teams-discovery/03-domain-data-integration.md).
//
// Security posture (mirrors the frozen G1 directory reader):
// - Server-side only. Call sites may pass ANY client (anon included): the
//   two RPCs are the sole public path and enforce the is_public predicate
//   internally. No service-role import, no `next/headers` import (call-site
//   injects the client). No base-table reads for teams, members, posts,
//   applications or reports.
// - No user ID is accepted anywhere in this module: team discovery reads are
//   identity-free by design. There is no owner override, no impersonation
//   parameter, nothing to forge.
// - Inputs are Zod-validated at this boundary. When the caller names a known
//   game (bgmi), region is checked against that game's vocabulary here so
//   malformed filters are rejected before any RPC call. Unknown games pass
//   through (the RPC matches them against zero rows, fail closed, no
//   existence oracle: indistinguishable from a valid filter with no results).
// - Outputs are strictly mapped to the 9 public columns (+ description for
//   detail). Any extra RPC key (owner_user_id, created_by, organization_id,
//   timestamps, applicant data) is dropped, never forwarded. Errors are
//   generic domain errors (never raw PostgREST detail to UI).
// - No write path exists in this module. Team creation, roster changes,
//   recruitment posts and applications are presentation-only in P1.

import type { SupabaseClient } from "@supabase/supabase-js";
import { BGMI_ROLES, validateGameRegion } from "@/features/player-profile/schemas/game";
import { TEAM_DIRECTORY_COLUMNS } from "../domain/team-directory-columns";
import {
  TeamDirectoryOperationError,
  TeamDirectoryValidationError,
  type PublicTeamCard,
  type PublicTeamDetail,
} from "../domain/team-directory";
import {
  getTeamBySlugInputSchema,
  searchTeamsInputSchema,
  type SearchTeamsInput,
} from "../schemas/directory";

const BGMI_ROLE_SET: readonly string[] = BGMI_ROLES;

interface TeamSearchRpcRow {
  id: unknown;
  slug: unknown;
  name: unknown;
  game_key: unknown;
  region_code: unknown;
  current_level: unknown;
  target_level: unknown;
  recruiting: unknown;
  member_count: unknown;
}

interface TeamDetailRpcRow extends TeamSearchRpcRow {
  description: unknown;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// PostgREST serializes SQL bigint (member_count) as a JSON number in the
// Supabase JS client; accept decimal strings defensively and normalize to a
// safe integer. Anything else fails the row closed.
function toMemberCount(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d{1,9}$/.test(value)) {
    return Number(value);
  }
  throw new TeamDirectoryOperationError();
}

// Strict allowlist mapping: exactly the 9 public keys, in contract order
// (assertSearchKeySet enforces the set first). Field-level shape failures
// fail closed. Nothing extra is ever forwarded.
function toPublicTeamCard(row: TeamSearchRpcRow): PublicTeamCard {
  if (
    !isUuid(row.id) ||
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.name) ||
    !isNonEmptyString(row.game_key) ||
    !isNonEmptyString(row.region_code) ||
    !isNonEmptyString(row.current_level) ||
    !isNonEmptyString(row.target_level) ||
    typeof row.recruiting !== "boolean"
  ) {
    throw new TeamDirectoryOperationError();
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    game_key: row.game_key,
    region_code: row.region_code,
    current_level: row.current_level,
    target_level: row.target_level,
    recruiting: row.recruiting,
    member_count: toMemberCount(row.member_count),
  };
}

function toPublicTeamDetail(row: TeamDetailRpcRow): PublicTeamDetail {
  const card = toPublicTeamCard(row);
  if (typeof row.description !== "string" && row.description !== null) {
    throw new TeamDirectoryOperationError();
  }
  return { ...card, description: row.description };
}

function assertSearchKeySet(rows: TeamSearchRpcRow[]): void {
  const expected = [...TEAM_DIRECTORY_COLUMNS];
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (keys.length !== expected.length || !expected.every((key, index) => keys[index] === key)) {
      throw new TeamDirectoryOperationError();
    }
  }
}

function assertDetailKeySet(rows: TeamDetailRpcRow[]): void {
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (keys.length !== TEAM_DIRECTORY_COLUMNS.length + 1 || !keys.includes("description")) {
      throw new TeamDirectoryOperationError();
    }
    const searchKeys = keys.filter((key) => key !== "description");
    const expected = [...TEAM_DIRECTORY_COLUMNS];
    if (!expected.every((key, index) => searchKeys[index] === key)) {
      throw new TeamDirectoryOperationError();
    }
  }
}

// Per-game allowlists at the action layer (same D-G1-09 direction as the
// player reader): when the caller names a known game, region/role are checked
// against that game's vocabulary here so malformed filters are rejected
// before any RPC call. Unknown games pass through (zero rows, fail closed).
function enforceKnownGameVocabulary(input: { game?: string | undefined; region?: string | undefined }): void {
  if (input.game === undefined) {
    return;
  }
  if (input.game === "bgmi") {
    if (input.region !== undefined && !validateGameRegion(input.game, input.region)) {
      throw new TeamDirectoryValidationError();
    }
  }
}

export function validateTeamRoleForGame(game: string, role: string): boolean {
  if (game === "bgmi") {
    return BGMI_ROLE_SET.includes(role);
  }
  // Unknown games fail closed: no role is ever valid for them here.
  return false;
}

// Search public teams (anon-safe: any client). The RPC owns the is_public
// predicate, LIKE-escaping, and pagination clamps.
export async function searchTeams(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicTeamCard[]> {
  let parsed: SearchTeamsInput;
  try {
    parsed = searchTeamsInputSchema.parse(input);
  } catch {
    throw new TeamDirectoryValidationError();
  }
  enforceKnownGameVocabulary(parsed);

  const { data, error } = await client.rpc("search_teams", {
    p_game: parsed.game ?? null,
    p_region: parsed.region ?? null,
    p_query: parsed.query ?? null,
    p_limit: parsed.limit,
    p_offset: parsed.offset,
  });
  if (error) {
    throw new TeamDirectoryOperationError();
  }
  const rows = ((data ?? []) as TeamSearchRpcRow[]).slice();
  assertSearchKeySet(rows);
  return rows.map((row) => toPublicTeamCard(row));
}

// Fetch one public team by slug (anon-safe). Zero rows (missing, private)
// map to null without distinction (404-equivalence: no existence signal).
export async function getTeamBySlug(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicTeamDetail | null> {
  const normalized: unknown = typeof input === "string" ? { slug: input } : input;
  let parsed: { slug: string };
  try {
    parsed = getTeamBySlugInputSchema.parse(normalized);
  } catch {
    throw new TeamDirectoryValidationError();
  }

  const { data, error } = await client.rpc("get_team_by_slug", {
    p_slug: parsed.slug,
  });
  if (error) {
    throw new TeamDirectoryOperationError();
  }
  const rows = ((data ?? []) as TeamDetailRpcRow[]).slice();
  if (rows.length === 0) {
    return null;
  }
  if (rows.length !== 1) {
    throw new TeamDirectoryOperationError();
  }
  assertDetailKeySet(rows);
  return toPublicTeamDetail(rows[0] as TeamDetailRpcRow);
}
