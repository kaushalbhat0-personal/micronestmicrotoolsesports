"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { createCampaign } from "../services/campaign-service";
import { activateCampaign } from "../services/campaign-lifecycle";
import { requestManualScan } from "../services/scan-action";
import { AppError } from "@/lib/errors";

type ActionResult = { error?: string; fieldErrors?: Record<string, string[]> } | void;

export async function createCampaignAction(formData: FormData): Promise<ActionResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  if (!orgSlug) return { error: "Missing organization" };
  let campaignId: string | null = null;
  try {
    const ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
    const supabase = await createClient();

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim() || null;
    const starts_at = String(formData.get("starts_at") ?? "");
    const ends_at = String(formData.get("ends_at") ?? "");

    const campaign = await createCampaign(supabase, ctx.organization.id, { name, description, starts_at, ends_at, status: "draft" });
    revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`);
    campaignId = campaign.id;
  } catch (e) {
    // NEXT_REDIRECT must propagate
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    if (e instanceof AppError) {
      if (e.code === "VALIDATION_ERROR") {
        const details = e.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined;
        const fieldErrors = details?.fieldErrors;
        // Build user-visible message from fieldErrors
        let msg = e.safeMessage;
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          const parts = Object.entries(fieldErrors).map(([field, errs]) => `${field}: ${errs.join(", ")}`);
          msg = parts.join("; ");
          // Map datetime errors to friendly message
          msg = msg.replace(/Invalid datetime/g, "Please enter a valid date and time");
          msg = msg.replace(/ends_at:.*after starts_at/i, "End time must be after the start time");
        }
        // Log server-side without PII
        console.warn(`[AppError ${e.code}]`, msg);
        if (fieldErrors) return { error: msg, fieldErrors };
        return { error: msg };
      }
      // Other AppErrors (entitlement, forbidden) – return safe message without stack
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[createCampaignAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
  if (campaignId) {
    redirect(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}` as never);
  }
  return { error: "Failed to create campaign" };
}

export async function activateCampaignAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const supabase = await createClient();
  await activateCampaign(supabase, ctx.organization.id, campaignId);
  revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}`);
  redirect(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}` as never);
}

export async function requestScanAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const supabase = await createClient();
  await requestManualScan(supabase, ctx.organization.id, campaignId);
  revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}`);
  redirect(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}` as never);
}
