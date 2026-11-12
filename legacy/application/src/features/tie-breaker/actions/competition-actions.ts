"use server";

import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import {
  createCompetition,
  deleteCompetition,
  updateCompetition,
} from "../services/competition";
import { getHistory } from "../services/history";
import { copyCompetitionForNext } from "../services/copy";
import { lockCompetition } from "../services/lock";
import { isTieBreakerQuotaError } from "@/server/services/tie-breaker-policy";
import { getLockedRecord, getStandings } from "../services/standings";
import type { RuleId } from "../types";
import { TIE_BREAKER_TOOL_SLUG } from "../tool-slug";
import { claimFreeTool } from "@/server/services/tool-claim";

type ActionResult = { error?: string; fieldErrors?: Record<string, string[]>; competitionId?: string; recordNumber?: string; quotaLimited?: boolean };

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
  console.error("[tie-breaker competition action] unexpected", e);
  return { error: fallback };
}

async function orgContext(orgSlug: string) {
  if (!orgSlug) throw new AppError({ code: "VALIDATION_ERROR", status: 400, message: "Missing organization", safeMessage: "Missing organization" });
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, TIE_BREAKER_TOOL_SLUG);
  return ctx;
}

export interface CompetitionConfigInput {
  orgSlug: string;
  name: string;
  description: string | null;
  scoring: { win: number; draw: number; loss: number; drawsEnabled: boolean; roundLabel: "rounds" | "games" };
  ruleOrder: RuleId[];
  presetRef: "round_robin" | "group_stage" | "swiss_lite" | null;
}

export async function createCompetitionAction(input: CompetitionConfigInput): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const competition = await createCompetition(supabase, ctx.organization.id, ctx.user.id, {
      name: input.name,
      description: input.description,
      scoring: input.scoring,
      ruleOrder: input.ruleOrder,
      presetRef: input.presetRef,
    });
    return { competitionId: competition.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function updateCompetitionAction(
  input: CompetitionConfigInput & { competitionId: string },
): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await updateCompetition(supabase, ctx.organization.id, input.competitionId, {
      name: input.name,
      description: input.description,
      scoring: input.scoring,
      ruleOrder: input.ruleOrder,
      presetRef: input.presetRef,
    });
    return { competitionId: input.competitionId };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function deleteCompetitionAction(input: { orgSlug: string; competitionId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await deleteCompetition(supabase, ctx.organization.id, input.competitionId);
    return {};
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function lockCompetitionAction(input: {
  orgSlug: string;
  competitionId: string;
  allowIncomplete: boolean;
  allowUnresolved: boolean;
}): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const locked = await lockCompetition(supabase, ctx.organization.id, input.competitionId, {
      allowIncomplete: input.allowIncomplete,
      allowUnresolved: input.allowUnresolved,
    }, ctx.user.id);
    return {
      competitionId: locked.id,
      ...(locked.record_number ? { recordNumber: locked.record_number } : {}),
    };
  } catch (e) {
    // Quota rejections carry an upgrade affordance for the dialog; every
    // other error keeps the existing safe-message behavior.
    if (isTieBreakerQuotaError(e)) {
      return { error: (e as AppError).safeMessage, quotaLimited: true };
    }
    return toResult(e, "Something went wrong. Please try again.");
  }
}

/**
 * Claim Free Tie-Breaker for the workspace (no payment, no order).
 * Thin alias over the generic claim dispatch — same boundary as the
 * Sponsorship claim alias (membership first, org-scoped issuance only,
 * never downgrades paid).
 */
export async function claimFreeTieBreakerAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(TIE_BREAKER_TOOL_SLUG, orgSlug);
}

export async function copyCompetitionAction(input: {
  orgSlug: string;
  competitionId: string;
  teamIds?: string[];
}): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const { competition } = await copyCompetitionForNext(supabase, ctx.organization.id, ctx.user.id, input.competitionId, {
      ...(input.teamIds ? { teamIds: input.teamIds } : {}),
    });
    return { competitionId: competition.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function getHistoryAction(input: {
  orgSlug: string;
  search?: string;
  status?: "draft" | "active" | "locked";
}): Promise<DataResult<{ competitions: unknown[]; total: number }>> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const history = await getHistory(supabase, ctx.organization.id, {
      ...(input.search !== undefined ? { search: input.search } : {}),
      ...(input.status ? { status: input.status } : {}),
    });
    return { competitions: history.competitions, total: history.total };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function getStandingsAction(input: {
  orgSlug: string;
  competitionId: string;
}): Promise<DataResult<{ competition: unknown; standings: unknown }>> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const { competition, standings } = await getStandings(supabase, ctx.organization.id, input.competitionId);
    return { competition, standings };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function getLockedRecordAction(input: {
  orgSlug: string;
  competitionId: string;
}): Promise<DataResult<{ record: unknown }>> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const record = await getLockedRecord(supabase, ctx.organization.id, input.competitionId);
    return { record };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}
