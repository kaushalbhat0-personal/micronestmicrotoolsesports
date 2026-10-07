import type { SupabaseClient } from "@supabase/supabase-js";
import { validationError } from "@/lib/errors";
import type { StandingsResult } from "../types";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import { requireTieBreakerOwned, resolveOwnedCompetition } from "./tie-breaker-foundation";

/**
 * Tie-Breaker Resolver — Standings service.
 * Thin boundary: loads owned rows, invokes the one authoritative engine.
 * Live standings are always derived; only the locked snapshot is persisted.
 */

export async function getStandings(
  supabase: SupabaseClient,
  organizationId: string,
  competitionId: string,
): Promise<{ competition: compRepo.TieBreakerCompetitionRow; standings: StandingsResult }> {
  return resolveOwnedCompetition(supabase, organizationId, competitionId);
}

/** Returns the frozen official record. Rejects anything not yet locked. */
export async function getLockedRecord(supabase: SupabaseClient, organizationId: string, competitionId: string) {
  const row = requireTieBreakerOwned(
    await compRepo.findTieBreakerCompetitionById(supabase, competitionId),
    organizationId,
  );
  if (row.status !== "locked" || !row.locked_snapshot || !row.record_number) {
    throw validationError("This competition has no official result yet. Finish and lock it first");
  }
  return row;
}
