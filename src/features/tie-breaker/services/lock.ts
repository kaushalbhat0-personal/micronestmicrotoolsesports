import type { SupabaseClient } from "@supabase/supabase-js";
import { validationError } from "@/lib/errors";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import * as teamRepo from "@/server/repositories/tie-breaker-teams";
import * as resultRepo from "@/server/repositories/tie-breaker-results";
import { findOrganizationById } from "@/server/repositories/organizations";
import { resolveStandings } from "../engine/resolve";
import { TEAMS_MAX } from "../schemas";
import {
  assertLockPrerequisites,
  buildLockSnapshot,
  requireTieBreakerOwned,
  toCompetitionResult,
  toScoring,
  toTeam,
} from "./tie-breaker-foundation";
import { assertTransition } from "./competition";

/**
 * Tie-Breaker Resolver — Lock / finalize service.
 *
 * Workflow: verify status → load teams/results → check counts → resolve via
 * the pure engine → enforce acknowledgments → snapshot branding → allocate
 * record number → single guarded UPDATE (status + record + snapshot together,
 * so no half-locked state exists). Idempotent: repeats return the record.
 */

export interface LockOptions {
  allowIncomplete: boolean;
  allowUnresolved: boolean;
}

export async function lockCompetition(
  supabase: SupabaseClient,
  organizationId: string,
  competitionId: string,
  options: LockOptions,
): Promise<compRepo.TieBreakerCompetitionRow> {
  const competition = requireTieBreakerOwned(
    await compRepo.findTieBreakerCompetitionById(supabase, competitionId),
    organizationId,
  );

  // Idempotent: an already-locked record finalizes exactly once.
  if (competition.status === "locked") return competition;
  assertTransition(competition.status, "locked");

  const [teams, results] = await Promise.all([
    teamRepo.listTieBreakerTeamsByCompetition(supabase, competition.id),
    resultRepo.listTieBreakerResultsByCompetition(supabase, competition.id),
  ]);

  const complete = results.filter((r) => r.is_complete);
  const incompleteCount = results.length - complete.length;

  if (teams.length > TEAMS_MAX) {
    throw validationError("This competition has more than 32 teams and cannot be finished");
  }

  // Count-level prerequisites first (clean errors before engine contract checks).
  assertLockPrerequisites({
    teamCount: teams.length,
    completeResultCount: complete.length,
    incompleteResultCount: 0,
    unresolvedGroupCount: 0,
    ruleOrder: competition.rule_order,
    allowIncomplete: true,
    allowUnresolved: true,
  });

  const scoring = toScoring(competition);
  const standings = resolveStandings({
    teams: teams.map(toTeam),
    results: results.map(toCompetitionResult),
    scoring,
    ruleOrder: competition.rule_order as ("points" | "h2h" | "map_diff" | "round_diff" | "wins")[],
  });

  // Acknowledgment prerequisites (incomplete + unresolved).
  assertLockPrerequisites({
    teamCount: teams.length,
    completeResultCount: complete.length,
    incompleteResultCount: incompleteCount,
    unresolvedGroupCount: standings.tieGroups.length,
    ruleOrder: competition.rule_order,
    allowIncomplete: options.allowIncomplete,
    allowUnresolved: options.allowUnresolved,
  });

  const org = await findOrganizationById(supabase, organizationId);
  const teamNames: Record<string, string> = {};
  for (const t of teams) teamNames[t.id] = t.name;

  const recordNumber = await compRepo.allocateTieBreakerRecordNumber(supabase);
  const lockedAt = new Date().toISOString();
  const snapshot = buildLockSnapshot({
    competitionName: competition.name,
    description: competition.description,
    recordNumber,
    lockedAt,
    ruleOrder: competition.rule_order,
    scoring,
    standings,
    teamNames,
    organizationName: org?.name ?? "Your workspace",
    organizationLogoUrl: (org as { logo_url?: string | null } | null)?.logo_url ?? null,
  });

  const locked = await compRepo.lockTieBreakerCompetition(supabase, {
    id: competition.id,
    recordNumber,
    lockedAt,
    snapshot: snapshot as unknown as Record<string, unknown>,
  });

  // Lost a concurrent race: the winner's record is the official one.
  if (!locked) {
    return requireTieBreakerOwned(await compRepo.findTieBreakerCompetitionById(supabase, competition.id), organizationId);
  }
  return locked;
}
