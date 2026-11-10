"use server";

import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { addTeam, listTeams, removeTeam, updateTeam } from "../services/teams";
import { TIE_BREAKER_TOOL_SLUG } from "../tool-slug";

type ActionResult = { error?: string; fieldErrors?: Record<string, string[]>; teamId?: string };

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
  console.error("[tie-breaker team action] unexpected", e);
  return { error: fallback };
}

async function orgContext(orgSlug: string) {
  if (!orgSlug) throw new AppError({ code: "VALIDATION_ERROR", status: 400, message: "Missing organization", safeMessage: "Missing organization" });
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, TIE_BREAKER_TOOL_SLUG);
  return ctx;
}

export interface TeamInput {
  orgSlug: string;
  competitionId: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
}

export async function addTeamAction(input: TeamInput): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const team = await addTeam(supabase, ctx.organization.id, input.competitionId, {
      name: input.name,
      shortName: input.shortName,
      logoUrl: input.logoUrl,
    });
    return { teamId: team.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function updateTeamAction(input: TeamInput & { teamId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await updateTeam(supabase, ctx.organization.id, input.competitionId, input.teamId, {
      name: input.name,
      shortName: input.shortName,
      logoUrl: input.logoUrl,
    });
    return { teamId: input.teamId };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function removeTeamAction(input: { orgSlug: string; competitionId: string; teamId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await removeTeam(supabase, ctx.organization.id, input.competitionId, input.teamId);
    return {};
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function listTeamsAction(input: {
  orgSlug: string;
  competitionId: string;
}): Promise<DataResult<{ teams: unknown[] }>> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const teams = await listTeams(supabase, ctx.organization.id, input.competitionId);
    return { teams };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}
