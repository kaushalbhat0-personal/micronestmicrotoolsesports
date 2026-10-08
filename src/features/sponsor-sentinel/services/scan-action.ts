import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, notFoundError, validationError, entitlementError } from "@/lib/errors";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import { executeScan } from "@/server/scanner/scan-orchestrator";

export async function requestManualScan(supabase: SupabaseClient, organizationId: string, campaignId: string, userId?: string) {
  const campaign = await campaignRepo.findSponsorCampaignById(supabase, campaignId);
  if (!campaign) throw notFoundError("Campaign not found");
  if (campaign.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  if (campaign.status !== "active") throw validationError("Only active campaigns can be scanned", { code: "NOT_ACTIVE" });

  // Entitlement check
  const has = await checkEntitlement(supabase, organizationId, userId);
  if (!has) throw entitlementError("Sponsorship Tracking isn't active for your workspace yet. Check your plan or open Billing to activate access.");

  // Call existing scanner — DISCOVER→FETCH→NORMALIZE→EVALUATE→PERSIST
  const result = await executeScan({ supabase, input: { organizationId, campaignId } });
  return result;
}

async function checkEntitlement(supabase: SupabaseClient, organizationId: string, userId?: string): Promise<boolean> {
  // Phase 3: shared org-coverage check (legacy org grant, owner grant, or
  // caller grant). Membership/authorization stays with the action gate.
  const { hasSponsorshipAccessForOrg } = await import("@/server/services/sponsorship-access");
  return hasSponsorshipAccessForOrg(supabase, organizationId, userId);
}
