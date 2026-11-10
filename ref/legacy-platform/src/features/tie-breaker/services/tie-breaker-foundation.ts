import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, notFoundError, validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { competitionSchema } from "../schemas";
import type { CompetitionResult, LockSnapshot, ScoringConfig, StandingsResult, Team } from "../types";
import { DEFAULT_SCORING } from "../types";
import { resolveStandings } from "../engine/resolve";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import * as teamRepo from "@/server/repositories/tie-breaker-teams";
import * as resultRepo from "@/server/repositories/tie-breaker-results";

/**
 * Tie-Breaker Resolver — Service foundation (RCCF-TIEBREAKER-04).
 *
 * Establishes the validation boundary, ownership checks, engine invocation,
 * lock prerequisites, and snapshot construction. Full dashboard workflows
 * (team/result CRUD actions, copy, history search) arrive in phase 05.
 */

export function requireTieBreakerOwned<T extends { organization_id: string }>(
  row: T | null,
  organizationId: string,
  label = "Competition not found",
): T {
  if (!row) throw notFoundError(label);
  if (row.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  return row;
}

export function toScoring(row: compRepo.TieBreakerCompetitionRow): ScoringConfig {
  return {
    win: row.scoring_win,
    draw: row.scoring_draw,
    loss: row.scoring_loss,
    drawsEnabled: row.draws_enabled,
    roundLabel: row.round_label,
  };
}

export function toTeam(row: teamRepo.TieBreakerTeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    ...(row.short_name ? { shortName: row.short_name } : {}),
    ...(row.logo_url ? { logoUrl: row.logo_url } : {}),
  };
}

export function toCompetitionResult(row: resultRepo.TieBreakerResultRow): CompetitionResult {
  const base = {
    id: row.id,
    teamAId: row.team_a_id,
    teamBId: row.team_b_id,
    isComplete: row.is_complete,
  };
  if (row.winner === "draw") {
    return {
      ...base,
      outcome: { kind: "draw" as const },
      ...(row.maps_a !== null ? { mapsA: row.maps_a } : {}),
      ...(row.maps_b !== null ? { mapsB: row.maps_b } : {}),
      ...(row.rounds_a !== null ? { roundsA: row.rounds_a } : {}),
      ...(row.rounds_b !== null ? { roundsB: row.rounds_b } : {}),
    };
  }
  return {
    ...base,
    outcome: {
      kind: "win" as const,
      winnerTeamId: row.winner === "team_b" ? row.team_b_id : row.team_a_id,
    },
    ...(row.maps_a !== null ? { mapsA: row.maps_a } : {}),
    ...(row.maps_b !== null ? { mapsB: row.maps_b } : {}),
    ...(row.rounds_a !== null ? { roundsA: row.rounds_a } : {}),
    ...(row.rounds_b !== null ? { roundsB: row.rounds_b } : {}),
  };
}

/** Pure: translate competition setup input into the repository create shape. */
export function toCreateCompetitionInput(
  organizationId: string,
  userId: string,
  rawInput: unknown,
): compRepo.CreateTieBreakerCompetitionInput {
  const input = parseOrThrow(competitionSchema, rawInput);
  return {
    organization_id: organizationId,
    created_by: userId,
    name: input.name.trim(),
    description: input.description?.trim() ? input.description.trim() : null,
    scoring_win: input.scoring.win,
    scoring_draw: input.scoring.draw,
    scoring_loss: input.scoring.loss,
    draws_enabled: input.scoring.drawsEnabled,
    round_label: input.scoring.roundLabel,
    rule_order: [...input.ruleOrder],
    preset_ref: input.presetRef,
    cloned_from: null,
  };
}

/** Loads owned rows and invokes the pure engine. Never computes rankings inline. */
export async function resolveOwnedCompetition(
  supabase: SupabaseClient,
  organizationId: string,
  competitionId: string,
): Promise<{ competition: compRepo.TieBreakerCompetitionRow; standings: StandingsResult }> {
  const competition = requireTieBreakerOwned(
    await compRepo.findTieBreakerCompetitionById(supabase, competitionId),
    organizationId,
  );
  if (competition.status === "locked") throw validationError("This is a locked official result and cannot be changed");
  const [teams, results] = await Promise.all([
    teamRepo.listTieBreakerTeamsByCompetition(supabase, competitionId),
    resultRepo.listTieBreakerResultsByCompetition(supabase, competitionId),
  ]);
  const standings = resolveStandings({
    teams: teams.map(toTeam),
    results: results.map(toCompetitionResult),
    scoring: toScoring(competition),
    ruleOrder: competition.rule_order as StandingsResult["rulesApplied"],
  });
  return { competition, standings };
}

export interface LockChecks {
  readonly teamCount: number;
  readonly completeResultCount: number;
  readonly incompleteResultCount: number;
  readonly unresolvedGroupCount: number;
  readonly ruleOrder: readonly string[];
  readonly allowIncomplete: boolean;
  readonly allowUnresolved: boolean;
}

/** Lock prerequisites with customer-safe messages. Throws on the first blocker. */
export function assertLockPrerequisites(checks: LockChecks): void {
  if (checks.teamCount < 2) throw validationError("Add at least 2 teams before finishing");
  if (checks.completeResultCount < 1) throw validationError("Enter at least one completed result before finishing");
  if (!checks.ruleOrder.includes("points")) throw validationError("Points must stay in your ranking rules");
  if (checks.ruleOrder.length < 2) throw validationError("Choose at least 2 ranking rules before finishing");
  if (checks.incompleteResultCount > 0 && !checks.allowIncomplete) {
    throw validationError("Some results are incomplete and will not be counted. Review them or confirm to continue");
  }
  if (checks.unresolvedGroupCount > 0 && !checks.allowUnresolved) {
    throw validationError("Some teams remain tied under your rules. Confirm to finish with the tie marked as official");
  }
}

/** Pure: build the frozen official snapshot stored at lock time. */
export function buildLockSnapshot(input: {
  competitionName: string;
  description: string | null;
  recordNumber: string;
  lockedAt: string;
  ruleOrder: readonly string[];
  scoring: ScoringConfig;
  standings: StandingsResult;
  teamNames: Readonly<Record<string, string>>;
  organizationName: string;
  organizationLogoUrl: string | null;
}): LockSnapshot {
  return {
    competitionName: input.competitionName,
    ...(input.description ? { description: input.description } : {}),
    recordNumber: input.recordNumber,
    lockedAt: input.lockedAt,
    ruleOrder: [...input.ruleOrder] as LockSnapshot["ruleOrder"],
      scoring: { ...input.scoring },
      standings: [...input.standings.entries],
      explanations: [...input.standings.explanations],
      teamNames: { ...input.teamNames },
      organizationName: input.organizationName,
    ...(input.organizationLogoUrl ? { organizationLogoUrl: input.organizationLogoUrl } : {}),
  };
}

export function defaultScoring(): ScoringConfig {
  return { ...DEFAULT_SCORING };
}
