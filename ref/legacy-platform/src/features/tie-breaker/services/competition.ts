import type { SupabaseClient } from "@supabase/supabase-js";
import { validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { competitionSchema } from "../schemas";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import { requireTieBreakerOwned, toCreateCompetitionInput } from "./tie-breaker-foundation";

/**
 * Tie-Breaker Resolver — Competition service.
 *
 * Lifecycle: draft → active → locked. Review is a UI step over an active
 * competition, not a stored status. Draft means no completed results yet;
 * the first completed result promotes the competition to active.
 */

export type TieBreakerLifecycle = "draft" | "active" | "locked";

const ALLOWED: Record<TieBreakerLifecycle, TieBreakerLifecycle[]> = {
  draft: ["active"],
  active: ["locked"],
  locked: [],
};

export function canTransition(from: TieBreakerLifecycle, to: TieBreakerLifecycle): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: TieBreakerLifecycle, to: TieBreakerLifecycle): void {
  if (from === to) return;
  if (from === "locked") throw validationError("This is a locked official result and cannot be changed");
  if (from === "draft" && to === "locked") {
    throw validationError("Enter at least one completed result before finishing");
  }
  if (!canTransition(from, to)) throw validationError("This competition cannot be changed right now");
}

export function requireUnlocked<T extends { status: TieBreakerLifecycle }>(row: T): T {
  if (row.status === "locked") throw validationError("This is a locked official result and cannot be changed");
  return row;
}

export async function createCompetition(supabase: SupabaseClient, organizationId: string, userId: string, rawInput: unknown) {
  if (!organizationId) throw validationError("Missing organization");
  return compRepo.createTieBreakerCompetition(supabase, toCreateCompetitionInput(organizationId, userId, rawInput));
}

export async function getCompetition(supabase: SupabaseClient, organizationId: string, competitionId: string) {
  return requireTieBreakerOwned(await compRepo.findTieBreakerCompetitionById(supabase, competitionId), organizationId);
}

export async function updateCompetition(
  supabase: SupabaseClient,
  organizationId: string,
  competitionId: string,
  rawInput: unknown,
) {
  const row = requireUnlocked(await getCompetition(supabase, organizationId, competitionId));
  const input = parseOrThrow(competitionSchema, rawInput);
  return compRepo.updateTieBreakerCompetition(supabase, row.id, {
    name: input.name.trim(),
    description: input.description?.trim() ? input.description.trim() : null,
    scoring_win: input.scoring.win,
    scoring_draw: input.scoring.draw,
    scoring_loss: input.scoring.loss,
    draws_enabled: input.scoring.drawsEnabled,
    round_label: input.scoring.roundLabel,
    rule_order: [...input.ruleOrder],
    preset_ref: input.presetRef,
  });
}

export async function deleteCompetition(supabase: SupabaseClient, organizationId: string, competitionId: string) {
  const row = await getCompetition(supabase, organizationId, competitionId);
  if (row.status === "locked") {
    throw validationError("Official results are kept for your records and cannot be deleted");
  }
  await compRepo.deleteTieBreakerCompetition(supabase, row.id);
}

/** Promotes draft → active when the first completed result lands. Never demotes. */
export async function promoteToActiveIfNeeded(
  supabase: SupabaseClient,
  row: compRepo.TieBreakerCompetitionRow,
): Promise<compRepo.TieBreakerCompetitionRow> {
  if (row.status !== "draft") return row;
  return compRepo.updateTieBreakerCompetition(supabase, row.id, { status: "active" });
}
