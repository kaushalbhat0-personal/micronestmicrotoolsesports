"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCampaign } from "../services/campaign-service";
import { activateCampaign } from "../services/campaign-lifecycle";
import { requestManualScan } from "../services/scan-action";
import { AppError } from "@/lib/errors";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as deliverableRepo from "@/server/repositories/deliverables";

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

export async function activateCampaignAction(formData: FormData): Promise<ActionResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!orgSlug || !campaignId) return { error: "Missing parameters" };
  try {
    const ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
    const supabase = await createClient();
    await activateCampaign(supabase, ctx.organization.id, campaignId);
    revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    if (e instanceof AppError) {
      // Expected domain validation errors → return user-visible message, not 500
      const isValidation = e.code === "VALIDATION_ERROR" || e.code === "ENTITLEMENT_REQUIRED" || e.code === "FORBIDDEN" || e.code === "NOT_FOUND";
      if (isValidation) {
        // Keep existing domain message (e.g., "At least one connected channel required")
        console.warn(`[AppError ${e.code}]`, e.safeMessage);
        return { error: e.safeMessage };
      }
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[activateCampaignAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
  redirect(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}` as never);
}

export async function requestScanAction(formData: FormData): Promise<{ ok?: boolean; error?: string } | void> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!orgSlug || !campaignId) return { error: "Missing information. Please refresh and try again." };

  let ctx: Awaited<ReturnType<typeof requireOrganizationContext>>;
  try {
    ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.code === "ENTITLEMENT_REQUIRED" || e.code === "FORBIDDEN" ? "You don't have access to this workspace." : e.safeMessage };
    }
    console.error("[requestScanAction] auth unexpected", e);
    return { error: "We couldn't complete this check. Please try again in a moment." };
  }

  // Synchronous validation before scheduling background work — keep fast feedback for common errors
  try {
    const supabase = await createClient();
    const campaign = await campaignRepo.findSponsorCampaignById(supabase, campaignId);
    if (!campaign) return { error: "Campaign not found." };
    if (campaign.organization_id !== ctx.organization.id) return { error: "Campaign not found." };
    if (campaign.status !== "active") return { error: "Only tracking campaigns can be checked." };

    // Quick channel/deliverable presence check for immediate customer error (avoid scheduling doomed scan)
    const [channels, deliverables] = await Promise.all([
      channelRepo.listConnectedChannelsByOrg(supabase, ctx.organization.id),
      deliverableRepo.listDeliverablesByCampaign(supabase, campaignId),
    ]);
    const usable = channels.filter((c) => c.connection_status === "connected");
    if (usable.length === 0) return { error: "Connect a creator channel before checking." };
    if (deliverables.length === 0) return { error: "Add a requirement before checking." };
  } catch (e) {
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[requestScanAction] validation unexpected", e);
    return { error: "We couldn't complete this check. Please try again in a moment." };
  }

  const organizationId = ctx.organization.id;
  const slugForRevalidate = orgSlug;
  const campaignIdForRevalidate = campaignId;

  // Schedule real scan after response — lightweight, no queue infra
  after(async () => {
    try {
      const admin = createAdminClient();
      await requestManualScan(admin as unknown as never, organizationId, campaignIdForRevalidate);
      revalidatePath(`/dashboard/${slugForRevalidate}/sponsor-sentinel/campaigns/${campaignIdForRevalidate}`);
      revalidatePath(`/dashboard/${slugForRevalidate}/sponsor-sentinel/scans`);
    } catch (e) {
      // Safe logging: identifiers only, no secrets/payloads
      const shortOrg = organizationId.slice(0, 8);
      const shortCamp = campaignIdForRevalidate.slice(0, 8);
      if (e instanceof AppError) {
        console.warn(`[CheckNow after AppError ${e.code}] org ${shortOrg} camp ${shortCamp} ${e.safeMessage}`);
      } else {
        const msg = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
        console.error(`[CheckNow after unexpected] org ${shortOrg} camp ${shortCamp} ${msg}`);
      }
      // Revalidate so UI can show failed scan status even on error (scan row persisted with failed)
      try {
        revalidatePath(`/dashboard/${slugForRevalidate}/sponsor-sentinel/campaigns/${campaignIdForRevalidate}`);
        revalidatePath(`/dashboard/${slugForRevalidate}/sponsor-sentinel/scans`);
      } catch {}
    }
  });

  return { ok: true };
}
