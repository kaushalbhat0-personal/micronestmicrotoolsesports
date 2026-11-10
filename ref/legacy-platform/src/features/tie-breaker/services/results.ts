import type { SupabaseClient } from "@supabase/supabase-js";
import { validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { resultSchema, type ResultInput } from "../schemas";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import * as teamRepo from "@/server/repositories/tie-breaker-teams";
import * as resultRepo from "@/server/repositories/tie-breaker-results";
import { requireTieBreakerOwned } from "./tie-breaker-foundation";
import { promoteToActiveIfNeeded, requireUnlocked } from "./competition";

/**
 * Tie-Breaker Resolver — Result service. Unlocked competitions only.
 * Incomplete results persist but never reach the engine. Duplicate pairs
 * (legs/rematches) are reported, never rejected.
 */

type OwnedCompetition = compRepo.TieBreakerCompetitionRow;

async function ownedCompetition(supabase: SupabaseClient, organizationId: string, competitionId: string): Promise<OwnedCompetition> {
  return requireUnlocked(
    requireTieBreakerOwned(await compRepo.findTieBreakerCompetitionById(supabase, competitionId), organizationId),
  );
}

async function teamIdSet(supabase: SupabaseClient, competitionId: string): Promise<Set<string>> {
  const teams = await teamRepo.listTieBreakerTeamsByCompetition(supabase, competitionId);
  return new Set(teams.map((t) => t.id));
}

function toWinnerEnum(input: ResultInput): resultRepo.TieBreakerWinner | null {
  if (input.isDraw) return "draw";
  if (!input.winnerTeamId) return null;
  return input.winnerTeamId === input.teamAId ? "team_a" : "team_b";
}

interface TieBreakerResultFields {
  team_a_id: string;
  team_b_id: string;
  winner: resultRepo.TieBreakerWinner | null;
  maps_a: number | null;
  maps_b: number | null;
  rounds_a: number | null;
  rounds_b: number | null;
  played_at: string | null;
  notes: string | null;
  is_complete: boolean;
}

function toRowFields(input: ResultInput, isComplete: boolean): TieBreakerResultFields {
  return {
    team_a_id: input.teamAId,
    team_b_id: input.teamBId,
    winner: toWinnerEnum(input),
    maps_a: input.mapsA,
    maps_b: input.mapsB,
    rounds_a: input.roundsA,
    rounds_b: input.roundsB,
    played_at: input.playedAt,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    is_complete: isComplete,
  };
}

async function parseResultFor(
  supabase: SupabaseClient,
  competition: OwnedCompetition,
  rawInput: unknown,
): Promise<{ input: ResultInput; isComplete: boolean }> {
  // drawsEnabled comes from the competition, never from client input.
  const raw = (rawInput ?? {}) as Record<string, unknown>;
  const input = parseOrThrow(resultSchema, { ...raw, drawsEnabled: competition.draws_enabled });
  const ids = await teamIdSet(supabase, competition.id);
  if (!ids.has(input.teamAId) || !ids.has(input.teamBId)) {
    throw validationError("Both teams must belong to this competition");
  }
  return { input, isComplete: input.winnerTeamId !== null || input.isDraw };
}

export interface AddResultOutcome {
  result: resultRepo.TieBreakerResultRow;
  /** True when this pair already has another recorded result (leg/rematch). */
  duplicatePair: boolean;
}

export async function addResult(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  competitionId: string,
  rawInput: unknown,
): Promise<AddResultOutcome> {
  const competition = await ownedCompetition(supabase, organizationId, competitionId);
  const { input, isComplete } = await parseResultFor(supabase, competition, rawInput);
  const existing = await resultRepo.findTieBreakerResultsByPair(supabase, competition.id, input.teamAId, input.teamBId);
  const result = await resultRepo.createTieBreakerResult(supabase, {
    competition_id: competition.id,
    organization_id: organizationId,
    created_by: userId,
    ...toRowFields(input, isComplete),
  });
  if (isComplete) await promoteToActiveIfNeeded(supabase, competition);
  return { result, duplicatePair: existing.length > 0 };
}

export async function updateResult(
  supabase: SupabaseClient,
  organizationId: string,
  competitionId: string,
  resultId: string,
  rawInput: unknown,
): Promise<AddResultOutcome> {
  const competition = await ownedCompetition(supabase, organizationId, competitionId);
  const row = requireTieBreakerOwned(await resultRepo.findTieBreakerResultById(supabase, resultId), organizationId, "Result not found");
  if (row.competition_id !== competition.id) throw validationError("That result does not belong to this competition");
  const { input, isComplete } = await parseResultFor(supabase, competition, rawInput);
  const updated = await resultRepo.updateTieBreakerResult(supabase, row.id, toRowFields(input, isComplete));
  const existing = await resultRepo.findTieBreakerResultsByPair(supabase, competition.id, input.teamAId, input.teamBId);
  if (isComplete) await promoteToActiveIfNeeded(supabase, competition);
  return { result: updated, duplicatePair: existing.some((r) => r.id !== updated.id) };
}

export async function deleteResult(supabase: SupabaseClient, organizationId: string, competitionId: string, resultId: string) {
  const competition = await ownedCompetition(supabase, organizationId, competitionId);
  const row = requireTieBreakerOwned(await resultRepo.findTieBreakerResultById(supabase, resultId), organizationId, "Result not found");
  if (row.competition_id !== competition.id) throw validationError("That result does not belong to this competition");
  await resultRepo.deleteTieBreakerResult(supabase, row.id);
}

export interface ListedResults {
  results: resultRepo.TieBreakerResultRow[];
  /** Ids of results that share their pair with at least one other result. */
  duplicatePairIds: string[];
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export async function listResults(
  supabase: SupabaseClient,
  organizationId: string,
  competitionId: string,
): Promise<ListedResults> {
  requireTieBreakerOwned(await compRepo.findTieBreakerCompetitionById(supabase, competitionId), organizationId);
  const results = await resultRepo.listTieBreakerResultsByCompetition(supabase, competitionId);
  const counts = new Map<string, number>();
  for (const r of results) {
    const key = pairKey(r.team_a_id, r.team_b_id);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return {
    results,
    duplicatePairIds: results.filter((r) => (counts.get(pairKey(r.team_a_id, r.team_b_id)) ?? 0) > 1).map((r) => r.id),
  };
}
