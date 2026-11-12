import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, validationError, notFoundError, entitlementError } from "@/lib/errors";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";

export type CampaignStatus = "draft" | "active" | "completed" | "archived";

const ALLOWED: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["active", "archived"],
  active: ["completed", "archived"],
  completed: ["archived"],
  archived: [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: CampaignStatus, to: CampaignStatus) {
  if (from === to) return;
  if (!canTransition(from, to)) throw validationError(`Invalid status transition ${from} → ${to}`);
}

export async function activateCampaign(supabase: SupabaseClient, organizationId: string, campaignId: string, userId?: string) {
  const campaign = await campaignRepo.findSponsorCampaignById(supabase, campaignId);
  if (!campaign) throw notFoundError("Campaign not found");
  if (campaign.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  if (campaign.status !== "draft") throw validationError(`Only draft campaigns can be activated (current: ${campaign.status})`);

  // Entitlement check — shared org-coverage (legacy org grant, owner
  // grant, or caller grant). Membership/authorization stays with the caller.
  const has = await checkEntitlement(supabase, organizationId, userId);
  if (!has) throw entitlementError("Sponsorship Tracking isn't active for your workspace yet. Check your plan or open Billing to activate access.");

  // Must have at least one usable connected channel
  const channels = await channelRepo.listConnectedChannelsByOrg(supabase, organizationId);
  const usable = channels.filter((c) => c.connection_status === "connected");
  if (usable.length === 0) throw validationError("At least one connected channel required", { code: "NO_CHANNEL" });

  // Must have at least one deliverable
  const deliverables = await deliverableRepo.listDeliverablesByCampaign(supabase, campaignId);
  if (deliverables.length === 0) throw validationError("At least one deliverable required", { code: "NO_DELIVERABLE" });

  // All deliverable rules must be valid (already validated on create, but re-check for capability)
  for (const d of deliverables) {
    // Rule already validated via Zod on create; here ensure rule is object
    if (!d.rule || typeof d.rule !== "object") throw validationError(`Invalid rule for deliverable ${d.name}`);
  }

  // Free-tier quota: at most 1 active campaign total per free user (paid → no-op).
  if (userId) {
    const { assertFreeCampaignActivateAllowed } = await import("@/server/services/sponsorship-limits");
    await assertFreeCampaignActivateAllowed(supabase, { userId, organizationId, campaignId });
  }

  // Transactional update — single status change, no partial mutation (Supabase lacks transaction, single UPDATE is atomic)
  const updated = await campaignRepo.updateSponsorCampaign(supabase, campaignId, { status: "active" as CampaignStatus });
  if (updated.status !== "active") throw validationError("Activation failed");
  return updated;
}

async function checkEntitlement(supabase: SupabaseClient, organizationId: string, userId?: string): Promise<boolean> {
  // Phase 3: shared org-coverage check. Membership/authorization stays with
  // the action gate (requireEntitlement); this is coverage only.
  const { hasSponsorshipAccessForOrg } = await import("@/server/services/sponsorship-access");
  return hasSponsorshipAccessForOrg(supabase, organizationId, userId);
}

export async function transitionCampaign(supabase: SupabaseClient, organizationId: string, campaignId: string, to: CampaignStatus) {
  const campaign = await campaignRepo.findSponsorCampaignById(supabase, campaignId);
  if (!campaign) throw notFoundError("Campaign not found");
  if (campaign.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  assertTransition(campaign.status as CampaignStatus, to);
  return campaignRepo.updateSponsorCampaign(supabase, campaignId, { status: to });
}

export async function completeCampaign(supabase: SupabaseClient, organizationId: string, campaignId: string) {
  const campaign = await campaignRepo.findSponsorCampaignById(supabase, campaignId);
  if (!campaign) throw notFoundError("Campaign not found");
  if (campaign.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  if (campaign.status !== "active") throw validationError(`Only tracking campaigns can be completed (current: ${campaign.status})`);
  return campaignRepo.updateSponsorCampaign(supabase, campaignId, { status: "completed" as CampaignStatus });
}
