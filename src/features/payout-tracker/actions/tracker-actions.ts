"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { isPayoutTrackerQuotaError } from "@/server/services/payout-tracker-policy";
import { PAYOUT_TRACKER_TOOL_SLUG } from "../tool-slug";
import {
  createTracker,
  deleteTracker,
  publishTracker,
  revokeShareLink,
  updateTracker,
} from "../services/tracker-service";
import type { CreateTrackerInput, UpdateTrackerInput } from "../schemas";

type ActionResult = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  trackerId?: string;
  shareToken?: string;
  quotaLimited?: boolean;
};

function toResult(e: unknown, fallback: string): { error: string; fieldErrors?: Record<string, string[]>; quotaLimited?: boolean } {
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
      const quotaLimited = isPayoutTrackerQuotaError(e);
      if (fieldErrors) return { error: msg, fieldErrors, quotaLimited };
      return { error: msg, quotaLimited };
    }
    console.warn(`[AppError ${e.code}]`, e.safeMessage);
    return { error: e.safeMessage };
  }
  console.error("[payout-tracker action] unexpected", e);
  return { error: fallback };
}

async function orgContext(orgSlug: string) {
  if (!orgSlug) throw new AppError({ code: "VALIDATION_ERROR", status: 400, message: "Missing organization", safeMessage: "Missing organization" });
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, PAYOUT_TRACKER_TOOL_SLUG);
  return ctx;
}

function revalidateWorkspace(orgSlug: string, trackerId?: string) {
  revalidatePath(`/dashboard/${orgSlug}/payout-tracker`);
  if (trackerId) revalidatePath(`/dashboard/${orgSlug}/payout-tracker/${trackerId}`);
}

export async function createTrackerAction(input: { orgSlug: string } & CreateTrackerInput): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const { tracker } = await createTracker(supabase, ctx.organization.id, ctx.user.id, {
      eventName: input.eventName,
      currency: input.currency,
      deadline: input.deadline,
      recipients: input.recipients,
    });
    revalidateWorkspace(input.orgSlug);
    return { trackerId: tracker.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function updateTrackerAction(
  input: { orgSlug: string; trackerId: string } & UpdateTrackerInput,
): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await updateTracker(supabase, ctx.organization.id, input.trackerId, {
      eventName: input.eventName,
      deadline: input.deadline,
    });
    revalidateWorkspace(input.orgSlug, input.trackerId);
    return { trackerId: input.trackerId };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function deleteTrackerAction(input: { orgSlug: string; trackerId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await deleteTracker(supabase, ctx.organization.id, input.trackerId);
    revalidateWorkspace(input.orgSlug);
    return {};
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function publishTrackerAction(input: { orgSlug: string; trackerId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const tracker = await publishTracker(supabase, ctx.organization.id, ctx.user.id, input.trackerId);
    revalidateWorkspace(input.orgSlug, input.trackerId);
    return { trackerId: tracker.id, shareToken: tracker.share_token };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function revokeShareLinkAction(input: { orgSlug: string; trackerId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const tracker = await revokeShareLink(supabase, ctx.organization.id, ctx.user.id, input.trackerId);
    revalidateWorkspace(input.orgSlug, input.trackerId);
    return { trackerId: tracker.id, shareToken: tracker.share_token };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}
