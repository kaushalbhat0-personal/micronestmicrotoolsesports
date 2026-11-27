import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrThrow } from "@/lib/validation";
import { AppError, conflictError, forbiddenError, internalError, notFoundError } from "@/lib/errors";
import {
  teamCreateSchema,
  teamUpdateSchema,
  type TeamCreateInput,
  type TeamUpdateInput,
} from "../schemas/finder";
import {
  createTeam,
  findTeamById,
  listTeamMembers,
  updateTeam,
  type FinderTeamRow,
} from "../repositories/finder";

/**
 * Finder — team writes (Phase C).
 *
 * userId MUST come from requireUser() at the action boundary, never from
 * caller input. RLS (captain_user_id/created_by = auth.uid(), plus the
 * is_finder_team_captain helper) enforces the same invariant at the
 * database layer; Zod is the application-layer contract.
 */

function isSlugConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "23505" &&
    typeof record.message === "string" &&
    (record.message.includes("finder_teams_slug_key") ||
      record.message.includes("finder_teams_slug_unique"))
  );
}

/** Application-layer captain check. RLS remains the security boundary. */
export async function assertTeamCaptain(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
): Promise<FinderTeamRow> {
  const team = await findTeamById(supabase, teamId);
  if (!team) throw notFoundError("Team not found.");
  if (team.captain_user_id === userId || team.created_by === userId) return team;
  const members = await listTeamMembers(supabase, teamId).catch(() => []);
  const self = members.find((m) => m.user_id === userId);
  if (self?.role === "captain") return team;
  throw forbiddenError("Only the team captain can do this.");
}

export async function createMyTeam(
  supabase: SupabaseClient,
  userId: string,
  raw: unknown,
): Promise<FinderTeamRow> {
  const input: TeamCreateInput = parseOrThrow(teamCreateSchema, raw);
  try {
    return await createTeam(supabase, userId, {
      slug: input.slug,
      name: input.name,
      game: input.game ?? "bgmi",
      region: input.region,
      description: input.description ?? undefined,
      current_level: input.current_level,
      target_level: input.target_level,
      recruiting: input.recruiting ?? true,
      contact_mode: input.contact_mode ?? "application_only",
      external_link: input.external_link ?? undefined,
      is_public: input.is_public ?? true,
    });
  } catch (error) {
    if (isSlugConflict(error)) {
      throw conflictError("This team URL is already taken. Try another one.");
    }
    throw internalError();
  }
}

export async function updateMyTeam(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  raw: unknown,
): Promise<FinderTeamRow> {
  const input: TeamUpdateInput = parseOrThrow(teamUpdateSchema, raw);
  await assertTeamCaptain(supabase, teamId, userId);
  try {
    return await updateTeam(supabase, teamId, {
      name: input.name,
      region: input.region,
      description: input.description ?? undefined,
      current_level: input.current_level,
      target_level: input.target_level,
      recruiting: input.recruiting,
      contact_mode: input.contact_mode,
      external_link: input.external_link ?? undefined,
      is_public: input.is_public,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw internalError();
  }
}
