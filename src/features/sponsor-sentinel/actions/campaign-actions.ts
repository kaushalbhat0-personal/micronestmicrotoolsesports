"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { createCampaign } from "../services/campaign-service";
import { activateCampaign } from "../services/campaign-lifecycle";
import { requestManualScan } from "../services/scan-action";

export async function createCampaignAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  if (!orgSlug) throw new Error("Missing orgSlug");
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const starts_at = String(formData.get("starts_at") ?? "");
  const ends_at = String(formData.get("ends_at") ?? "");

  const campaign = await createCampaign(supabase, ctx.organization.id, { name, description, starts_at, ends_at, status: "draft" });
  revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`);
  redirect(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaign.id}` as never);
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
