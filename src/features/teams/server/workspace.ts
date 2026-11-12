// Owner workspace reader (P2).
// Session-bound reads for the authenticated workspace. Unlike the public
// directory reader (identity-free, RPC-only), these operations derive the
// caller from the verified session and read the caller's own rows through
// the D1 base-table RLS policies (owner/creator/member select — local,
// UNAPPLIED). No RPC pair exists for managed reads; no new RPC is invented.
//
// Security posture:
// - Server-side only. Call-site injects the authenticated session client
//   (never service-role, never the browser client). No `next/headers`
//   import here.
// - Identity comes EXCLUSIVELY from `client.auth.getUser()`. No function
//   accepts a user ID argument: a caller-supplied ID cannot override scope.
// - Explicit column lists (no `select *`). Owner identity columns of OTHER
//   users never leave this boundary: outputs carry only the caller's own
//   management basis (`role`) plus public-profile-shaped team fields.
// - Roster views carry role/game-role/self/owner markers only. Raw user_ids
//   are row keys server-side and are never rendered; applicant data,
//   decision metadata, and organization authority are never read here.
// - Suspended callers fail via SuspendedError (generic message). Missing or
//   invisible teams resolve to null (404-equivalence, no existence oracle).
// - Errors are generic domain errors (never raw PostgREST detail to UI).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SuspendedError,
  UnauthenticatedError,
} from "@/features/player-profile/domain/app-user";
import { ensureAppUser } from "@/features/player-profile/server/ensure-app-user";
import { isWorkspaceRole, WorkspaceOperationError, WorkspaceValidationError, type ManagedTeam, type RosterMemberView, type WorkspaceRole } from "../domain/workspace";
import { managedTeamIdSchema } from "../schemas/workspace";

// Explicit column list: public-profile-shaped fields only. owner_user_id and
// created_by are selected to resolve the caller's OWN basis and are never
// forwarded for other users (mapping drops them unconditionally).
const MANAGED_TEAM_COLUMNS =
  "id,slug,name,game_key,region_code,description,current_level,target_level,recruiting,is_public,owner_user_id,created_by";

const MANAGED_TEAM_KEYS = [
  "id",
  "slug",
  "name",
  "game_key",
  "region_code",
  "description",
  "current_level",
  "target_level",
  "recruiting",
  "is_public",
  "owner_user_id",
  "created_by",
] as const;

interface ManagedTeamRow {
  id: unknown;
  slug: unknown;
  name: unknown;
  game_key: unknown;
  region_code: unknown;
  description: unknown;
  current_level: unknown;
  target_level: unknown;
  recruiting: unknown;
  is_public: unknown;
  owner_user_id: unknown;
  created_by: unknown;
}

interface MembershipRow {
  team_id: unknown;
  role: unknown;
}

interface RosterRow {
  user_id: unknown;
  role: unknown;
  game_role: unknown;
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

async function requireActiveSessionUserId(client: SupabaseClient): Promise<string> {
  const appUser = await ensureAppUser(client).catch((error: unknown) => {
    // ensureAppUser throws UnauthenticatedError / SuspendedError /
    // BootstrapError with generic messages — pass through, never wrap raw.
    throw error;
  });
  return appUser.id;
}

function resolveRole(
  row: { owner_user_id: string; created_by: string },
  membership: MembershipRow | undefined,
  sessionUserId: string,
): WorkspaceRole {
  if (row.owner_user_id === sessionUserId || row.created_by === sessionUserId) {
    return "owner";
  }
  // Co-captain has NO rights (matrix `02`): only member role='captain'
  // resolves to captain; everything else is read-only member.
  if (typeof membership?.role === "string" && membership.role === "captain") {
    return "captain";
  }
  return "member";
}

function toManagedTeamBase(row: ManagedTeamRow): Omit<ManagedTeam, "member_count" | "role"> {
  const keys = Object.keys(row as unknown as Record<string, unknown>);
  if (
    keys.length !== MANAGED_TEAM_KEYS.length ||
    !MANAGED_TEAM_KEYS.every((key, index) => keys[index] === key)
  ) {
    throw new WorkspaceOperationError();
  }
  if (
    !isUuid(row.id) ||
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.name) ||
    !isNonEmptyString(row.game_key) ||
    !isNonEmptyString(row.region_code) ||
    !isNonEmptyString(row.current_level) ||
    !isNonEmptyString(row.target_level) ||
    typeof row.recruiting !== "boolean" ||
    typeof row.is_public !== "boolean" ||
    (typeof row.description !== "string" && row.description !== null) ||
    typeof row.owner_user_id !== "string" ||
    typeof row.created_by !== "string"
  ) {
    throw new WorkspaceOperationError();
  }
  // owner_user_id / created_by are consumed for basis resolution by the
  // caller and never included in the returned object.
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    game_key: row.game_key,
    region_code: row.region_code,
    description: row.description,
    current_level: row.current_level,
    target_level: row.target_level,
    recruiting: row.recruiting,
    is_public: row.is_public,
  };
}

