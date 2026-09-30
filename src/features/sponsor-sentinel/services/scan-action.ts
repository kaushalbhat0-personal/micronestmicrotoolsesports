import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, notFoundError, validationError, entitlementError } from "@/lib/errors";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import { executeScan } from "@/server/scanner/scan-orchestrator";

export async function requestManualScan(supabase: SupabaseClient, organizationId: string, campaignId: string) {
  const campaign = await campaignRepo.findSponsorCampaignById(supabase, campaignId);
  if (!campaign) throw notFoundError("Campaign not found");
  if (campaign.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  if (campaign.status !== "active") throw validationError("Only active campaigns can be scanned", { code: "NOT_ACTIVE" });

  // Entitlement check
  const has = await checkEntitlement(supabase, organizationId);
  if (!has) throw entitlementError("Sponsor Sentinel entitlement required");

  // Call existing scanner — DISCOVER→FETCH→NORMALIZE→EVALUATE→PERSIST
  const result = await executeScan({ supabase, input: { organizationId, campaignId } });
  return result;
}

async function checkEntitlement(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("has_tool_access", { org_id: organizationId, tool_slug: "sponsor-sentinel" });
    if (!error && typeof data === "boolean") return data;
  } catch {}
  const { data: tool } = await supabase.from("tools").select("id").eq("slug", "sponsor-sentinel").single();
  if (!tool) return false;
  const { data: entitlements } = await supabase.from("tool_entitlements").select("is_all_access, tool_id, expires_at").eq("organization_id", organizationId);
  if (!entitlements) return false;
  const list = entitlements as Array<{ is_all_access: boolean; tool_id: string | null; expires_at: string | null }>;
  return list.some((e) => {
    const notExpired = !e.expires_at || new Date(e.expires_at) > new Date();
    if (!notExpired) return false;
    if (e.is_all_access) return true;
    return e.tool_id === (tool as { id: string }).id;
  });
}
