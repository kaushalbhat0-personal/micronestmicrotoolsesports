"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { claimFreeTool } from "@/server/services/tool-claim";
import { DRAFT_BAN_TOOL_SLUG, isDraftBanQuotaError } from "@/server/services/draft-ban-policy";
import { abandonMatch, applyMatchAction, createMatch, deleteMatch, duplicateMatch, finalizeMatch, resetMatchActions, undoMatchAction } from "../services/match-service";

type ActionResult = { error?: string; matchId?: string; quotaLimited?: boolean };

function toResult(e: unknown, fallback: string): ActionResult {
  if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
  if (e instanceof AppError) {
    console.warn(`[AppError ${e.code}]`, e.safeMessage);
    return { error: e.safeMessage };
  }
  console.error("[draft-ban match action] unexpected", e);
  return { error: fallback };
}

async function orgContext(orgSlug: string) {
  if (!orgSlug) throw new AppError({ code: "VALIDATION_ERROR", status: 400, message: "Missing organization", safeMessage: "Missing organization" });
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "draft-ban");
  return ctx;
}

export async function createDraftMatchAction(input: {
  orgSlug: string;
  teamA: string;
  teamB: string;
  pool: string[];
  sequence: Array<{ team: "A" | "B"; type: "ban" | "pick" }>;
  templateId: string | null;
  matchName: string | null;
  eventName: string | null;
  formatLabel: string | null;
  notes: string | null;
}): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const match = await createMatch(supabase, ctx.organization.id, ctx.user.id, {
      teamA: input.teamA,
      teamB: input.teamB,
      pool: input.pool,
      sequence: input.sequence,
      templateId: input.templateId,
      matchName: input.matchName,
      eventName: input.eventName,
      formatLabel: input.formatLabel,
      notes: input.notes,
    });
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban`);
    return { matchId: match.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function applyDraftActionAction(input: { orgSlug: string; matchId: string; team: "A" | "B"; item: string; expectedActionCount: number }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const match = await applyMatchAction(supabase, ctx.organization.id, {
      matchId: input.matchId,
      team: input.team,
      item: input.item,
      expectedActionCount: input.expectedActionCount,
    });
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban/${match.id}`);
    return { matchId: match.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function undoDraftActionAction(input: { orgSlug: string; matchId: string; expectedActionCount: number }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const match = await undoMatchAction(supabase, ctx.organization.id, input.matchId, input.expectedActionCount);
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban/${match.id}`);
    return { matchId: match.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function resetDraftActionsAction(input: { orgSlug: string; matchId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const match = await resetMatchActions(supabase, ctx.organization.id, input.matchId);
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban/${match.id}`);
    return { matchId: match.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function finalizeDraftMatchAction(input: { orgSlug: string; matchId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const match = await finalizeMatch(supabase, ctx.organization.id, input.matchId, ctx.user.id);
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban`);
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban/${match.id}`);
    return { matchId: match.id };
  } catch (e) {
    // Quota rejections carry an upgrade affordance for the workspace; every
    // other error keeps the existing safe-message behavior.
    if (isDraftBanQuotaError(e)) {
      return { error: (e as AppError).safeMessage, quotaLimited: true };
    }
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function abandonDraftMatchAction(input: { orgSlug: string; matchId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const match = await abandonMatch(supabase, ctx.organization.id, input.matchId);
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban`);
    return { matchId: match.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function deleteDraftMatchAction(input: { orgSlug: string; matchId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await deleteMatch(supabase, ctx.organization.id, input.matchId);
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban`);
    return {};
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function duplicateDraftMatchAction(input: { orgSlug: string; matchId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const match = await duplicateMatch(supabase, ctx.organization.id, ctx.user.id, input.matchId);
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban`);
    return { matchId: match.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

/**
 * Claim Free Draft & Ban for the workspace (no payment, no order).
 * Thin alias over the generic claim dispatch — membership first,
 * org-scoped issuance only, never downgrades paid.
 */
export async function claimFreeDraftBanAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(DRAFT_BAN_TOOL_SLUG, orgSlug);
}
