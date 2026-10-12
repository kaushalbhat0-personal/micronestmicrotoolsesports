"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { PAYOUT_TRACKER_TOOL_SLUG } from "../tool-slug";
import { addRecipient, removeRecipient, setRecipientStatus, updateRecipient } from "../services/recipient-service";
import type { AddRecipientInput, UpdateRecipientInput } from "../schemas";

type ActionResult = { error?: string; fieldErrors?: Record<string, string[]>; recipientId?: string };

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
  console.error("[payout-tracker recipient action] unexpected", e);
  return { error: fallback };
}

async function orgContext(orgSlug: string) {
  if (!orgSlug) throw new AppError({ code: "VALIDATION_ERROR", status: 400, message: "Missing organization", safeMessage: "Missing organization" });
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, PAYOUT_TRACKER_TOOL_SLUG);
  return ctx;
}

function revalidateDetail(orgSlug: string, trackerId: string) {
  revalidatePath(`/dashboard/${orgSlug}/payout-tracker`);
  revalidatePath(`/dashboard/${orgSlug}/payout-tracker/${trackerId}`);
}

export async function addRecipientAction(
  input: { orgSlug: string; trackerId: string } & AddRecipientInput,
): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const recipient = await addRecipient(supabase, ctx.organization.id, ctx.user.id, input.trackerId, {
      name: input.name,
      amountMajor: input.amountMajor,
      referenceLast4: input.referenceLast4,
      proofUrl: input.proofUrl,
    });
    revalidateDetail(input.orgSlug, input.trackerId);
    return { recipientId: recipient.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function updateRecipientAction(
  input: { orgSlug: string; trackerId: string; recipientId: string } & UpdateRecipientInput,
): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await updateRecipient(supabase, ctx.organization.id, ctx.user.id, input.trackerId, input.recipientId, {
      name: input.name,
      amountMajor: input.amountMajor,
      referenceLast4: input.referenceLast4,
      proofUrl: input.proofUrl,
    });
    revalidateDetail(input.orgSlug, input.trackerId);
    return { recipientId: input.recipientId };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function removeRecipientAction(input: {
  orgSlug: string;
  trackerId: string;
  recipientId: string;
}): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await removeRecipient(supabase, ctx.organization.id, ctx.user.id, input.trackerId, input.recipientId);
    revalidateDetail(input.orgSlug, input.trackerId);
    return {};
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function setRecipientStatusAction(input: {
  orgSlug: string;
  trackerId: string;
  recipientId: string;
  status: "pending" | "paid";
}): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await setRecipientStatus(supabase, ctx.organization.id, ctx.user.id, input.trackerId, input.recipientId, input.status);
    revalidateDetail(input.orgSlug, input.trackerId);
    return { recipientId: input.recipientId };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}
