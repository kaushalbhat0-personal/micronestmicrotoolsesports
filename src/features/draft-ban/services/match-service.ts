import type { SupabaseClient } from "@supabase/supabase-js";
import { conflictError, forbiddenError, notFoundError, validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import * as matchRepo from "@/server/repositories/draft-matches";
import * as templateRepo from "@/server/repositories/draft-templates";
import { applyActionInputSchema, createMatchInputSchema } from "../schemas/draft-config";
import { applyAction, isComplete, validateConfig } from "./draft-engine";
import type { DraftState } from "../types";

export type MatchStatus = "in_progress" | "completed" | "abandoned";

const ALLOWED: Record<MatchStatus, MatchStatus[]> = {
  in_progress: ["completed", "abandoned"],
  completed: [],
  abandoned: [],
};

export function canTransition(from: MatchStatus, to: MatchStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: MatchStatus, to: MatchStatus): void {
  if (from === to) return;
  if (!canTransition(from, to)) throw validationError(`Invalid status transition ${from} → ${to}`);
}

function toEngineState(row: matchRepo.DraftMatchRow): DraftState {
  return {
    config: { teamA: row.team_a, teamB: row.team_b, pool: [...row.pool], sequence: row.sequence.map((s) => ({ team: s.team, type: s.type })) },
    actions: row.actions.map((a) => ({ stepIndex: a.stepIndex, team: a.team, type: a.type, item: a.item, at: a.at })),
  };
}

function requireOwned<T extends { organization_id: string }>(row: T | null, organizationId: string, label = "Draft match not found"): T {
  if (!row) throw notFoundError(label);
  if (row.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  return row;
}

export async function createMatch(supabase: SupabaseClient, organizationId: string, userId: string, rawInput: unknown) {
  if (!organizationId) throw validationError("Missing organization");
  const input = parseOrThrow(createMatchInputSchema, rawInput);
  const configCheck = validateConfig({ teamA: input.teamA, teamB: input.teamB, pool: input.pool, sequence: input.sequence });
  if (!configCheck.valid) throw validationError(configCheck.errors[0] ?? "Invalid draft configuration");

  let templateId: string | null = null;
  if (input.templateId) {
    const template = requireOwned(await templateRepo.findDraftTemplateById(supabase, input.templateId), organizationId, "Template not found");
    templateId = template.id;
  }

  return matchRepo.createDraftMatch(supabase, {
    organization_id: organizationId,
    created_by: userId,
    match_name: input.matchName?.trim() ? input.matchName.trim() : null,
    event_name: input.eventName?.trim() ? input.eventName.trim() : null,
    format_label: input.formatLabel?.trim() ? input.formatLabel.trim() : null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    team_a: input.teamA.trim(),
    team_b: input.teamB.trim(),
    template_id: templateId,
    sequence: input.sequence.map((s) => ({ team: s.team, type: s.type })),
    pool: input.pool.map((p) => p.trim()),
    cloned_from: null,
  });
}

export async function getMatch(supabase: SupabaseClient, organizationId: string, matchId: string) {
  return requireOwned(await matchRepo.findDraftMatchById(supabase, matchId), organizationId);
}

export async function listMatches(supabase: SupabaseClient, organizationId: string, limit = 50) {
  const [matches, total] = await Promise.all([
    matchRepo.listDraftMatchesByOrg(supabase, organizationId, limit),
    matchRepo.countDraftMatchesByOrg(supabase, organizationId),
  ]);
  return { matches, total };
}

export async function applyMatchAction(supabase: SupabaseClient, organizationId: string, rawInput: unknown) {
  const input = parseOrThrow(applyActionInputSchema, rawInput);
  const row = requireOwned(await matchRepo.findDraftMatchById(supabase, input.matchId), organizationId);
  if (row.status !== "in_progress") throw validationError(`Only in-progress drafts accept actions (current: ${row.status})`);
  if (row.actions.length !== input.expectedActionCount) {
    throw conflictError("This draft changed in another tab. Reload to see the latest state, then try again.");
  }
  const state = toEngineState(row);
  const result = applyAction(state, { team: input.team, item: input.item });
  if (!result.ok) {
    if (result.error.code === "DRAFT_COMPLETE") throw validationError(result.error.message);
    throw validationError(result.error.message);
  }
  return matchRepo.appendDraftAction(
    supabase,
    row.id,
    result.state.actions.map((a) => ({ stepIndex: a.stepIndex, team: a.team, type: a.type, item: a.item, at: a.at })),
  );
}

export async function undoMatchAction(supabase: SupabaseClient, organizationId: string, matchId: string, expectedActionCount: number) {
  const row = requireOwned(await matchRepo.findDraftMatchById(supabase, matchId), organizationId);
  if (row.status !== "in_progress") throw validationError("Completed records cannot be changed. Duplicate the match to correct it.");
  if (row.actions.length !== expectedActionCount) {
    throw conflictError("This draft changed in another tab. Reload to see the latest state, then try again.");
  }
  if (row.actions.length === 0) throw validationError("Nothing to undo yet.");
  return matchRepo.appendDraftAction(supabase, row.id, row.actions.slice(0, -1));
}

export async function resetMatchActions(supabase: SupabaseClient, organizationId: string, matchId: string) {
  const row = requireOwned(await matchRepo.findDraftMatchById(supabase, matchId), organizationId);
  if (row.status !== "in_progress") throw validationError("Completed records cannot be changed. Duplicate the match to correct it.");
  if (row.actions.length === 0) return row;
  return matchRepo.appendDraftAction(supabase, row.id, []);
}

export async function finalizeMatch(supabase: SupabaseClient, organizationId: string, matchId: string) {
  const row = requireOwned(await matchRepo.findDraftMatchById(supabase, matchId), organizationId);
  // Idempotent: a completed record finalizes exactly once; repeats return the locked record
  // instead of tripping the completed-row immutability guard with a confusing error.
  if (row.status === "completed") return row;
  assertTransition(row.status as MatchStatus, "completed");
  const state = toEngineState(row);
  if (!isComplete(state)) throw validationError(`Draft is not complete (${row.actions.length} of ${row.sequence.length} steps done)`);
  const configCheck = validateConfig(state.config);
  if (!configCheck.valid) throw validationError(configCheck.errors[0] ?? "Invalid draft configuration");
  return matchRepo.finalizeDraftMatch(supabase, row.id, new Date().toISOString());
}

export async function abandonMatch(supabase: SupabaseClient, organizationId: string, matchId: string) {
  const row = requireOwned(await matchRepo.findDraftMatchById(supabase, matchId), organizationId);
  assertTransition(row.status as MatchStatus, "abandoned");
  return matchRepo.abandonDraftMatch(supabase, row.id);
}

export async function deleteMatch(supabase: SupabaseClient, organizationId: string, matchId: string) {
  requireOwned(await matchRepo.findDraftMatchById(supabase, matchId), organizationId);
  await matchRepo.deleteDraftMatch(supabase, matchId);
}

export async function duplicateMatch(supabase: SupabaseClient, organizationId: string, userId: string, matchId: string) {
  const row = requireOwned(await matchRepo.findDraftMatchById(supabase, matchId), organizationId);
  // New lifecycle: fresh in-progress match with frozen config copied, new ref_code + share_token (DB defaults).
  return matchRepo.createDraftMatch(supabase, {
    organization_id: organizationId,
    created_by: userId,
    match_name: row.match_name,
    event_name: row.event_name,
    format_label: row.format_label,
    notes: row.notes,
    team_a: row.team_a,
    team_b: row.team_b,
    template_id: row.template_id,
    sequence: row.sequence.map((s) => ({ team: s.team, type: s.type })),
    pool: [...row.pool],
    cloned_from: row.id,
  });
}
