import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { TEAMS_MAX, teamSchema } from "../schemas";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import * as teamRepo from "@/server/repositories/tie-breaker-teams";
import { requireTieBreakerOwned } from "./tie-breaker-foundation";
import { requireUnlocked } from "./competition";

/**
 * Tie-Breaker Resolver — Team service. Unlocked competitions only.
 * Duplicate names are rejected case-insensitively (DB unique index is the backstop).
 */

async function ownedCompetition(supabase: SupabaseClient, organizationId: string, competitionId: string) {
  return requireUnlocked(
    requireTieBreakerOwned(await compRepo.findTieBreakerCompetitionById(supabase, competitionId), organizationId),
  );
}

function duplicateName(teams: teamRepo.TieBreakerTeamRow[], name: string, exceptId?: string): boolean {
  const key = name.trim().toLowerCase();
  return teams.some((t) => t.id !== exceptId && t.name.toLowerCase() === key);
}

export async function listTeams(supabase: SupabaseClient, organizationId: string, competitionId: string) {
  requireTieBreakerOwned(await compRepo.findTieBreakerCompetitionById(supabase, competitionId), organizationId);
  return teamRepo.listTieBreakerTeamsByCompetition(supabase, competitionId);
}

export async function addTeam(supabase: SupabaseClient, organizationId: string, competitionId: string, rawInput: unknown) {
  const competition = await ownedCompetition(supabase, organizationId, competitionId);
  const input = parseOrThrow(teamSchema, rawInput);
  const teams = await teamRepo.listTieBreakerTeamsByCompetition(supabase, competition.id);
  if (teams.length >= TEAMS_MAX) {
    throw validationError("This competition already has 32 teams. Split into a second competition for more teams");
  }
  if (duplicateName(teams, input.name)) {
    throw validationError("That team name is already used in this competition. Use a different name");
  }
  try {
    return await teamRepo.createTieBreakerTeam(supabase, {
      competition_id: competition.id,
      organization_id: organizationId,
      name: input.name.trim(),
      short_name: input.shortName?.trim() ? input.shortName.trim() : null,
      logo_url: input.logoUrl,
    });
  } catch (e) {
    throw toCustomerTeamError(e);
  }
}

export async function updateTeam(
  supabase: SupabaseClient,
  organizationId: string,
  competitionId: string,
  teamId: string,
  rawInput: unknown,
) {
  const competition = await ownedCompetition(supabase, organizationId, competitionId);
  const team = requireTieBreakerOwned(await teamRepo.findTieBreakerTeamById(supabase, teamId), organizationId, "Team not found");
  if (team.competition_id !== competition.id) throw validationError("That team does not belong to this competition");
  const input = parseOrThrow(teamSchema, rawInput);
  const teams = await teamRepo.listTieBreakerTeamsByCompetition(supabase, competition.id);
  if (duplicateName(teams, input.name, team.id)) {
    throw validationError("That team name is already used in this competition. Use a different name");
  }
  try {
    return await teamRepo.updateTieBreakerTeam(supabase, team.id, {
      name: input.name.trim(),
      short_name: input.shortName?.trim() ? input.shortName.trim() : null,
      logo_url: input.logoUrl,
    });
  } catch (e) {
    throw toCustomerTeamError(e);
  }
}

export async function removeTeam(supabase: SupabaseClient, organizationId: string, competitionId: string, teamId: string) {
  const competition = await ownedCompetition(supabase, organizationId, competitionId);
  const team = requireTieBreakerOwned(await teamRepo.findTieBreakerTeamById(supabase, teamId), organizationId, "Team not found");
  if (team.competition_id !== competition.id) throw validationError("That team does not belong to this competition");
  await teamRepo.deleteTieBreakerTeam(supabase, team.id);
}

/** Maps unique-violation internals to the customer duplicate-name message. Never leaks DB errors. */
function toCustomerTeamError(e: unknown): Error {
  if (e instanceof AppError) return e;
  const message = e instanceof Error ? e.message : "";
  if (message.includes("tie_breaker_teams_competition_name_unique") || /duplicate key/i.test(message)) {
    return validationError("That team name is already used in this competition. Use a different name");
  }
  return validationError("Could not save the team. Check the name and try again");
}
