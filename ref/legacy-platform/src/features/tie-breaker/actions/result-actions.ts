"use server";

import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { addResult, deleteResult, listResults, updateResult } from "../services/results";
import { TIE_BREAKER_TOOL_SLUG } from "../tool-slug";

type ActionResult = { error?: string; fieldErrors?: Record<string, string[]>; resultId?: string; duplicatePair?: boolean };

type DataResult<T> = { error?: string; fieldErrors?: Record<string, string[]> } | ({ error?: undefined } & T);

function toResult(e: unknown, fallback: string): { error: string; fieldErrors?: Record<string, string[]> } {
  if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
  if (e instanceof AppError) {
    if (e.code === "VALIDATION_ERROR") {
      const details = e.details as { fieldErrors?: Record<string, string[]> } | undefined;
      const fieldErrors = details?.fieldErrors;
      let msg = e.safeMessage;
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        msg = Object.entries(fieldErrors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
      }
      console.warn(`[AppError ${e.code}]`, msg);
      if (fieldErrors) return { error: msg, fieldErrors };
      return { error: msg };
    }
    console.warn(`[AppError ${e.code}]`, e.safeMessage);
    return { error: e.safeMessage };
  }
  console.error("[tie-breaker result action] unexpected", e);
  return { error: fallback };
}

async function orgContext(orgSlug: string) {
  if (!orgSlug) throw new AppError({ code: "VALIDATION_ERROR", status: 400, message: "Missing organization", safeMessage: "Missing organization" });
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, TIE_BREAKER_TOOL_SLUG);
  return ctx;
}

export interface ResultInput {
  orgSlug: string;
  competitionId: string;
  teamAId: string;
  teamBId: string;
  winnerTeamId: string | null;
  isDraw: boolean;
  mapsA: number | null;
  mapsB: number | null;
  roundsA: number | null;
  roundsB: number | null;
  playedAt: string | null;
  notes: string | null;
}

function toServiceInput(input: ResultInput) {
  return {
    teamAId: input.teamAId,
    teamBId: input.teamBId,
    winnerTeamId: input.winnerTeamId,
    isDraw: input.isDraw,
    mapsA: input.mapsA,
    mapsB: input.mapsB,
    roundsA: input.roundsA,
    roundsB: input.roundsB,
    playedAt: input.playedAt,
    notes: input.notes,
  };
}

export async function addResultAction(input: ResultInput): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const { result, duplicatePair } = await addResult(supabase, ctx.organization.id, ctx.user.id, input.competitionId, toServiceInput(input));
    return { resultId: result.id, duplicatePair };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function updateResultAction(input: ResultInput & { resultId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const { duplicatePair } = await updateResult(supabase, ctx.organization.id, input.competitionId, input.resultId, toServiceInput(input));
    return { resultId: input.resultId, duplicatePair };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function deleteResultAction(input: {
  orgSlug: string;
  competitionId: string;
  resultId: string;
}): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await deleteResult(supabase, ctx.organization.id, input.competitionId, input.resultId);
    return {};
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function listResultsAction(input: {
  orgSlug: string;
  competitionId: string;
}): Promise<DataResult<{ results: unknown[]; duplicatePairIds: string[] }>> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const { results, duplicatePairIds } = await listResults(supabase, ctx.organization.id, input.competitionId);
    return { results, duplicatePairIds };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}
