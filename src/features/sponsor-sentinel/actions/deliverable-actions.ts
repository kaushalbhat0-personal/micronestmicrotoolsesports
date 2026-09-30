"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { createDeliverable } from "../services/deliverable-service";
import * as deliverableRepo from "@/server/repositories/deliverables";
import { deliverableRuleSchema } from "../schemas/rules";

export async function createDeliverableAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const platformHint = String(formData.get("platformHint") ?? "") as "twitch" | "youtube" | "kick" | "";
  const ruleType = String(formData.get("ruleType") ?? "");
  const ruleValue = String(formData.get("ruleValue") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const tagIds = String(formData.get("tagIds") ?? "").trim();

  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const supabase = await createClient();

  let rule: unknown;
  switch (ruleType) {
    case "required_title_contains":
      rule = { type: "required_title_contains", value: ruleValue };
      break;
    case "required_hashtag":
      rule = { type: "required_hashtag", value: ruleValue };
      break;
    case "required_category":
      rule = { type: "required_category", categoryId: categoryId || ruleValue, platform: platformHint || undefined };
      break;
    case "required_twitch_tag":
      rule = { type: "required_twitch_tag", tag_id: ruleValue || tagIds };
      break;
    case "required_youtube_tags":
      rule = { type: "required_youtube_tags", tags: tagIds ? tagIds.split(",").map((t) => t.trim()).filter(Boolean) : [ruleValue] };
      break;
    case "required_kick_tags":
      rule = { type: "required_kick_tags", tags: tagIds ? tagIds.split(",").map((t) => t.trim()).filter(Boolean) : [ruleValue] };
      break;
    case "minimum_duration":
      rule = { type: "minimum_duration", minutes: Number(ruleValue) || 10 };
      break;
    case "required_vod_exists":
      rule = { type: "required_vod_exists" };
      break;
    case "required_description_contains":
      rule = { type: "required_description_contains", value: ruleValue };
      break;
    default:
      rule = { type: "required_title_contains", value: ruleValue || "test" };
  }

  // Validate rule
  const parsed = deliverableRuleSchema.safeParse(rule);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Invalid rule");

  await createDeliverable(supabase, ctx.organization.id, {
    campaign_id: campaignId,
    name,
    description,
    rule: parsed.data,
    platformHint: platformHint || undefined,
  });

  revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}`);
  redirect(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}` as never);
}

export async function deleteDeliverableAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  const deliverableId = String(formData.get("deliverableId") ?? "");
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const supabase = await createClient();
  const existing = await deliverableRepo.findDeliverableById(supabase, deliverableId);
  if (!existing || existing.organization_id !== ctx.organization.id) throw new Error("Not found");
  await deliverableRepo.deleteDeliverable(supabase, deliverableId);
  revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}`);
  redirect(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}` as never);
}