async function countMembers(client: SupabaseClient, teamId: string): Promise<number> {
  const { count, error } = await client
    .from("team_members")
    .select("team_id", { count: "exact", head: true })
    .eq("team_id", teamId);
  if (error || typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    throw new WorkspaceOperationError();
  }
  return count;
}

async function readMembership(
  client: SupabaseClient,
  teamId: string,
  sessionUserId: string,
): Promise<MembershipRow | undefined> {
  const { data, error } = await client
    .from("team_members")
    .select("team_id,role")
    .eq("team_id", teamId)
    .eq("user_id", sessionUserId)
    .limit(1);
  if (error) {
    throw new WorkspaceOperationError();
  }
  const rows = (data ?? []) as MembershipRow[];
  return rows[0];
}

// List the teams the caller owns or is authorized to manage (RLS-scoped).
// Bounded: at most 50 rows; authority never aggregates across teams.
export async function listManagedTeams(client: SupabaseClient): Promise<ManagedTeam[]> {
  const sessionUserId = await requireActiveSessionUserId(client);

  const { data, error } = await client
    .from("teams")
    .select(MANAGED_TEAM_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new WorkspaceOperationError();
  }
  const rows = (data ?? []) as ManagedTeamRow[];
  const managed: ManagedTeam[] = [];
  for (const row of rows) {
    const base = toManagedTeamBase(row);
    const membership = await readMembership(client, base.id, sessionUserId);
    const role = resolveRole(
      { owner_user_id: row.owner_user_id as string, created_by: row.created_by as string },
      membership,
      sessionUserId,
    );
    if (!isWorkspaceRole(role)) {
      throw new WorkspaceOperationError();
    }
    managed.push({ ...base, member_count: await countMembers(client, base.id), role });
  }
  return managed;
}

// Load one managed team by id. Invisible teams (missing, private to others,
// RLS-denied) resolve to null — identical to missing (404-equivalence).
export async function getManagedTeam(
  client: SupabaseClient,
  input: unknown,
): Promise<ManagedTeam | null> {
  let teamId: string;
  try {
    teamId = managedTeamIdSchema.parse(input);
  } catch {
    throw new WorkspaceValidationError();
  }
  const sessionUserId = await requireActiveSessionUserId(client);

  const { data, error } = await client.from("teams").select(MANAGED_TEAM_COLUMNS).eq("id", teamId).limit(1);
  if (error) {
    throw new WorkspaceOperationError();
  }
  const rows = (data ?? []) as ManagedTeamRow[];
  if (rows.length !== 1) {
    return null;
  }
  const row = rows[0] as ManagedTeamRow;
  const base = toManagedTeamBase(row);
  const membership = await readMembership(client, base.id, sessionUserId);
  // RLS already scoped this row to owner/creator/member; a visible row with
  // no ownership and no membership is a policy anomaly — fail closed.
  const isOwner =
    (row.owner_user_id as string) === sessionUserId || (row.created_by as string) === sessionUserId;
  if (!isOwner && membership === undefined) {
    return null;
  }
  const role = resolveRole(
    { owner_user_id: row.owner_user_id as string, created_by: row.created_by as string },
    membership,
    sessionUserId,
  );
  return { ...base, member_count: await countMembers(client, base.id), role };
}

// List roster cards for a team the caller may see (member-gated under RLS).
// Returns null when the team is invisible to the caller. Views carry role,
// game role, self/owner markers — never user_ids, never applicant data.
export async function listTeamRoster(
  client: SupabaseClient,
  input: unknown,
): Promise<{ team: ManagedTeam; members: RosterMemberView[] } | null> {
  let teamId: string;
  try {
    teamId = managedTeamIdSchema.parse(input);
  } catch {
    throw new WorkspaceValidationError();
  }
  const team = await getManagedTeam(client, teamId);
  if (team === null) {
    return null;
  }
  const sessionUserId = await requireActiveSessionUserId(client);

  const { data, error } = await client
    .from("team_members")
    .select("user_id,role,game_role")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) {
    throw new WorkspaceOperationError();
  }
  const rows = (data ?? []) as RosterRow[];
  const members: RosterMemberView[] = [];
  for (const row of rows) {
    if (
      typeof row.user_id !== "string" ||
      typeof row.role !== "string" ||
      (typeof row.game_role !== "string" && row.game_role !== null)
    ) {
      throw new WorkspaceOperationError();
    }
    members.push({
      key: row.user_id,
      role: row.role,
      game_role: row.game_role,
      is_self: row.user_id === sessionUserId,
    });
  }
  return { team, members };
}

export { SuspendedError, UnauthenticatedError };
